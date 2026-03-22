import uuid
from html import escape

from sqlalchemy import select
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from app.database import async_session
from app.models.document import Document
from app.models.telegram_link import TelegramLink
from app.services import folder_service
from app.telegram.handlers.menu import send_main_menu


def _short(uid: uuid.UUID) -> str:
    """First 8 chars of UUID — enough for callback_data uniqueness per user."""
    return str(uid)[:8]


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


async def _resolve_id(db, model, short_id: str, owner_id: uuid.UUID):
    """Resolve a short UUID prefix back to a full object."""
    result = await db.execute(
        select(model).where(
            model.owner_id == owner_id,
            model.id.cast(db.bind.dialect.type_descriptor(type(model.id.type)) if False else None) is not None,
        )
    )
    # Simpler: just query all and match prefix
    result = await db.execute(select(model).where(model.owner_id == owner_id))
    for obj in result.scalars().all():
        if str(obj.id).startswith(short_id):
            return obj
    return None


async def _find_by_short_id(db, model, short_id: str, owner_id: uuid.UUID):
    """Find entity by short UUID prefix."""
    from sqlalchemy import cast, String
    result = await db.execute(
        select(model).where(
            model.owner_id == owner_id,
            cast(model.id, String).like(f"{short_id}%"),
        )
    )
    return result.scalar_one_or_none()


async def _find_folder_by_short_id(db, short_id: str, owner_id: uuid.UUID):
    from sqlalchemy import cast, String
    from app.models.folder import Folder
    result = await db.execute(
        select(Folder).where(
            Folder.owner_id == owner_id,
            cast(Folder.id, String).like(f"{short_id}%"),
        )
    )
    return result.scalar_one_or_none()


async def folders_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    async with async_session() as db:
        folders = await folder_service.get_folders(db, uuid.UUID(str(user_id)), parent_id=None)

    if not folders:
        await send_main_menu(update, context, "📁 Keine Ordner vorhanden.\nErstelle einen mit /newfolder &lt;Name&gt;")
        return

    text = "📁 <b>Deine Ordner:</b>\n\n"
    keyboard = []
    for f in folders:
        text += f"• {escape(f.name)}\n"
        keyboard.append([InlineKeyboardButton(f"📁 {f.name}", callback_data=f"f:{_short(f.id)}")])
    keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])

    await update.message.reply_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))


async def newfolder_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    if not context.args:
        await update.message.reply_text("Bitte sende: /newfolder &lt;Ordnername&gt;", parse_mode="HTML")
        return

    name = " ".join(context.args)
    async with async_session() as db:
        await folder_service.create_folder(db, name, uuid.UUID(str(user_id)))

    await send_main_menu(update, context, f"📁 Ordner <b>{escape(name)}</b> erstellt!")


async def move_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        await update.message.reply_text("Bitte verknüpfe zuerst deinen Account mit /link")
        return

    async with async_session() as db:
        result = await db.execute(
            select(Document)
            .where(Document.owner_id == uuid.UUID(str(user_id)))
            .order_by(Document.created_at.desc())
            .limit(10)
        )
        docs = list(result.scalars().all())

    if not docs:
        await send_main_menu(update, context, "Keine Dokumente vorhanden.")
        return

    text = "📄 <b>Welches Dokument verschieben?</b>\n\nWähle ein Dokument:"
    keyboard = []
    for doc in docs:
        label = doc.title[:40] + ("..." if len(doc.title) > 40 else "")
        keyboard.append([InlineKeyboardButton(f"📄 {label}", callback_data=f"md:{_short(doc.id)}")])
    keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])

    await update.message.reply_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))


async def handle_folder_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    user_id = await _get_user_id(update.effective_user.id)
    if not user_id:
        return

    data = query.data
    uid = uuid.UUID(str(user_id))

    # Browse folder: f:<short_id>
    if data.startswith("f:"):
        short_id = data[2:]
        async with async_session() as db:
            folder = await _find_folder_by_short_id(db, short_id, uid)
            if not folder:
                await query.edit_message_text("Ordner nicht gefunden.")
                return

            subfolders = await folder_service.get_folders(db, uid, folder.id)
            result = await db.execute(
                select(Document)
                .where(Document.owner_id == uid, Document.folder_id == folder.id)
                .order_by(Document.created_at.desc())
                .limit(10)
            )
            docs = list(result.scalars().all())

        text = f"📁 <b>{escape(folder.name)}</b>\n\n"
        keyboard = []

        for sf in subfolders:
            keyboard.append([InlineKeyboardButton(f"📁 {sf.name}", callback_data=f"f:{_short(sf.id)}")])
        for doc in docs:
            label = doc.title[:35] + ("..." if len(doc.title) > 35 else "")
            keyboard.append([InlineKeyboardButton(f"📄 {label}", callback_data=f"md:{_short(doc.id)}")])

        if not subfolders and not docs:
            text += "<i>Leer</i>\n"
        text += f"\n{len(docs)} Dokument(e)"

        if folder.parent_id:
            keyboard.append([InlineKeyboardButton("⬆️ Zurück", callback_data=f"f:{_short(folder.parent_id)}")])
        keyboard.append([InlineKeyboardButton("🏠 Stammverzeichnis", callback_data="fr")])
        keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])

        await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

    # Folders root: fr
    elif data == "fr":
        async with async_session() as db:
            folders = await folder_service.get_folders(db, uid, parent_id=None)

        text = "📁 <b>Deine Ordner:</b>\n\n"
        keyboard = []
        for f in folders:
            text += f"• {escape(f.name)}\n"
            keyboard.append([InlineKeyboardButton(f"📁 {f.name}", callback_data=f"f:{_short(f.id)}")])
        keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])

        await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

    # Move step 1: user picked doc, show folder targets: md:<short_doc_id>
    elif data.startswith("md:"):
        short_id = data[3:]
        async with async_session() as db:
            doc = await _find_by_short_id(db, Document, short_id, uid)
            folders = await folder_service.get_folders(db, uid, parent_id=None)

        if not doc:
            await query.edit_message_text("Dokument nicht gefunden.")
            return

        # Store doc id for step 2
        context.user_data["move_doc"] = str(doc.id)

        text = f"📄 <b>{escape(doc.title)}</b>\n\nIn welchen Ordner verschieben?"
        keyboard = [[InlineKeyboardButton("🏠 Stammverzeichnis", callback_data="mt:root")]]
        for f in folders:
            keyboard.append([InlineKeyboardButton(f"📁 {f.name}", callback_data=f"mt:{_short(f.id)}")])
        keyboard.append([InlineKeyboardButton("🏠 Hauptmenü", callback_data="menu:home")])

        await query.edit_message_text(text, parse_mode="HTML", reply_markup=InlineKeyboardMarkup(keyboard))

    # Move step 2: move doc to target folder: mt:<short_folder_id> or mt:root
    elif data.startswith("mt:"):
        target = data[3:]
        doc_id_str = context.user_data.get("move_doc")
        if not doc_id_str:
            await query.edit_message_text("Fehler: Kein Dokument ausgewählt. Starte nochmal mit /move")
            return

        async with async_session() as db:
            result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id_str)))
            doc = result.scalar_one_or_none()
            if not doc:
                await query.edit_message_text("Dokument nicht gefunden.")
                return

            folder_name = "Stammverzeichnis"
            if target == "root":
                doc.folder_id = None
            else:
                folder = await _find_folder_by_short_id(db, target, uid)
                if folder:
                    doc.folder_id = folder.id
                    folder_name = folder.name
                else:
                    await query.edit_message_text("Ordner nicht gefunden.")
                    return

            await db.commit()

        context.user_data.pop("move_doc", None)
        await send_main_menu(
            update, context,
            f"✅ <b>{escape(doc.title)}</b> wurde nach <b>{escape(folder_name)}</b> verschoben!",
        )
