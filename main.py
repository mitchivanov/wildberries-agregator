import requests
import os
import asyncio
import time
import re
import json
from bs4 import BeautifulSoup
import logging
import math

from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.enums.parse_mode import ParseMode
from aiogram.types.inline_keyboard_button import InlineKeyboardButton
from aiogram.utils.keyboard import InlineKeyboardBuilder

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

bot = Bot("7205892472:AAGAShZUu-DiXSIYhW7_GSCwZIq-pVT3cNc")
dp = Dispatcher()

def extract_product_id(url):
    # Извлекаем ID товара из URL Wildberries
    logger.debug(f"Пытаемся извлечь ID товара из URL: {url}")
    pattern = r'catalog/(\d+)/detail'
    match = re.search(pattern, url)
    if match:
        product_id = match.group(1)
        logger.debug(f"Успешно извлечен ID товара: {product_id}")
        return product_id
    logger.warning(f"Не удалось извлечь ID товара из URL: {url}")
    return None

def get_product_details(product_id):
    # Получение данных о товаре через API
    url = f'https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&dest=-1257786&spp=27&nm={product_id}'
    logger.debug(f"Запрос данных товара с ID: {product_id}, URL: {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': f'https://www.wildberries.ru/catalog/{product_id}/detail.aspx',
    }
    
    try:
        response = requests.get(url=url, headers=headers)
        logger.debug(f"Получен ответ от API, статус: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"Ошибка API, статус: {response.status_code}")
            
            # Пробуем альтернативный URL, если первый не сработал
            alt_url = f'https://wbx-content-v2.wbstatic.net/ru/{product_id}.json'
            logger.debug(f"Пробуем альтернативный URL: {alt_url}")
            alt_response = requests.get(alt_url)
            
            if alt_response.status_code == 200:
                logger.debug("Альтернативный URL сработал")
                return {"data": {"products": [alt_response.json()]}}
            else:
                logger.error(f"Альтернативный URL тоже не сработал, статус: {alt_response.status_code}")
                return None
            
        data = response.json()
        
        # Проверяем наличие данных о товаре
        if 'data' in data and 'products' in data['data'] and data['data']['products']:
            logger.debug(f"Найдено товаров в ответе: {len(data['data']['products'])}")
        else:
            logger.warning(f"В ответе API отсутствуют данные о товаре.")
            
            # Пробуем альтернативный URL, если в основном ответе нет товаров
            alt_url = f'https://wbx-content-v2.wbstatic.net/ru/{product_id}.json'
            logger.debug(f"Пробуем альтернативный URL: {alt_url}")
            alt_response = requests.get(alt_url)
            
            if alt_response.status_code == 200:
                logger.debug("Альтернативный URL сработал")
                return {"data": {"products": [alt_response.json()]}}
            else:
                logger.error(f"Альтернативный URL тоже не сработал, статус: {alt_response.status_code}")
            
        return data
    except Exception as e:
        logger.exception(f"Исключение при получении данных товара: {e}")
        return None

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer("Привет! Отправь мне ссылку на товар с Wildberries, и я покажу информацию о нем.")

@dp.message()
async def process_link(message: types.Message):
    # Получаем текст сообщения и очищаем его
    msg_text = message.text.strip()
    logger.debug(f"Получено сообщение: {msg_text}")
    
    # Проверяем, является ли сообщение ссылкой на Wildberries
    if 'wildberries.ru' not in msg_text:
        await message.answer("Пожалуйста, отправьте ссылку на товар с сайта Wildberries.")
        return
    
    # Извлекаем ID товара из ссылки
    product_id = extract_product_id(msg_text)
    if not product_id:
        await message.answer("Не удалось распознать ID товара в ссылке. Пожалуйста, проверьте ссылку и попробуйте снова.")
        return
    
    logger.debug(f"Извлечен ID товара: {product_id}")
    
    # Получаем последние 4 цифры артикула
    last_4_digits = product_id[-4:] if len(product_id) >= 4 else product_id
    
    try:
        # Получаем данные о товаре
        data = get_product_details(product_id)
        
        if not data or 'data' not in data or 'products' not in data['data'] or not data['data']['products']:
            await message.answer("Не удалось получить информацию о товаре. Возможно, товар больше не существует.")
            return
        
        product = data['data']['products'][0]
        logger.debug(f"Структура данных о товаре: {json.dumps(product, indent=2, ensure_ascii=False)}")
        
        # Загружаем изображение
        image_path = download_product_image(product_id)
        logger.debug(f"Загружено изображение: {image_path}")
        
        # Получаем детали товара
        name = product.get('name', 'Нет названия')
        brand = product.get('brand', 'Нет бренда')
        
        # Получаем цену и округляем в меньшую сторону
        if 'salePriceU' in product:
            base_sale_price = product['salePriceU'] / 100
            wb_price = floor_price(base_sale_price * 0.98)
            logger.debug(f"Цена рассчитана из salePriceU с учетом WB-кошелька (2%): {wb_price}")
        elif 'priceU' in product:
            base_price = product['priceU'] / 100
            if 'sale' in product:
                sale_percent = product['sale']
                base_sale_price = base_price * (1 - sale_percent/100)
                wb_price = floor_price(base_sale_price * 0.98)
                logger.debug(f"Цена рассчитана из priceU и sale с учетом WB-кошелька (2%): {wb_price}")
            else:
                wb_price = floor_price(base_price * 0.98)
                logger.debug(f"Цена рассчитана из priceU с учетом только WB-кошелька (2%): {wb_price}")
        
        if wb_price is None:
            logger.error("Не удалось получить цену с WB-кошельком")
            await message.answer("Не удалось получить информацию о цене товара. Пожалуйста, попробуйте позже.")
            return
        
        # Формируем текст сообщения
        text = f"<b>{name}</b>\n\n"
        text += f"<b>Бренд:</b> {brand}\n"
        text += f"<b>Цена с учетом ВБ-кошелька:</b> {wb_price} ₽\n"
        text += f"<b>Последние 4 цифры артикула:</b> {last_4_digits}\n"
        
        # Создаем кнопку для перехода к товару
        builder = InlineKeyboardBuilder()
        builder.add(InlineKeyboardButton(text="Открыть на Wildberries", url=f"https://www.wildberries.ru/catalog/{product_id}/detail.aspx"))
        
        # Отправляем текстовую информацию с кнопкой
        await message.answer(text, parse_mode=ParseMode.HTML, reply_markup=builder.as_markup())
        logger.info(f"Успешно отправлена информация о товаре с ID: {product_id}")
            
    except Exception as e:
        logger.exception(f"Ошибка при обработке сообщения: {e}")
        await message.answer("Произошла ошибка при получении информации о товаре. Пожалуйста, попробуйте позже.")

def get_basket_host(vol: int) -> str:
    """
    Определяет номер basket-хоста на основе vol
    """
    if 0 <= vol <= 143: return '01'
    elif 144 <= vol <= 287: return '02'
    elif 288 <= vol <= 431: return '03'
    elif 432 <= vol <= 719: return '04'
    elif 720 <= vol <= 1007: return '05'
    elif 1008 <= vol <= 1061: return '06'
    elif 1062 <= vol <= 1115: return '07'
    elif 1116 <= vol <= 1169: return '08'
    elif 1170 <= vol <= 1313: return '09'
    elif 1314 <= vol <= 1601: return '10'
    elif 1602 <= vol <= 1655: return '11'
    elif 1656 <= vol <= 1919: return '12'
    elif 1920 <= vol <= 2045: return '13'
    elif 1920 <= vol <= 2189: return '14'
    elif 1920 <= vol <= 2405: return '15'
    elif 1920 <= vol <= 2621: return '16'
    elif 1920 <= vol <= 2837: return '17'
    else: return '18'

def download_product_image(product_id: str) -> str | None:
    """
    Загружает основное изображение товара
    """
    try:
        # Преобразуем product_id в число
        nm = int(product_id)
        vol = nm // 100000
        part = nm // 1000
        
        # Получаем номер хоста по алгоритму
        host = get_basket_host(vol)
        
        # Список возможных размеров изображений
        image_sizes = ['c246x328', 'c516x688', 'big']
        
        # Сначала пробуем точный алгоритм
        for size in image_sizes:
            image_url = f"https://basket-{host}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/{size}/1.webp"
            logger.debug(f"Пробуем загрузить изображение (точный алгоритм): {image_url}")
            
            response = requests.get(image_url)
            if response.status_code == 200:
                if not os.path.exists('images'):
                    os.makedirs('images')
                filename = f'images/{product_id}.webp'
                with open(filename, 'wb') as f:
                    f.write(response.content)
                logger.info(f"Успешно загружено изображение: {filename}")
                return filename
        
        # Если точный алгоритм не сработал, перебираем все варианты
        logger.warning("Точный алгоритм не сработал, пробуем перебор всех вариантов")
        basket_numbers = ['01', '02', '03', '04', '05', '06', '07', '08', '09', 
                         '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20']
        
        for basket in basket_numbers:
            for size in image_sizes:
                image_url = f"https://basket-{basket}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/{size}/1.webp"
                logger.debug(f"Пробуем загрузить изображение (перебор): {image_url}")
                
                response = requests.get(image_url)
                if response.status_code == 200:
                    if not os.path.exists('images'):
                        os.makedirs('images')
                    filename = f'images/{product_id}.webp'
                    with open(filename, 'wb') as f:
                        f.write(response.content)
                    logger.info(f"Успешно загружено изображение (перебором): {filename}")
                    return filename
        
        logger.warning(f"Не удалось загрузить изображение для товара {product_id}")
        return None
        
    except Exception as e:
        logger.exception(f"Ошибка при загрузке изображения: {e}")
        return None

def floor_price(price):
    """
    Округляет цену до целых в меньшую сторону
    """
    return math.floor(price)

async def main():
    # Запускаем бота
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())