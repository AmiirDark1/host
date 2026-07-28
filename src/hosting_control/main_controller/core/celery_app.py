"""Celery worker configuration for handling async tasks.

Celery handles long-running operations like website provisioning,
backups, SSL certificate management, and monitoring.
"""

from __future__ import annotations

from celery import Celery

from hosting_control.shared.config import get_settings

settings = get_settings()

celery_app = Celery(
    "hosting_control",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "hosting_control.main_controller.application.tasks.provisioning",
        "hosting_control.main_controller.application.tasks.backup",
        "hosting_control.main_controller.application.tasks.monitoring",
        "hosting_control.main_controller.application.tasks.ssl",
        "hosting_control.main_controller.application.tasks.billing",
    ],
)

celery_app.conf.update(
    task_serializer=settings.CELERY_TASK_SERIALIZER,
    result_serializer=settings.CELERY_RESULT_SERIALIZER,
    accept_content=settings.CELERY_ACCEPT_CONTENT,
    task_track_started=settings.CELERY_TASK_TRACK_STARTED,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_max_tasks_per_child=1000,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    result_expires=3600 * 24 * 7,  # 7 days
)


@celery_app.task(bind=True, max_retries=3)
def debug_task(self) -> str:
    """Debug task to verify Celery is working."""
    return f"Request: {self.request!r}"