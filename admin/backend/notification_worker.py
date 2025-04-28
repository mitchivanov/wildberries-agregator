import asyncio
import os
import json
import logging
from datetime import datetime
import aiohttp
import redis.asyncio as aioredis
import re

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
RETRY_DELAY = 5  # секунд между попытками
REDIS_RETRIES = 5  # Количество попыток при ошибке Redis
REDIS_RETRY_DELAY = 5  # Базовая задержка между попытками (сек)

async def is_image_url_valid(url):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.head(url, timeout=5) as resp:
                return resp.status == 200
    except Exception as e:
        logger.warning(f"Image URL validation failed: {url}, error: {e}")
        return False

async def send_notification_to_bot(notification, allow_payload_correction=True):
    url = f"{BOT_API_URL}/send_notification"
    logger.info(f"Sending payload to bot: {json.dumps(notification, ensure_ascii=False)}")
    goods_data = notification.get("goods_data", {})
    image_url = goods_data.get("image")
    if image_url:
        valid = await is_image_url_valid(image_url)
        if not valid:
            logger.warning(f"Image URL is not valid, removing from payload: {image_url}")
            goods_data.pop("image", None)
    notification["disable_web_page_preview"] = True
    text_fields = [goods_data.get("purchase_guide", ""), goods_data.get("name", "")]
    for text in text_fields:
        if re.search(r'<[^>]+>', text):
            logger.warning(f"Possible HTML in text: {text}")
        if re.search(r'[`*_]', text):
            logger.warning(f"Possible markdown in text: {text}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=notification) as resp:
                text = await resp.text()
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("status") == "success" and data.get("delivery_confirmed", False):
                        logger.info(f"Notification delivered: {notification}")
                        return True
                    if "flood" in text.lower() or "wait" in text.lower():
                        wait_time = data.get("retry_after") or 30
                        logger.warning(f"Flood wait from Bot API. Waiting {wait_time} seconds. Response: {data}")
                        await asyncio.sleep(int(wait_time))
                        return False
                    else:
                        logger.warning(f"Bot API error: {data}. Payload: {json.dumps(notification, ensure_ascii=False)}")
                        # --- CORRECT PAYLOAD IF POSSIBLE ---
                        if allow_payload_correction:
                            corrected = False
                            # 1. Удаляем image, если есть подозрение на web page content
                            if goods_data.get("image") and "web page content" in str(data).lower():
                                logger.warning("Removing image field due to web page content error and retrying...")
                                goods_data.pop("image", None)
                                corrected = True
                            # 2. Удаляем markdown/html из текста
                            for key in ["purchase_guide", "name"]:
                                if key in goods_data:
                                    clean = re.sub(r'<[^>]+>', '', goods_data[key])
                                    clean = re.sub(r'[`*_\[\]]', '', clean)
                                    if clean != goods_data[key]:
                                        logger.warning(f"Cleaning formatting in {key} and retrying...")
                                        goods_data[key] = clean
                                        corrected = True
                            if corrected:
                                return await send_notification_to_bot(notification, allow_payload_correction=False)
                        return False
                elif resp.status == 429:
                    retry_after = resp.headers.get("Retry-After")
                    wait_time = int(retry_after) if retry_after and retry_after.isdigit() else 30
                    logger.warning(f"429 Too Many Requests. Flood wait {wait_time} seconds.")
                    await asyncio.sleep(wait_time)
                    return False
                else:
                    logger.error(f"HTTP error {resp.status}: {text}. Payload: {json.dumps(notification, ensure_ascii=False)}")
                    return False
    except Exception as e:
        logger.error(f"Exception while sending notification: {e}. Payload: {json.dumps(notification, ensure_ascii=False)}")
        return False

async def redis_with_retries(method, *args, **kwargs):
    for attempt in range(1, REDIS_RETRIES + 1):
        try:
            return await method(*args, **kwargs)
        except Exception as e:
            delay = REDIS_RETRY_DELAY * (2 ** (attempt - 1))
            logger.error(f"Redis error on {method.__name__}, attempt {attempt}/{REDIS_RETRIES}: {e}")
            if attempt < REDIS_RETRIES:
                logger.warning(f"Retrying Redis operation {method.__name__} after {delay} seconds...")
                await asyncio.sleep(delay)
            else:
                logger.critical(f"Redis operation {method.__name__} failed after {REDIS_RETRIES} attempts.")
                raise

async def process_notification(redis_client, raw_notification):
    try:
        notification = json.loads(raw_notification)
        reservation_id = notification.get("reservation_id")
        if reservation_id:
            sent_key = f"sent_reservation:{reservation_id}"
            already_sent = await redis_with_retries(redis_client.get, sent_key)
            if already_sent:
                logger.warning(f"Уведомление с reservation_id={reservation_id} уже отправлялось, пропускаем.")
                return
        retries = notification.get("retries", 0)
        logger.info(f"Обработка уведомления: {notification}")
        success = await send_notification_to_bot(notification)
        if success:
            logger.info(f"Уведомление отправлено и удалено из очереди: {notification}")
            if reservation_id:
                await redis_with_retries(redis_client.set, f"sent_reservation:{reservation_id}", "1", ex=60*60*24)
        else:
            if retries + 1 >= MAX_RETRIES:
                logger.error(f"Достигнут лимит попыток, переносим в DLQ: {notification}")
                notification["failed_at"] = datetime.utcnow().isoformat()
                await redis_with_retries(redis_client.rpush, DLQ_NAME, json.dumps(notification))
            else:
                notification["retries"] = retries + 1
                logger.warning(f"Повторная попытка отправки через {RETRY_DELAY} сек. Попытка {notification['retries']}/{MAX_RETRIES}")
                await asyncio.sleep(RETRY_DELAY)
                await redis_with_retries(redis_client.rpush, QUEUE_NAME, json.dumps(notification))
    except Exception as e:
        logger.error(f"Ошибка обработки уведомления: {e}")
        # В случае критической ошибки тоже отправляем в DLQ
        try:
            await redis_with_retries(redis_client.rpush, DLQ_NAME, raw_notification)
        except Exception as e2:
            logger.critical(f"Ошибка при переносе в DLQ: {e2}")

async def notification_worker():
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    logger.info("Воркер уведомлений запущен. Ожидание новых задач...")
    while True:
        try:
            raw_notification = await redis_with_retries(redis_client.lpop, QUEUE_NAME)
            if raw_notification:
                await process_notification(redis_client, raw_notification)
            else:
                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"Ошибка в основном цикле воркера: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(notification_worker()) 