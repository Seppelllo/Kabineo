import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings


async def send_email(to: str, subject: str, html_body: str) -> bool:
    if not settings.smtp_enabled:
        return False
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        if settings.smtp_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)
    return True


async def send_welcome_email(to: str, username: str, temp_password: str) -> bool:
    html = f"""
    <h2>Willkommen bei Kabineo</h2>
    <p>Hallo {username},</p>
    <p>Ein Account wurde für dich erstellt.</p>
    <p><strong>Benutzername:</strong> {username}<br>
    <strong>Temporäres Passwort:</strong> {temp_password}</p>
    <p>Bitte ändere dein Passwort beim ersten Login.</p>
    """
    return await send_email(to, "Kabineo — Dein Account wurde erstellt", html)


async def send_password_reset_email(to: str, username: str, new_password: str) -> bool:
    html = f"""
    <h2>Passwort zurückgesetzt</h2>
    <p>Hallo {username},</p>
    <p>Dein Passwort wurde zurückgesetzt.</p>
    <p><strong>Neues Passwort:</strong> {new_password}</p>
    <p>Bitte ändere es beim nächsten Login.</p>
    """
    return await send_email(to, "Kabineo — Passwort zurückgesetzt", html)
