import os
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from fastapi import FastAPI, Request
import uvicorn
import logging

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

bot = Bot(token=TELEGRAM_BOT_TOKEN, parse_mode=ParseMode.HTML)
dp = Dispatcher()
app = FastAPI()

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("alert-telegram-bot")

@app.on_event("startup")
async def startup_event():
    logger.info("Alert-Telegram-Bot запущен и готов принимать алерты.")

@app.post("/alert")
async def alertmanager_webhook(alert: dict):
    logger.info(f"Получен алерт: {alert}")
    try:
        alerts = alert.get("alerts", [])
        for a in alerts:
            status = a.get("status")
            labels = a.get("labels", {})
            annotations = a.get("annotations", {})
            message = f"*{labels.get('alertname', 'Alert')}*\nСтатус: {status}\n{annotations.get('summary', '')}\n{annotations.get('description', '')}"
            try:
                await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=message, parse_mode="Markdown")
                logger.info(f"Успешно отправлено в Telegram: {message}")
            except Exception as e:
                logger.error(f"Ошибка при отправке в Telegram: {e}")
        return {"ok": True}
    except Exception as e:
        logger.exception(f"Ошибка обработки алерта: {e}")
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081) 