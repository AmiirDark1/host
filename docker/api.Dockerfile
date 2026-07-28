# Dockerfile for Hosting Control Panel API
# Multi-stage build for production optimization

FROM python:3.12-bookworm AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install system build dependencies (bookworm has most tools pre-installed)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc \
        g++ \
        libpq-dev \
        libssl-dev \
        pkg-config \
        && rm -rf /var/lib/apt/lists/*

# Install Rust for compiling Rust-based Python packages (pydantic-core, orjson, asyncpg)
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path && \
    chmod -R a+w $RUSTUP_HOME $CARGO_HOME && \
    rustup default stable

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -U pip maturin setuptools-rust && \
    pip install --no-cache-dir -r requirements.txt

# ---- Production Stage ----
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random \
    APP_HOME=/app

WORKDIR $APP_HOME

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq-dev \
        curl \
        netcat-openbsd \
        && rm -rf /var/lib/apt/lists/*

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY ./src ./src
COPY ./alembic ./alembic
COPY ./alembic.ini .

# Create non-root user for security
RUN useradd -m -u 1000 hosting && \
    chown -R hosting:hosting $APP_HOME

USER hosting

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl --fail http://localhost:8000/api/v1/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "hosting_control.main_controller.api.main:app", "--host", "0.0.0.0", "--port", "8000"]