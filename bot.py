import logging
import json
from config import BOT_TOKEN  # Импортируем токен из config.py

# Обновляем импорты: добавляем JobQueue
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    JobQueue,
)
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from pytz import timezone  # Добавляем импорт для часовых поясов

# ВАЖНО: Укажите URL, где размещено ваше веб-приложение (например, с GitHub Pages)
WEB_APP_URL = "https://your-username.github.io/plan-hero-prototype/webapp/"

# Настройка логирования для отладки
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отправляет приветственное сообщение с кнопкой для запуска Web App."""
    button = KeyboardButton(
        text="📊 Открыть мой план", web_app=WebAppInfo(url=WEB_APP_URL)
    )
    keyboard = ReplyKeyboardMarkup.from_button(button, resize_keyboard=True)
    await update.message.reply_text(
        "Добро пожаловать в 'План-Герой'!\n\nНажмите кнопку ниже, чтобы открыть ваш дневной план и начать добавлять заказы.",
        reply_markup=keyboard,
    )


async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обрабатывает данные, полученные от Web App, и отправляет подтверждение."""
    data = json.loads(update.message.web_app_data.data)
    await update.message.reply_text(
        f"✅ Заказ принят!\n\n"
        f"Товар: {data['name']}\n"
        f"Очки: +{data['points']}\n\n"
        f"Ваш текущий прогресс обновлен в приложении."
    )


def main():
    """Основная функция для запуска бота."""

    # --- НАЧАЛО ИЗМЕНЕНИЙ ---

    # Создаем очередь задач с явно указанным часовым поясом, чтобы избежать ошибки
    job_queue = JobQueue()
    job_queue.scheduler.timezone = timezone("Europe/Moscow")

    # Собираем приложение, передавая ему созданную очередь задач
    application = Application.builder().token(BOT_TOKEN).job_queue(job_queue).build()

    # --- КОНЕЦ ИЗМЕНЕНИЙ ---

    # Регистрируем обработчики команд
    application.add_handler(CommandHandler("start", start))
    application.add_handler(
        MessageHandler(filters.StatusUpdate.WEB_APP_DATA, web_app_data)
    )

    logger.info("Бот запущен...")
    # Запускаем бота
    application.run_polling()


if __name__ == "__main__":
    main()
