"""Central interactive menu — shown after every action."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes


MAIN_MENU_TEXT = "📄 <b>Kabineo — Was möchtest du tun?</b>"

MAIN_MENU_KEYBOARD = InlineKeyboardMarkup([
    [
        InlineKeyboardButton("📄 Letzte Dokumente", callback_data="menu:recent"),
        InlineKeyboardButton("⭐ Favoriten", callback_data="menu:favorites"),
    ],
    [
        InlineKeyboardButton("🔍 Suchen", callback_data="menu:search"),
        InlineKeyboardButton("📁 Ordner", callback_data="menu:folders"),
    ],
    [
        InlineKeyboardButton("📑 Mehrseitig hochladen", callback_data="menu:merge"),
        InlineKeyboardButton("📁 Neuer Ordner", callback_data="menu:newfolder"),
    ],
    [
        InlineKeyboardButton("🗑 Papierkorb", callback_data="menu:trash"),
        InlineKeyboardButton("🏷 Tags", callback_data="menu:tags"),
    ],
])


async def send_main_menu(update_or_msg, context: ContextTypes.DEFAULT_TYPE, text: str | None = None):
    """Send the main menu. Works with Update, Message, or CallbackQuery."""
    full_text = f"{text}\n\n{MAIN_MENU_TEXT}" if text else MAIN_MENU_TEXT

    # If it's a callback query, edit the message
    if hasattr(update_or_msg, "callback_query") and update_or_msg.callback_query:
        try:
            await update_or_msg.callback_query.edit_message_text(
                full_text, parse_mode="HTML", reply_markup=MAIN_MENU_KEYBOARD,
            )
            return
        except Exception:
            pass

    # If it's an Update with a message
    if hasattr(update_or_msg, "effective_chat"):
        chat_id = update_or_msg.effective_chat.id
    elif hasattr(update_or_msg, "chat"):
        chat_id = update_or_msg.chat.id
    else:
        return

    await context.bot.send_message(
        chat_id=chat_id,
        text=full_text,
        parse_mode="HTML",
        reply_markup=MAIN_MENU_KEYBOARD,
    )
