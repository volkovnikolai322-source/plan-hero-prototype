import logging
import json
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# Вставьте сюда токен вашего бота
BOT_TOKEN = "7569227332:AAGMTQ_-IbL9ZxvYq5j1VuxPGmPkPvpxUks" 
# URL, где будет размещено ваше веб-приложение (важно, чтобы был HTTPS)
WEB_APP_URL = "https://your-username.github.io/plan-hero-prototype/webapp/" 

# Настройка логирования для отладки
logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    button = KeyboardButton(
        text="📊 Открыть мой план",
        web_app=WebAppInfo(url=WEB_APP_URL)
    )
    keyboard = ReplyKeyboardMarkup.from_button(button, resize_keyboard=True)
    await update.message.reply_text(
        "Добро пожаловать в 'План-Герой'!\n\nНажмите кнопку ниже, чтобы открыть ваш дневной план и начать добавлять заказы.",
        reply_markup=keyboard
    )

# Эта функция будет обрабатывать данные, пришедшие от Web App
async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = json.loads(update.message.web_app_data.data)
    await update.message.reply_text(
        f"✅ Заказ принят!\n\n"
        f"Товар: {data['name']}\n"
        f"Очки: +{data['points']}\n\n"
        f"Ваш текущий прогресс обновлен в приложении."
    )

def main():
    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, web_app_data))
    
    logger.info("Бот запущен...")
    application.run_polling()

if __name__ == "__main__":
    main()