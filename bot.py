print("!!! ЗАПУЩЕНА ТЕСТОВАЯ ВЕРСИЯ БЕЗ JOBQUEUE !!!")

import logging
import json
from config import BOT_TOKEN

# Упрощаем импорты, убираем JobQueue
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
)
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo

# URL вашего веб-приложения
WEB_APP_URL = "https://your-username.github.io/plan-hero-prototype/webapp/"

# Настройка логирования
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    button = KeyboardButton(
        text="📊 Открыть мой план", web_app=WebAppInfo(url=WEB_APP_URL)
    )
    keyboard = ReplyKeyboardMarkup.from_button(button, resize_keyboard=True)
    await update.message.reply_text(
        "Добро пожаловать в 'План-Герой'!",
        reply_markup=keyboard,
    )


async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = json.loads(update.message.web_app_data.data)
    await update.message.reply_text(f"✅ Заказ принят: {data['name']}")


def main():
    # Используем самую простую инициализацию без JobQueue
    application = Application.builder().token(BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(
        MessageHandler(filters.StatusUpdate.WEB_APP_DATA, web_app_data)
    )

    logger.info("Бот запущен...")
    application.run_polling()


if __name__ == "__main__":
    main()
