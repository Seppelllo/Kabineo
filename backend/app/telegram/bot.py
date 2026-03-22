import asyncio
import logging

from telegram import Update
from telegram.ext import ApplicationBuilder, CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE):
    logger.error(f"Bot error: {context.error}")
    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text(f"Fehler: {context.error}")
        except Exception:
            pass


def create_bot():
    if not settings.telegram_bot_token or settings.telegram_bot_token == "your-telegram-bot-token":
        logger.warning("Telegram bot token not configured")
        return None

    app = ApplicationBuilder().token(settings.telegram_bot_token).build()
    app.add_error_handler(error_handler)

    from app.telegram.handlers.auth import link_command, start_command
    from app.telegram.handlers.documents import (
        comment_command, favorites_command, handle_comment_text,
        handle_document_callback, recent_command,
        rename_command, share_command, tags_command, trash_command,
    )
    from app.telegram.handlers.folders import folders_command, handle_folder_callback, move_command, newfolder_command
    from app.telegram.handlers.menu import send_main_menu
    from app.telegram.handlers.search import search_command
    from app.telegram.handlers.upload import handle_document, handle_merge_callback, handle_photo, handle_text, merge_command

    # Commands
    for name, handler in [
        ("start", start_command), ("link", link_command), ("search", search_command),
        ("recent", recent_command), ("favorites", favorites_command), ("trash", trash_command),
        ("folders", folders_command), ("newfolder", newfolder_command), ("move", move_command),
        ("rename", rename_command), ("share", share_command), ("tags", tags_command),
        ("merge", merge_command), ("comment", comment_command),
    ]:
        app.add_handler(CommandHandler(name, handler))

    # Menu callback handler
    async def handle_menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
        query = update.callback_query
        await query.answer()

        action = query.data.removeprefix("menu:")

        if action == "home":
            await send_main_menu(update, context)

        elif action == "recent":
            # Inline version of recent_command for callback queries
            from app.telegram.handlers.documents import _get_user_id, _short, _format_size
            from app.telegram.handlers.menu import MAIN_MENU_KEYBOARD
            uid = await _get_user_id(update.effective_user.id)
            if not uid:
                await query.edit_message_text("Bitte verknüpfe zuerst deinen Account mit /link")
                return
            from app.database import async_session
            from app.services import document_service
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            from html import escape
            async with async_session() as db:
                docs, total = await document_service.get_documents(db, owner_id=uid, page_size=10)
            if not docs:
                await send_main_menu(update, context, "📄 Keine Dokumente vorhanden.")
                return
            text = f"📄 <b>Letzte Dokumente</b> ({total} gesamt):\n\n"
            keyboard = []
            for d in docs:
                text += f"• {escape(d.title)} ({_format_size(d.file_size)})\n"
                keyboard.append([InlineKeyboardButton(f"📄 {d.title[:35]}", callback_data=f"doc:{_short(d.id)}")])
            keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])
            await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

        elif action == "favorites":
            from app.telegram.handlers.documents import _get_user_id, _short
            uid = await _get_user_id(update.effective_user.id)
            if not uid:
                await query.edit_message_text("Bitte verknüpfe zuerst deinen Account mit /link")
                return
            from app.database import async_session
            from app.services import document_service
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            from html import escape
            async with async_session() as db:
                docs, total = await document_service.get_documents(db, owner_id=uid, favorites_only=True, page_size=10)
            if not docs:
                await send_main_menu(update, context, "⭐ Keine Favoriten vorhanden.")
                return
            text = f"⭐ <b>Favoriten</b> ({total}):\n\n"
            keyboard = []
            for d in docs:
                text += f"• {escape(d.title)}\n"
                keyboard.append([InlineKeyboardButton(f"⭐ {d.title[:35]}", callback_data=f"doc:{_short(d.id)}")])
            keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])
            await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

        elif action == "search":
            context.user_data["awaiting_search_query"] = True
            await query.edit_message_text(
                "🔍 <b>Suche</b>\n\nSende deinen Suchbegriff als nächste Nachricht:",
                parse_mode="HTML",
            )

        elif action == "folders":
            from app.telegram.handlers.folders import _get_user_id, _short
            uid = await _get_user_id(update.effective_user.id)
            if not uid:
                await query.edit_message_text("Bitte verknüpfe zuerst deinen Account mit /link")
                return
            import uuid as _uuid
            from app.database import async_session
            from app.services import folder_service
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            from html import escape
            async with async_session() as db:
                folders = await folder_service.get_folders(db, _uuid.UUID(str(uid)), parent_id=None)
            if not folders:
                await send_main_menu(update, context, "📁 Keine Ordner vorhanden.\nErstelle einen mit /newfolder &lt;Name&gt;")
                return
            text = "📁 <b>Deine Ordner:</b>\n\n"
            keyboard = []
            for f in folders:
                text += f"• {escape(f.name)}\n"
                keyboard.append([InlineKeyboardButton(f"📁 {f.name}", callback_data=f"f:{_short(f.id)}")])
            keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])
            await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

        elif action == "merge":
            context.user_data["awaiting_merge_title"] = True
            await query.edit_message_text(
                "📑 <b>Mehrseitiges Dokument erstellen</b>\n\n"
                "Wie soll das Dokument heißen? Sende den Titel als nächste Nachricht:",
                parse_mode="HTML",
            )

        elif action == "newfolder":
            context.user_data["awaiting_folder_name"] = True
            await query.edit_message_text(
                "📁 <b>Neuer Ordner</b>\n\nSende den Ordnernamen als nächste Nachricht:",
                parse_mode="HTML",
            )

        elif action == "trash":
            from app.telegram.handlers.documents import _get_user_id, _short
            uid = await _get_user_id(update.effective_user.id)
            if not uid:
                await query.edit_message_text("Bitte verknüpfe zuerst deinen Account mit /link")
                return
            from app.database import async_session
            from app.services import document_service
            from telegram import InlineKeyboardButton, InlineKeyboardMarkup
            from html import escape
            async with async_session() as db:
                docs, total = await document_service.get_documents(db, owner_id=uid, trash=True, page_size=10)
            if not docs:
                await send_main_menu(update, context, "🗑 Papierkorb ist leer.")
                return
            text = f"🗑 <b>Papierkorb</b> ({total}):\n\n"
            keyboard = []
            for d in docs:
                text += f"• {escape(d.title)}\n"
                keyboard.append([
                    InlineKeyboardButton(f"♻️ {d.title[:25]}", callback_data=f"rest:{_short(d.id)}"),
                    InlineKeyboardButton("❌", callback_data=f"perm:{_short(d.id)}"),
                ])
            keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])
            await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

        elif action == "tags":
            from app.telegram.handlers.documents import _get_user_id
            uid = await _get_user_id(update.effective_user.id)
            if not uid:
                await query.edit_message_text("Bitte verknüpfe zuerst deinen Account mit /link")
                return
            from app.database import async_session
            from app.models.tag import Tag
            from sqlalchemy import select
            from html import escape
            async with async_session() as db:
                result = await db.execute(select(Tag).order_by(Tag.name))
                tags = list(result.scalars().all())
            if not tags:
                await send_main_menu(update, context, "🏷 Keine Tags vorhanden.")
                return
            text = "🏷 <b>Deine Tags:</b>\n\n"
            for t in tags:
                text += f"• {escape(t.name)}\n"
            text += "\n"
            from app.telegram.handlers.menu import MAIN_MENU_TEXT, MAIN_MENU_KEYBOARD
            text += "\n" + MAIN_MENU_TEXT
            await query.edit_message_text(text, parse_mode="HTML", reply_markup=MAIN_MENU_KEYBOARD)

    # Callbacks — order matters: menu first, then merge, then doc actions, then folder actions
    app.add_handler(CallbackQueryHandler(handle_menu_callback, pattern=r"^menu:"))
    app.add_handler(CallbackQueryHandler(handle_merge_callback, pattern=r"^merge:"))
    app.add_handler(CallbackQueryHandler(handle_document_callback, pattern=r"^(doc:|dl:|fav:|del:|rest:|perm:|shr:|tag:|tt:|cmt:|back:)"))
    app.add_handler(CallbackQueryHandler(handle_folder_callback, pattern=r"^(f:|fr|md:|mt:)"))

    # Unified text handler — checks comment first, then menu flags, then merge title
    async def unified_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
        handled = await handle_comment_text(update, context)
        if not handled:
            await handle_text(update, context)

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, unified_text_handler))

    # File uploads
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    logger.info(f"Bot created with {len(app.handlers[0])} handlers")
    return app


if __name__ == "__main__":
    bot = create_bot()
    if bot:
        logger.info("Starting polling...")
        bot.run_polling()
    else:
        logger.info("Bot not configured, sleeping...")
        asyncio.get_event_loop().run_forever()
