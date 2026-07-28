"""Backup and restore tasks for websites."""

from __future__ import annotations

from hosting_control.main_controller.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, name="backup.create_backup")
def create_backup(self, website_id: str) -> dict:
    """Create a full backup of a website (files + database)."""
    return {"status": "pending", "website_id": website_id}


@celery_app.task(bind=True, max_retries=3, name="backup.restore_backup")
def restore_backup(self, website_id: str, backup_id: str) -> dict:
    """Restore a website from a backup."""
    return {"status": "pending", "website_id": website_id, "backup_id": backup_id}


@celery_app.task(bind=True, max_retries=3, name="backup.delete_backup")
def delete_backup(self, backup_id: str) -> dict:
    """Delete a specific backup."""
    return {"status": "pending", "backup_id": backup_id}


@celery_app.task(bind=True, max_retries=3, name="backup.scheduled_backup")
def scheduled_backup(self) -> dict:
    """Run scheduled backups for all websites that need them."""
    return {"status": "completed", "message": "Scheduled backup check completed"}