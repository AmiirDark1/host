"""Provisioning tasks for website deployment."""

from __future__ import annotations

from hosting_control.main_controller.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, name="provisioning.deploy_website")
def deploy_website(self, website_id: str) -> dict:
    """Deploy a new WordPress website on a remote node."""
    return {"status": "pending", "website_id": website_id}


@celery_app.task(bind=True, max_retries=3, name="provisioning.destroy_website")
def destroy_website(self, website_id: str) -> dict:
    """Destroy a website and clean up all resources."""
    return {"status": "pending", "website_id": website_id}


@celery_app.task(bind=True, max_retries=3, name="provisioning.rebuild_website")
def rebuild_website(self, website_id: str) -> dict:
    """Rebuild a website container from scratch."""
    return {"status": "pending", "website_id": website_id}


@celery_app.task(bind=True, max_retries=3, name="provisioning.clone_website")
def clone_website(self, website_id: str, target_node_id: str) -> dict:
    """Clone a website to another node."""
    return {"status": "pending", "website_id": website_id, "target_node_id": target_node_id}