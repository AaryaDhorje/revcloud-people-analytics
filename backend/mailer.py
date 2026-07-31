"""Password reset delivery.

Two backends, chosen by `PASSWORD_RESET_DELIVERY`:

  console  the reset URL is written to the server log. This is the MVP default
           and needs no third-party account — the operator reads the link out
           of the log (or the admin console) and hands it to the user.
  smtp     a real email is sent via the configured SMTP server.

Keeping this behind one function means swapping in a transactional provider
later is a single-file change.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from backend.config import settings

logger = logging.getLogger("revcloud.mailer")

SUBJECT = "Reset your RevCloud People Analytics password"

BODY_TEMPLATE = """\
Hello,

We received a request to reset the password for your RevCloud People Analytics
account. Open the link below to choose a new one. It expires in {ttl} minutes.

{reset_url}

If you did not request this, you can safely ignore this email — your password
will not change.

- RevCloud People Analytics
"""


async def send_password_reset(*, to_email: str, reset_url: str) -> None:
    body = BODY_TEMPLATE.format(
        reset_url=reset_url, ttl=settings.password_reset_ttl_minutes
    )

    if settings.password_reset_delivery.lower() != "smtp":
        logger.warning(
            "\n%s\nPASSWORD RESET for %s\n%s\n%s\n",
            "=" * 78,
            to_email,
            reset_url,
            "=" * 78,
        )
        return

    if not settings.smtp_host:
        logger.error(
            "PASSWORD_RESET_DELIVERY=smtp but SMTP_HOST is unset; "
            "falling back to logging the link for %s",
            to_email,
        )
        logger.warning("PASSWORD RESET for %s: %s", to_email, reset_url)
        return

    message = EmailMessage()
    message["Subject"] = SUBJECT
    message["From"] = settings.smtp_from
    message["To"] = to_email
    message.set_content(body)

    # smtplib is blocking; push it off the event loop so a slow mail server
    # cannot stall other requests.
    await asyncio.to_thread(_send_sync, message)


def _send_sync(message: EmailMessage) -> None:
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except Exception:
        # A mail failure must not turn into a 500 on /forgot-password, which
        # would also leak that the address exists.
        logger.exception("Failed to send password reset email")
