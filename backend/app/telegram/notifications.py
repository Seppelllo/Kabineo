import logging

from sqlalchemy import select
from telegram import Bot

from app.config import settings
from app.database import async_session
from app.models.telegram_link import TelegramLink

logger = logging.getLogger(__name__)


async def notify_user(user_id: str, message: str):
    if not settings.telegram_bot_token or settings.telegram_bot_token == "your-telegram-bot-token":
        return

    async with async_session() as db:
        result = await db.execute(
            select(TelegramLink).where(
                TelegramLink.user_id == user_id,
                TelegramLink.is_verified == True,
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            return

        try:
            bot = Bot(token=settings.telegram_bot_token)
            await bot.send_message(chat_id=link.telegram_chat_id, text=message)
        except Exception as e:
            logger.error(f"Failed to send Telegram notification: {e}")
