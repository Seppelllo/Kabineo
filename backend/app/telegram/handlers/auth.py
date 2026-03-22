from sqlalchemy import select
from telegram import Update
from telegram.ext import ContextTypes

from app.database import async_session
from app.models.telegram_link import TelegramLink
from app.telegram.handlers.menu import send_main_menu


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await send_main_menu(
        update, context,
        "Willkommen bei Kabineo! 📄\n\n"
        "🔗 <b>Account verknüpfen:</b>\n"
        "Web-App → Einstellungen → Telegram → Code kopieren\n"
        "Dann hier: /link &lt;code&gt;\n\n"
        "Oder wähle eine Aktion aus dem Menü:",
    )


async def link_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Bitte sende: /link <dein-code>")
        return

    code = context.args[0]
    telegram_user_id = update.effective_user.id
    telegram_chat_id = update.effective_chat.id

    async with async_session() as db:
        result = await db.execute(
            select(TelegramLink).where(TelegramLink.auth_token == code)
        )
        link = result.scalar_one_or_none()

        if not link:
            await update.message.reply_text("Ungültiger Code. Bitte generiere einen neuen in der Web-App.")
            return

        link.telegram_user_id = telegram_user_id
        link.telegram_chat_id = telegram_chat_id
        link.is_verified = True
        link.auth_token = None
        await db.commit()

    await send_main_menu(update, context, "✅ Account erfolgreich verknüpft!")
