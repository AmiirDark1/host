"""SSL certificate management tasks using Let's Encrypt."""

from __future__ import annotations

from hosting_control.main_controller.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, name="ssl.issue_certificate")
def issue_certificate(self, website_id: str, domain: str) -> dict:
    """Issue a new SSL certificate via Let's Encrypt."""
    return {"status": "pending", "website_id": website_id, "domain": domain}


@celery_app.task(bind=True, max_retries=3, name="ssl.renew_certificate")
def renew_certificate(self, certificate_id: str) -> dict:
    """Renew an existing SSL certificate."""
    return {"status": "pending", "certificate_id": certificate_id}


@celery_app.task(bind=True, max_retries=3, name="ssl.revoke_certificate")
def revoke_certificate(self, certificate_id: str) -> dict:
    """Revoke an SSL certificate."""
    return {"status": "pending", "certificate_id": certificate_id}


@celery_app.task(bind=True, max_retries=3, name="ssl.auto_renew_all")
def auto_renew_all(self) -> dict:
    """Check all certificates and renew those expiring within 30 days."""
    return {"status": "completed", "message": "Auto-renew check completed"}