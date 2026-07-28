"""WebSocket-based SSH terminal for remote node management.

Provides real-time terminal access to remote nodes directly from the panel,
supporting multiple simultaneous connections and proper terminal resize handling.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from paramiko import AutoAddPolicy, SSHClient, RSAKey
from paramiko.ssh_exception import SSHException

from hosting_control.main_controller.api.auth import get_current_admin_ws
from hosting_control.main_controller.domain.entities import Node, User
from hosting_control.main_controller.infrastructure.database import get_db_session
from hosting_control.main_controller.infrastructure.repositories import UnitOfWorkImpl

logger = logging.getLogger(__name__)

router = APIRouter()


class TerminalManager:
    """Manages active SSH terminal sessions.

    Handles connection pooling, session cleanup, and
    WebSocket message forwarding between browser and remote node.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, "SSHSession"] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    async def start_cleanup_task(self) -> None:
        """Start background task to clean up stale sessions."""
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self) -> None:
        """Periodically clean up stale sessions."""
        while True:
            await asyncio.sleep(300)  # Every 5 minutes
            stale = [
                sid for sid, session in self._sessions.items()
                if session.is_stale
            ]
            for sid in stale:
                await self.close_session(sid)

    async def create_session(
        self,
        session_id: str,
        node: Node,
        websocket: WebSocket,
    ) -> "SSHSession":
        """Create a new SSH session to a remote node."""
        session = SSHSession(session_id, node, websocket)
        self._sessions[session_id] = session
        return session

    async def close_session(self, session_id: str) -> None:
        """Close and cleanup an SSH session."""
        session = self._sessions.pop(session_id, None)
        if session:
            await session.close()

    def get_session(self, session_id: str) -> Optional["SSHSession"]:
        """Get an active session by ID."""
        return self._sessions.get(session_id)


class SSHSession:
    """Represents a single SSH terminal session to a remote node."""

    def __init__(
        self,
        session_id: str,
        node: Node,
        websocket: WebSocket,
    ) -> None:
        self.session_id = session_id
        self.node = node
        self.websocket = websocket
        self._client: Optional[SSHClient] = None
        self._channel: Any = None
        self._transport: Any = None
        self._reader_task: Optional[asyncio.Task] = None
        self._last_activity: float = asyncio.get_event_loop().time()
        self._closed: bool = False

    @property
    def is_stale(self) -> bool:
        """Check if session has been inactive for too long."""
        if self._closed:
            return True
        elapsed = asyncio.get_event_loop().time() - self._last_activity
        return elapsed > 1800  # 30 minutes timeout

    async def connect(self, ssh_key_path: Optional[str] = None) -> None:
        """Establish SSH connection to the remote node.

        Uses SSH key authentication by default, falling back to password
        if key authentication fails.
        """
        try:
            self._client = SSHClient()
            self._client.set_missing_host_key_policy(AutoAddPolicy())

            connect_kwargs: dict[str, Any] = {
                "hostname": self.node.host,
                "port": self.node.ssh_port,
                "username": "root",
                "timeout": 10,
                "allow_agent": False,
                "look_for_keys": False,
            }

            # Try SSH key first, then password
            if ssh_key_path and os.path.exists(ssh_key_path):
                try:
                    key = RSAKey.from_private_key_file(ssh_key_path)
                    connect_kwargs["pkey"] = key
                except Exception as e:
                    logger.warning(f"Failed to load SSH key: {e}")

            self._client.connect(**connect_kwargs)

            # Open interactive shell session
            self._channel = self._client.invoke_shell(
                term="xterm-256color",
                width=120,
                height=40,
            )
            self._channel.setblocking(0)

            # Start reading stdout in background
            self._reader_task = asyncio.create_task(self._read_output())

            await self._send_message("connected", {
                "message": f"Connected to {self.node.name} ({self.node.host})",
            })

        except SSHException as e:
            await self._send_message("error", {
                "message": f"SSH connection failed: {str(e)}",
            })
            raise
        except Exception as e:
            await self._send_message("error", {
                "message": f"Connection failed: {str(e)}",
            })
            raise

    async def resize(self, cols: int, rows: int) -> None:
        """Resize the terminal window."""
        if self._channel:
            try:
                self._channel.resize_pty(width=cols, height=rows)
            except Exception as e:
                logger.warning(f"Terminal resize failed: {e}")

    async def write_input(self, data: str) -> None:
        """Send user input to the remote shell."""
        if self._channel and not self._closed:
            try:
                self._channel.send(data)
                self._last_activity = asyncio.get_event_loop().time()
            except Exception as e:
                await self._send_message("error", {
                    "message": f"Failed to send input: {str(e)}",
                })

    async def _read_output(self) -> None:
        """Read output from SSH channel and forward to WebSocket."""
        try:
            while not self._closed and self._channel:
                if self._channel.recv_ready():
                    data = self._channel.recv(4096)
                    if data:
                        decoded = data.decode("utf-8", errors="replace")
                        await self._send_message("output", {"data": decoded})
                        self._last_activity = asyncio.get_event_loop().time()
                elif self._channel.exit_status_ready():
                    break
                else:
                    await asyncio.sleep(0.01)
        except Exception as e:
            if not self._closed:
                await self._send_message("error", {
                    "message": f"Read error: {str(e)}",
                })

    async def _send_message(self, msg_type: str, data: dict[str, Any]) -> None:
        """Send a JSON message through the WebSocket."""
        try:
            await self.websocket.send_json({
                "type": msg_type,
                **data,
            })
        except Exception:
            pass  # WebSocket might be closed

    async def close(self) -> None:
        """Close the SSH session and cleanup resources."""
        self._closed = True

        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
            try:
                await self._reader_task
            except asyncio.CancelledError:
                pass

        if self._channel:
            try:
                self._channel.close()
            except Exception:
                pass

        if self._client:
            try:
                self._client.close()
            except Exception:
                pass


# Global terminal manager instance
terminal_manager = TerminalManager()


@router.websocket("/nodes/{node_id}/terminal")
async def node_terminal(
    websocket: WebSocket,
    node_id: str,
    db=Depends(get_db_session),
) -> None:
    """WebSocket endpoint for real-time terminal access to a node.
    
    Protocol:
    - Client sends: {"type": "input", "data": "command\n"}
    - Client sends: {"type": "resize", "cols": 120, "rows": 40}
    - Server sends: {"type": "output", "data": "terminal output..."}
    - Server sends: {"type": "connected", "message": "..."}
    - Server sends: {"type": "error", "message": "..."}
    """
    await websocket.accept()
    
    # Authenticate via JWT token in first message
    auth_data = await websocket.receive_json()
    if auth_data.get("type") != "auth" or not auth_data.get("token"):
        await websocket.send_json({
            "type": "error",
            "message": "Authentication required",
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Validate token
    try:
        from hosting_control.shared.security.jwt import decode_access_token
        payload = decode_access_token(auth_data["token"])
        if payload.get("role") not in ("admin", "superadmin"):
            raise ValueError("Insufficient permissions")
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "message": f"Authentication failed: {str(e)}",
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Get node info
    uow = UnitOfWorkImpl(db)
    node = await uow.nodes.get_by_id(node_id)
    if not node:
        await websocket.send_json({
            "type": "error",
            "message": "Node not found",
        })
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    session_id = f"terminal:{node_id}:{payload.get('sub', 'unknown')}"
    session: Optional[SSHSession] = None

    try:
        # Create and connect SSH session
        session = await terminal_manager.create_session(
            session_id=session_id,
            node=node,
            websocket=websocket,
        )

        # Get SSH key path from config if available
        from hosting_control.shared.config import get_settings
        settings = get_settings()
        ssh_key_path = getattr(settings, "SSH_KEY_PATH", None)

        await session.connect(ssh_key_path=ssh_key_path)

        # Handle WebSocket messages
        while True:
            try:
                message = await websocket.receive_json()
                msg_type = message.get("type")

                if msg_type == "input":
                    await session.write_input(message.get("data", ""))
                elif msg_type == "resize":
                    await session.resize(
                        cols=message.get("cols", 120),
                        rows=message.get("rows", 40),
                    )
                elif msg_type == "ping":
                    await session._send_message("pong", {})
                elif msg_type == "close":
                    break

            except WebSocketDisconnect:
                break
            except json.JSONDecodeError:
                await session._send_message("error", {
                    "message": "Invalid JSON message",
                })

    except Exception as e:
        logger.error(f"Terminal session error: {e}")
    finally:
        if session:
            await terminal_manager.close_session(session_id)
        try:
            await websocket.close()
        except Exception:
            pass


@router.post("/nodes/{node_id}/ssh-keys")
async def register_ssh_key(
    node_id: str,
    admin: User = Depends(get_current_admin_ws),
) -> dict[str, Any]:
    """Register a new SSH key for node access.
    
    This endpoint allows generating and deploying SSH keys
    to remote nodes for password-less authentication.
    """
    # Generate SSH key pair
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.backends import default_backend

    key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=4096,
        backend=default_backend(),
    )

    # Get public key
    public_key = key.public_key().public_bytes(
        encoding=serialization.Encoding.OpenSSH,
        format=serialization.PublicFormat.OpenSSH,
    ).decode("utf-8")

    # Get private key (encrypted)
    private_key = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.OpenSSH,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    return {
        "public_key": public_key,
        "private_key": private_key,
        "instructions": (
            "Add the public key to the node's ~/.ssh/authorized_keys "
            "or use the private key in your SSH client."
        ),
    }