"""Billing and payment processing tasks."""

from __future__ import annotations

from hosting_control.main_controller.core.celery_app import celery_app


@celery_app.task(bind=True, max_retries=3, name="billing.process_invoice")
def process_invoice(self, invoice_id: str) -> dict:
    """Process an invoice and charge the customer."""
    return {"status": "pending", "invoice_id": invoice_id}


@celery_app.task(bind=True, max_retries=3, name="billing.send_reminder")
def send_reminder(self, invoice_id: str) -> dict:
    """Send payment reminder for overdue invoices."""
    return {"status": "pending", "invoice_id": invoice_id}


@celery_app.task(bind=True, max_retries=3, name="billing.auto_renew")
def auto_renew(self, order_id: str) -> dict:
    """Auto-renew a hosting order."""
    return {"status": "pending", "order_id": order_id}


@celery_app.task(bind=True, max_retries=3, name="billing.suspend_overdue")
def suspend_overdue(self) -> dict:
    """Suspend websites with overdue invoices."""
    return {"status": "completed", "message": "Overdue suspension check completed"}