"""Full document management via Telegram: recent, download, delete, rename, favorite, tags, share, trash, comments."""
import uuid
from html import escape

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.database import async_session
from app.models.comment import Comment as CommentModel
from app.models.document import Document
from app.models.tag import Tag
from app.models.telegram_link import TelegramLink
from app.services import document_service, share_service
from app.telegram.handlers.menu import send_main_menu


def _short(uid) -> str:
    return str(uid)[:8]


async def _get_user_id(telegram_user_id: int):
    async with async_session() as db:
        result = await db.execute(
            select(TelegramLink).where(
                TelegramLink.telegram_user_id == telegram_user_id,
                TelegramLink.is_verified == True,
            )
        )
        link = result.scalar_one_or_none()
        return uuid.UUID(str(link.user_id)) if link else None


async def _find_doc(db, short_id: str, owner_id):
    from sqlalchemy import cast, String
    result = await db.execute(
        select(Document).options(selectinload(Document.tags))
        .where(Document.owner_id == owner_id, cast(Document.id, String).like(f"{short_id}%"))
    )
    return result.scalar_one_or_none()


async def _find_tag(db, short_id: str):
    from sqlalchemy import cast, String
    result = await db.execute(select(Tag).where(cast(Tag.id, String).like(f"{short_id}%")))
    return result.scalar_one_or_none()


def _format_size(b: int) -> str:
    if b < 1024: return f"{b} B"
    if b < 1024 * 1024: return f"{b / 1024:.1f} KB"
    return f"{b / 1024 / 1024:.1f} MB"


# /recent — list last 10 documents
async def recent_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

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

    await update.message.reply_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))


# /favorites
async def favorites_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

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

    await update.message.reply_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))


# /trash
async def trash_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

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

    await update.message.reply_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))


# /tags — list all tags
async def tags_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    async with async_session() as db:
        result = await db.execute(select(Tag).order_by(Tag.name))
        tags = list(result.scalars().all())

    if not tags:
        await send_main_menu(update, context, "🏷 Keine Tags vorhanden.")
        return

    text = "🏷 <b>Deine Tags:</b>\n\n"
    for t in tags:
        text += f"• {escape(t.name)}\n"

    await update.message.reply_text(text, parse_mode="HTML")


# /rename <name> — rename last uploaded or specify via callback
async def rename_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    if not context.args:
        await update.message.reply_text("Bitte sende: /rename &lt;Neuer Name&gt;\n\nWähle zuerst ein Dokument über /recent aus.", parse_mode="HTML")
        return

    doc_id_str = context.user_data.get("selected_doc")
    if not doc_id_str:
        await update.message.reply_text("Wähle zuerst ein Dokument aus (/recent), dann nutze /rename.")
        return

    new_title = " ".join(context.args)
    async with async_session() as db:
        doc = await document_service.get_document(db, uuid.UUID(doc_id_str))
        if not doc or doc.owner_id != uid:
            await update.message.reply_text("Dokument nicht gefunden.")
            return
        await document_service.update_document(db, doc, title=new_title)

    await send_main_menu(update, context, f"✅ Dokument umbenannt zu <b>{escape(new_title)}</b>")


# /share — create share link for selected doc
async def share_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    doc_id_str = context.user_data.get("selected_doc")
    if not doc_id_str:
        await update.message.reply_text("Wähle zuerst ein Dokument aus (/recent), dann nutze /share.")
        return

    async with async_session() as db:
        doc = await document_service.get_document(db, uuid.UUID(doc_id_str))
        if not doc or doc.owner_id != uid:
            await update.message.reply_text("Dokument nicht gefunden.")
            return
        link = await share_service.create_share_link(db, doc.id, uid, expires_in_hours=72)

    # Build share URL
    from app.config import settings
    base_url = "http://localhost:3000"  # Could be configurable
    share_url = f"{base_url}/shared/{link.token}"

    await send_main_menu(
        update, context,
        f"🔗 <b>Share-Link für:</b> {escape(doc.title)}\n\n"
        f"<code>{share_url}</code>\n\n"
        f"Gültig für 72 Stunden.",
    )


# /comment — add comment to selected document
async def comment_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    doc_id_str = context.user_data.get("selected_doc")
    if not doc_id_str:
        await update.message.reply_text("Wähle zuerst ein Dokument aus (/recent), dann nutze /comment.")
        return

    if not context.args:
        context.user_data["comment_doc"] = doc_id_str[:8]
        await update.message.reply_text("💬 Sende deinen Kommentar als nächste Nachricht:")
        return

    text = " ".join(context.args)
    async with async_session() as db:
        comment = CommentModel(document_id=uuid.UUID(doc_id_str), user_id=uid, text=text)
        db.add(comment)
        await db.commit()

    await send_main_menu(update, context, "💬 Kommentar gespeichert!")


async def handle_comment_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle plain text when waiting for a comment."""
    comment_doc = context.user_data.get("comment_doc")
    if not comment_doc:
        return False  # Not waiting for comment

    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        return False

    text = update.message.text.strip()
    if not text:
        return False

    context.user_data.pop("comment_doc", None)

    async with async_session() as db:
        doc = await _find_doc(db, comment_doc, uid)
        if not doc:
            await update.message.reply_text("Dokument nicht gefunden.")
            return True

        comment = CommentModel(document_id=doc.id, user_id=uid, text=text)
        db.add(comment)
        await db.commit()

    await send_main_menu(update, context, f"💬 Kommentar zu <b>{escape(doc.title)}</b> gespeichert!")
    return True


# Callback handler for document actions
async def handle_document_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    uid = await _get_user_id(update.effective_user.id)
    if not uid:
        return

    data = query.data

    # View document detail: doc:<short_id>
    if data.startswith("doc:"):
        short_id = data[4:]
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return

        # Store selected doc for subsequent commands
        context.user_data["selected_doc"] = str(doc.id)

        tags_str = ", ".join(escape(t.name) for t in doc.tags) if doc.tags else "Keine"
        fav = "⭐ " if doc.is_favorite else ""
        ocr = {"completed": "✅ Fertig", "processing": "⏳ Läuft", "pending": "⏳ Ausstehend", "failed": "❌ Fehler"}.get(doc.ocr_status, doc.ocr_status)

        text = (
            f"{fav}📄 <b>{escape(doc.title)}</b>\n\n"
            f"📁 Datei: <code>{escape(doc.filename)}</code>\n"
            f"📏 Größe: {_format_size(doc.file_size)}\n"
            f"📋 Version: v{doc.current_version}\n"
            f"🔍 OCR: {ocr}\n"
            f"🏷 Tags: {tags_str}\n"
            f"📅 Erstellt: {doc.created_at.strftime('%d.%m.%Y %H:%M')}\n"
        )

        keyboard = [
            [
                InlineKeyboardButton("📥 Download", callback_data=f"dl:{_short(doc.id)}"),
                InlineKeyboardButton("⭐" if not doc.is_favorite else "★ Entfernen", callback_data=f"fav:{_short(doc.id)}"),
            ],
            [
                InlineKeyboardButton("🔗 Teilen", callback_data=f"shr:{_short(doc.id)}"),
                InlineKeyboardButton("🏷 Taggen", callback_data=f"tag:{_short(doc.id)}"),
            ],
            [
                InlineKeyboardButton("💬 Kommentar", callback_data=f"cmt:{_short(doc.id)}"),
                InlineKeyboardButton("🗑 Löschen", callback_data=f"del:{_short(doc.id)}"),
            ],
            [
                InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home"),
            ],
        ]

        await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

    # Download: dl:<short_id>
    elif data.startswith("dl:"):
        short_id = data[3:]
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return
            try:
                content = await document_service.download_document(doc)
            except FileNotFoundError:
                await query.edit_message_text("Datei nicht im Storage gefunden.")
                return

        from io import BytesIO
        await query.message.reply_document(
            document=BytesIO(content),
            filename=doc.filename,
            caption=f"📄 {doc.title}",
        )

    # Toggle favorite: fav:<short_id>
    elif data.startswith("fav:"):
        short_id = data[4:]
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return
            was_favorite = doc.is_favorite
            await document_service.update_document(db, doc, is_favorite=not doc.is_favorite)
            status = "zu Favoriten hinzugefügt" if not was_favorite else "aus Favoriten entfernt"

        await send_main_menu(update, context, f"⭐ <b>{escape(doc.title)}</b> {status}!")

    # Delete (soft): del:<short_id>
    elif data.startswith("del:"):
        short_id = data[4:]
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return
            await document_service.soft_delete_document(db, doc)

        await send_main_menu(update, context, f"🗑 <b>{escape(doc.title)}</b> in den Papierkorb verschoben.")

    # Restore from trash: rest:<short_id>
    elif data.startswith("rest:"):
        short_id = data[5:]
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return
            await document_service.restore_document(db, doc)

        await send_main_menu(update, context, f"♻️ <b>{escape(doc.title)}</b> wiederhergestellt!")

    # Permanent delete: perm:<short_id>
    elif data.startswith("perm:"):
        short_id = data[5:]
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return
            name = doc.title
            await document_service.permanent_delete_document(db, doc)

        await send_main_menu(update, context, f"❌ <b>{escape(name)}</b> endgültig gelöscht.")

    # Share link: shr:<short_id>
    elif data.startswith("shr:"):
        short_id = data[4:]
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return
            link = await share_service.create_share_link(db, doc.id, uid, expires_in_hours=72)

        share_url = f"http://localhost:3000/shared/{link.token}"
        await send_main_menu(
            update, context,
            f"🔗 <b>Share-Link für {escape(doc.title)}:</b>\n\n<code>{share_url}</code>\n\nGültig für 72 Stunden.",
        )

    # Tag document — show tag picker: tag:<short_id>
    elif data.startswith("tag:"):
        short_id = data[4:]
        context.user_data["tag_doc"] = short_id

        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)
            tags_result = await db.execute(select(Tag).order_by(Tag.name))
            all_tags = list(tags_result.scalars().all())

        if not doc:
            await query.edit_message_text("Dokument nicht gefunden.")
            return

        current_ids = {str(t.id) for t in doc.tags}
        text = f"🏷 <b>Tags für {escape(doc.title)}:</b>\n\nTippe auf einen Tag zum Hinzufügen/Entfernen:"
        keyboard = []
        for t in all_tags:
            is_set = str(t.id) in current_ids
            label = f"{'✅' if is_set else '◻️'} {t.name}"
            keyboard.append([InlineKeyboardButton(label, callback_data=f"tt:{_short(t.id)}")])
        keyboard.append([InlineKeyboardButton("✅ Fertig", callback_data=f"doc:{short_id}")])

        await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

    # Toggle tag: tt:<short_tag_id>
    elif data.startswith("tt:"):
        short_tag_id = data[3:]
        doc_short = context.user_data.get("tag_doc")
        if not doc_short:
            await query.edit_message_text("Fehler. Starte nochmal über /recent.")
            return

        async with async_session() as db:
            doc = await _find_doc(db, doc_short, uid)
            tag = await _find_tag(db, short_tag_id)
            if not doc or not tag:
                await query.edit_message_text("Nicht gefunden.")
                return

            current_ids = [str(t.id) for t in doc.tags]
            if str(tag.id) in current_ids:
                new_ids = [uuid.UUID(tid) for tid in current_ids if tid != str(tag.id)]
            else:
                new_ids = [uuid.UUID(tid) for tid in current_ids] + [tag.id]

            await document_service.update_document(db, doc, tag_ids=new_ids)

            # Refresh doc
            doc = await _find_doc(db, doc_short, uid)
            all_tags_result = await db.execute(select(Tag).order_by(Tag.name))
            all_tags = list(all_tags_result.scalars().all())

        current_ids_set = {str(t.id) for t in doc.tags}
        text = f"🏷 <b>Tags für {escape(doc.title)}:</b>\n\nTippe auf einen Tag zum Hinzufügen/Entfernen:"
        keyboard = []
        for t in all_tags:
            is_set = str(t.id) in current_ids_set
            label = f"{'✅' if is_set else '◻️'} {t.name}"
            keyboard.append([InlineKeyboardButton(label, callback_data=f"tt:{_short(t.id)}")])
        keyboard.append([InlineKeyboardButton("✅ Fertig", callback_data=f"doc:{doc_short}")])

        await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

    # Comment prompt: cmt:<short_id>
    elif data.startswith("cmt:"):
        short_id = data[4:]
        context.user_data["comment_doc"] = short_id
        async with async_session() as db:
            doc = await _find_doc(db, short_id, uid)

        if not doc:
            await query.edit_message_text("Dokument nicht gefunden.")
            return

        # Show existing comments + prompt
        from app.models.comment import Comment as CommentModel
        async with async_session() as db:
            from sqlalchemy.orm import selectinload
            result = await db.execute(
                select(CommentModel).where(CommentModel.document_id == doc.id).order_by(CommentModel.created_at.desc()).limit(5)
            )
            comments = list(result.scalars().all())

        text = f"💬 <b>Kommentare für {escape(doc.title)}:</b>\n\n"
        if comments:
            for c in reversed(comments):
                ts = c.created_at.strftime("%d.%m. %H:%M")
                text += f"<i>{ts}:</i> {escape(c.text)}\n"
        else:
            text += "<i>Noch keine Kommentare.</i>\n"

        text += "\nSende jetzt deinen Kommentar als Nachricht:"

        keyboard = [[InlineKeyboardButton("↩️ Zurück", callback_data=f"doc:{short_id}")]]
        await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

    # Back to recent list → show main menu instead
    elif data == "back:recent":
        await send_main_menu(update, context)
