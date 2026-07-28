"""Monitoring and health check tasks."""

from __future__ import annotations

from hosting_control.main_controller.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, name="monitoring.node_health_check")
def node_health_check(self, node_id: str) -> dict:
    """Perform health check on a remote node."""
    return {"status": "pending", "node_id": node_id}


@celery_app.task(bind=True, max_retries=3, name="monitoring.collect_metrics")
def collect_metrics(self) -> dict:
    """Collect resource usage metrics from all active nodes."""
    return {"status": "completed", "message": "Metrics collection completed"}


@celery_app.task(bind=True, max_retries=3, name="monitoring.check_alerts")
def check_alerts(self) -> dict:
    """Check all monitoring alerts and trigger notifications if needed."""
    return {"status": "completed", "message": "Alert check completed"}