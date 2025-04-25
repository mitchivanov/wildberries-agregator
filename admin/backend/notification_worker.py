import asyncio
import os
import json
import logging
from datetime import datetime
import aiohttp
import redis.asyncio as aioredis

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('notification_worker')

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
BOT_API_URL = os.getenv("BOT_API_URL", "http://bot:8080")
QUEUE_NAME = "notifications"
DLQ_NAME = "notifications_dlq"
MAX_RETRIES = 5
RETRY_DELAY = 2  # секунд между попытками

async def send_notification_to_bot(notification):
    url = f"{BOT_API_URL}/send_notification"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=notification) as resp:
                text = await resp.text()
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("status") == "success" and data.get("delivery_confirmed", False):
                        logger.info(f"Уведомление успешно доставлено: {notification}")
                        return True
                    # Flood wait обработка по содержимому ответа
                    if "flood" in text.lower() or "wait" in text.lower():
                        wait_time = data.get("retry_after") or 30
                        logger.warning(f"Flood wait от Bot API. Ждём {wait_time} секунд. Ответ: {data}")
                        await asyncio.sleep(int(wait_time))
                        return False
                    else:
                        logger.warning(f"Бот ответил ошибкой: {data}")
                        return False
                elif resp.status == 429:
                    # Flood wait по HTTP статусу
                    retry_after = resp.headers.get("Retry-After")
                    wait_time = int(retry_after) if retry_after and retry_after.isdigit() else 30
                    logger.warning(f"Получен 429 Too Many Requests. Flood wait {wait_time} секунд.")
                    await asyncio.sleep(wait_time)
                    return False
                else:
                    logger.error(f"Ошибка HTTP {resp.status}: {text}")
                    return False
    except Exception as e:
        logger.error(f"Исключение при отправке уведомления: {e}")
        return False

async def process_notification(redis_client, raw_notification):
    try:
        notification = json.loads(raw_notification)
        reservation_id = notification.get("reservation_id")
        if reservation_id:
            sent_key = f"sent_reservation:{reservation_id}"
            already_sent = await redis_client.get(sent_key)
            if already_sent:
                logger.warning(f"Уведомление с reservation_id={reservation_id} уже отправлялось, пропускаем.")
                return
        retries = notification.get("retries", 0)
        logger.info(f"Обработка уведомления: {notification}")
        success = await send_notification_to_bot(notification)
        if success:
            logger.info(f"Уведомление отправлено и удалено из очереди: {notification}")
            if reservation_id:
                await redis_client.set(f"sent_reservation:{reservation_id}", "1", ex=60*60*24)  # 1 день TTL
        else:
            if retries + 1 >= MAX_RETRIES:
                logger.error(f"Достигнут лимит попыток, переносим в DLQ: {notification}")
                notification["failed_at"] = datetime.utcnow().isoformat()
                await redis_client.rpush(DLQ_NAME, json.dumps(notification))
            else:
                notification["retries"] = retries + 1
                logger.warning(f"Повторная попытка отправки через {RETRY_DELAY} сек. Попытка {notification['retries']}/{MAX_RETRIES}")
                await asyncio.sleep(RETRY_DELAY)
                await redis_client.rpush(QUEUE_NAME, json.dumps(notification))
    except Exception as e:
        logger.error(f"Ошибка обработки уведомления: {e}")
        # В случае критической ошибки тоже отправляем в DLQ
        try:
            await redis_client.rpush(DLQ_NAME, raw_notification)
        except Exception as e2:
            logger.critical(f"Ошибка при переносе в DLQ: {e2}")

async def notification_worker():
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    logger.info("Воркер уведомлений запущен. Ожидание новых задач...")
    while True:
        try:
            raw_notification = await redis_client.lpop(QUEUE_NAME)
            if raw_notification:
                await process_notification(redis_client, raw_notification)
            else:
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Ошибка в основном цикле воркера: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(notification_worker()) 