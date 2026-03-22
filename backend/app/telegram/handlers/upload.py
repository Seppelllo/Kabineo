import io
import logging
import uuid
from html import escape

from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.database import async_session
from app.models.document import Document
from app.models.telegram_link import TelegramLink
from app.models.version import DocumentVersion
from app.services import document_service
from app.telegram.handlers.menu import send_main_menu

logger = logging.getLogger(__name__)


async def _get_user_id(telegram_user_id: int) -> uuid.UUID | None:
    async with async_session() as db:
        result = await db.execute(
            select(TelegramLink).where(
                TelegramLink.telegram_user_id == telegram_user_id,
                TelegramLink.is_verified == True,
            )
        )
        link = result.scalar_one_or_none()
        return link.user_id if link else None


def _trigger_tasks(doc_id: str):
    try:
        from app.workers.ocr_tasks import process_ocr
        from app.workers.scan_tasks import process_document_scan
        from app.workers.thumbnail_tasks import generate_thumbnail
        chain = process_document_scan.si(doc_id) | process_ocr.si(doc_id) | generate_thumbnail.si(doc_id)
        chain.apply_async()
    except Exception:
        pass


def _format_size(b: int) -> str:
    if b < 1024: return f"{b} B"
    if b < 1024 * 1024: return f"{b / 1024:.1f} KB"
    return f"{b / 1024 / 1024:.1f} MB"


def _merge_status_text(context: ContextTypes.DEFAULT_TYPE) -> str:
    title = escape(context.user_data.get("merge_title", "Dokument"))
    files = context.user_data.get("merge_files", [])
    total = sum(len(f[0]) for f in files)

    text = f"📑 <b>{title}</b>\n\n"
    if files:
        for i, (data, name, mime) in enumerate(files):
            text += f"  {i + 1}. {escape(name)} ({_format_size(len(data))})\n"
        text += f"\n📊 {len(files)} Seite(n) · {_format_size(total)}\n"
        text += "\nSende weitere Dateien/Fotos oder wähle:"
    else:
        text += "Sende jetzt Dateien oder Fotos.\nJede Datei wird eine Seite."

    return text


def _merge_keyboard(files_count: int) -> InlineKeyboardMarkup:
    buttons = []
    if files_count > 0:
        buttons.append([
            InlineKeyboardButton(f"✅ Fertig ({files_count} Seiten)", callback_data="merge:done"),
        ])
    buttons.append([
        InlineKeyboardButton("❌ Abbrechen", callback_data="merge:cancel"),
    ])
    return InlineKeyboardMarkup(buttons)


# --- /merge starts interactive mode ---

async def merge_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"merge_command called, args={context.args}")
    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    if context.args:
        # Title provided directly
        title = " ".join(context.args)
        _start_merge(context, title)
        msg = await update.message.reply_text(
            _merge_status_text(context),
            parse_mode="HTML",
            reply_markup=_merge_keyboard(0),
        )
        context.user_data["merge_msg_id"] = msg.message_id
    else:
        # No title — ask for it interactively
        context.user_data["merge_awaiting_title"] = True
        await update.message.reply_text(
            "📑 <b>Mehrseitiges Dokument erstellen</b>\n\n"
            "Wie soll das Dokument heißen? Sende den Titel als nächste Nachricht:",
            parse_mode="HTML",
        )


def _start_merge(context: ContextTypes.DEFAULT_TYPE, title: str):
    context.user_data["merge_mode"] = True
    context.user_data["merge_title"] = title
    context.user_data["merge_files"] = []
    context.user_data["merge_msg_id"] = None
    context.user_data.pop("merge_awaiting_title", None)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle plain text messages — used for merge title, search query, folder name, merge title from menu."""
    text = update.message.text.strip()
    if not text:
        return

    # Check menu-triggered awaiting flags first
    if context.user_data.get("awaiting_search_query"):
        context.user_data.pop("awaiting_search_query", None)
        # Simulate search command
        from app.telegram.handlers.search import search_command
        context.args = text.split()
        await search_command(update, context)
        context.args = None
        return

    if context.user_data.get("awaiting_folder_name"):
        context.user_data.pop("awaiting_folder_name", None)
        # Simulate newfolder command
        from app.telegram.handlers.folders import newfolder_command
        context.args = text.split()
        await newfolder_command(update, context)
        context.args = None
        return

    if context.user_data.get("awaiting_merge_title"):
        context.user_data.pop("awaiting_merge_title", None)
        _start_merge(context, text)
        msg = await update.message.reply_text(
            _merge_status_text(context),
            parse_mode="HTML",
            reply_markup=_merge_keyboard(0),
        )
        context.user_data["merge_msg_id"] = msg.message_id
        return

    # Original merge title awaiting logic
    if context.user_data.get("merge_awaiting_title"):
        _start_merge(context, text)
        msg = await update.message.reply_text(
            _merge_status_text(context),
            parse_mode="HTML",
            reply_markup=_merge_keyboard(0),
        )
        context.user_data["merge_msg_id"] = msg.message_id
        return

    # Not waiting for anything — ignore
    return


async def _update_merge_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg_id = context.user_data.get("merge_msg_id")
    chat_id = update.effective_chat.id
    files = context.user_data.get("merge_files", [])

    if msg_id:
        try:
            await context.bot.edit_message_text(
                chat_id=chat_id,
                message_id=msg_id,
                text=_merge_status_text(context),
                parse_mode="HTML",
                reply_markup=_merge_keyboard(len(files)),
            )
        except Exception:
            msg = await context.bot.send_message(
                chat_id=chat_id,
                text=_merge_status_text(context),
                parse_mode="HTML",
                reply_markup=_merge_keyboard(len(files)),
            )
            context.user_data["merge_msg_id"] = msg.message_id


async def handle_merge_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        return

    data = query.data

    if data == "merge:cancel":
        count = len(context.user_data.get("merge_files", []))
        context.user_data.pop("merge_mode", None)
        context.user_data.pop("merge_title", None)
        context.user_data.pop("merge_files", None)
        context.user_data.pop("merge_msg_id", None)
        await send_main_menu(update, context, f"❌ Sammel-Modus abgebrochen. {count} Datei(en) verworfen.")

    elif data == "merge:done":
        files = context.user_data.get("merge_files", [])
        title = context.user_data.get("merge_title", "Mehrseitiges Dokument")

        if not files:
            await query.edit_message_text("Keine Dateien gesammelt. Starte nochmal mit /merge.")
            return

        context.user_data.pop("merge_mode", None)
        context.user_data.pop("merge_title", None)
        context.user_data.pop("merge_files", None)
        context.user_data.pop("merge_msg_id", None)

        await query.edit_message_text(
            f"⏳ Erstelle <b>{escape(title)}</b> aus {len(files)} Seite(n)...",
            parse_mode="HTML",
        )

        from app.storage import get_storage_backend
        storage = get_storage_backend()

        doc_id = uuid.uuid4()
        uid = uuid.UUID(str(user_id))
        total_size = 0
        page_keys = []

        for i, (file_data, filename, mime_type) in enumerate(files):
            key = f"{uid}/{doc_id}/pages/{i + 1}_{filename}"
            await storage.put(key, io.BytesIO(file_data), mime_type)
            page_keys.append(key)
            total_size += len(file_data)

        async with async_session() as db:
            doc = Document(
                id=doc_id,
                title=title,
                description=f"Mehrseitiges Dokument ({len(files)} Seiten) via Telegram",
                filename=f"{title}.multi",
                mime_type=files[0][2],
                file_size=total_size,
                storage_key=page_keys[0],
                folder_id=None,
                owner_id=uid,
                page_count=len(files),
                custom_metadata={"page_keys": page_keys, "source": "telegram_merge"},
            )
            db.add(doc)

            version = DocumentVersion(
                document_id=doc_id,
                version_number=1,
                storage_key=page_keys[0],
                file_size=total_size,
                uploaded_by=uid,
                comment=f"Telegram Merge: {len(files)} Seiten",
            )
            db.add(version)
            await db.commit()

        _trigger_tasks(str(doc_id))

        await send_main_menu(
            update, context,
            f"✅ <b>{escape(title)}</b> erstellt!\n\n"
            f"📄 {len(files)} Seite(n) · {_format_size(total_size)}\n"
            f"🔍 OCR wird verarbeitet...",
        )


# --- Regular upload handlers (with merge mode support) ---

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    doc = update.message.document
    file = await context.bot.get_file(doc.file_id)
    data = await file.download_as_bytearray()

    if context.user_data.get("merge_mode"):
        files = context.user_data.get("merge_files", [])
        files.append((bytes(data), doc.file_name or f"datei_{len(files) + 1}", doc.mime_type or "application/octet-stream"))
        context.user_data["merge_files"] = files
        await update.message.reply_text(f"📎 Seite {len(files)}: {escape(doc.file_name or 'Datei')}", parse_mode="HTML")
        await _update_merge_message(update, context)
        return

    async with async_session() as db:
        result = await document_service.upload_document(
            db=db,
            owner_id=uuid.UUID(str(user_id)),
            file_data=io.BytesIO(data),
            filename=doc.file_name or "telegram_upload",
            mime_type=doc.mime_type or "application/octet-stream",
            file_size=doc.file_size or len(data),
        )

    _trigger_tasks(str(result.id))
    await send_main_menu(update, context, f"✅ <b>{escape(result.title)}</b> hochgeladen!")


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    photo = update.message.photo[-1]
    file = await context.bot.get_file(photo.file_id)
    data = await file.download_as_bytearray()

    if context.user_data.get("merge_mode"):
        files = context.user_data.get("merge_files", [])
        filename = f"seite_{len(files) + 1}.jpg"
        files.append((bytes(data), filename, "image/jpeg"))
        context.user_data["merge_files"] = files
        await update.message.reply_text(f"📎 Seite {len(files)}: Foto")
        await _update_merge_message(update, context)
        return

    async with async_session() as db:
        result = await document_service.upload_document(
            db=db,
            owner_id=uuid.UUID(str(user_id)),
            file_data=io.BytesIO(data),
            filename=f"photo_{photo.file_unique_id}.jpg",
            mime_type="image/jpeg",
            file_size=len(data),
        )

    _trigger_tasks(str(result.id))
    await send_main_menu(update, context, f"✅ <b>{escape(result.title)}</b> hochgeladen!")
