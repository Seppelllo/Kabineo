import uuid
from html import escape

from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.database import async_session
from app.models.telegram_link import TelegramLink
from app.services.search_service import search_documents
from app.telegram.handlers.menu import send_main_menu


def _short(uid) -> str:
    return str(uid)[:8]


async def search_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text("Bitte sende: /search &lt;Suchbegriff&gt;", parse_mode="HTML")
        return

    query_text = " ".join(context.args)

    async with async_session() as db:
        result = await db.execute(
            select(TelegramLink).where(
                TelegramLink.telegram_user_id == update.effective_user.id,
                TelegramLink.is_verified == True,
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
            return

        items, total = await search_documents(db, query_text, owner_id=uuid.UUID(str(link.user_id)), page_size=5)

    if not items:
        await send_main_menu(update, context, f"🔍 Keine Ergebnisse für '{escape(query_text)}'")
        return

    text = f"🔍 <b>{total} Ergebnis(se) für '{escape(query_text)}':</b>\n\n"
    keyboard = []
    for item in items:
        title = item["title"]
        text += f"📄 {escape(title)}\n"
        if item.get("snippet"):
            snippet = item["snippet"].replace("<mark>", "").replace("</mark>", "")
            text += f"   <i>{escape(snippet[:80])}...</i>\n"
        text += "\n"
        keyboard.append([InlineKeyboardButton(f"📄 {title[:35]}", callback_data=f"doc:{_short(item['id'])}")])
    keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])

    await update.message.reply_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))
