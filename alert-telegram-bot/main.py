import os
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from fastapi import FastAPI, Request
import uvicorn

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]

bot = Bot(token=TELEGRAM_BOT_TOKEN, parse_mode=ParseMode.HTML)
dp = Dispatcher()
app = FastAPI()

@app.post("/alert")
async def alert(request: Request):
    data = await request.json()
    alerts = data.get("alerts", [])
    for alert in alerts:
        status = alert.get("status", "unknown").upper()
        name = alert.get("labels", {}).get("alertname", "")
        desc = alert.get("annotations", {}).get("description", "")
        msg = f"<b>{status}</b> <b>{name}</b>\n{desc}"
        await bot.send_message(chat_id=TELEGRAM_CHAT_ID, text=msg)
    return {"ok": True}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081) 