import re
import aiohttp
import logging
import math
from functools import lru_cache
import sys
import asyncio

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    stream=sys.stdout,
    force=True
)
logger = logging.getLogger(__name__)
print('=== PRINT TEST: parser.py загружен ===')
logger.info('=== LOGGER TEST: parser.py logger работает ===')

def extract_product_id(url):
    """Извлекает ID товара из URL Wildberries"""
    logger.debug(f"Извлечение ID товара из URL: {url}")
    pattern = r'catalog/(\d+)/detail'
    match = re.search(pattern, url)
    if match:
        product_id = match.group(1)
        logger.debug(f"Успешно извлечен ID товара: {product_id}")
        return product_id
    logger.warning(f"Не удалось извлечь ID товара из URL: {url}")
    return None

def get_basket_host(vol: int) -> str:
    """Определяет номер basket-хоста на основе vol по старому алгоритму"""
    # Оптимизировано с использованием списка диапазонов и поиска по ним
    basket_ranges = [
        (0, 143, '01'), (144, 287, '02'), (288, 431, '03'), (432, 719, '04'),
        (720, 1007, '05'), (1008, 1061, '06'), (1062, 1115, '07'), (1116, 1169, '08'),
        (1170, 1313, '09'), (1314, 1601, '10'), (1602, 1655, '11'), (1656, 1919, '12'),
        (1920, 2045, '13'), (2046, 2189, '14'), (2190, 2405, '15'), (2406, 2621, '16'),
        (2622, 2837, '17'), (2838, 3053, '18'), (3054, 3269, '19'), (3270, 3485, '20')
    ]
    for start, end, host in basket_ranges:
        if start <= vol <= end:
            return host
    # Если vol не найден — возвращаем None
    return None

async def is_image_exists(host: str, vol: int, part: int, nm: int, session, timeout_sec=2) -> tuple:
    url = f"https://basket-{host}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/big/1.webp"
    try:
        timeout = aiohttp.ClientTimeout(total=timeout_sec)
        async with session.head(url, timeout=timeout) as resp:
            logger.info(f"Пробую basket-{host} для vol={vol}, nm={nm}, статус={resp.status}")
            return (resp.status == 200, None)
    except Exception as e:
        logger.warning(f"Ошибка при проверке картинки на basket-{host}: {e}")
        if "Temporary failure in name resolution" in str(e):
            return (False, "NO_MORE_BASKETS")
        return (False, None)

async def find_working_basket_host(vol: int, part: int, nm: int, session) -> str:
    """Сначала basket по алгоритму, затем строго последовательный перебор basket-20...49 (кроме уже проверенного). Таймаут 1 секунда. DNS-ошибка — прекращаем перебор basket-XX > N."""
    # 1. Пробуем basket по алгоритму
    alg_host = get_basket_host(vol)
    checked = set()
    if alg_host is not None and alg_host.isdigit() and 20 <= int(alg_host) < 50:
        result, err = await is_image_exists(alg_host, vol, part, nm, session, timeout_sec=1)
        checked.add(alg_host)
        if err == "NO_MORE_BASKETS":
            logger.warning(f"DNS-ошибка на basket-{alg_host}, прекращаю перебор basket-XX > {alg_host}")
            return None
        if result:
            logger.info(f"Нашёл рабочий basket-{alg_host} (по алгоритму) для vol={vol}, nm={nm}")
            return alg_host
    # 2. Перебираем basket-20...49 (кроме уже проверенного)
    for i in range(20, 50):
        host = str(i).zfill(2)
        if host in checked:
            continue
        result, err = await is_image_exists(host, vol, part, nm, session, timeout_sec=1)
        if err == "NO_MORE_BASKETS":
            logger.warning(f"DNS-ошибка на basket-{host}, прекращаю перебор basket-XX > {host}")
            break
        if result:
            logger.info(f"Нашёл рабочий basket-{host} для vol={vol}, nm={nm}")
            return host
    logger.error(f"Не удалось найти рабочий basket-хост для vol={vol}, nm={nm}")
    return None

async def get_product_details(product_id):
    """Получение данных о товаре через API"""
    url = f'https://card.wb.ru/cards/v1/detail?appType=1&curr=rub&dest=-1257786&spp=27&nm={product_id}'
    logger.debug(f"Запрос данных товара с ID: {product_id}, URL: {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': f'https://www.wildberries.ru/catalog/{product_id}/detail.aspx',
    }
    
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url=url, headers=headers) as response:
                logger.debug(f"Получен ответ от API, статус: {response.status}")
                
                if response.status != 200:
                    logger.error(f"Ошибка API, статус: {response.status}")
                    
                    # Пробуем альтернативный URL, если первый не сработал
                    alt_url = f'https://wbx-content-v2.wbstatic.net/ru/{product_id}.json'
                    logger.debug(f"Пробуем альтернативный URL: {alt_url}")
                    
                    async with session.get(alt_url) as alt_response:
                        if alt_response.status == 200:
                            logger.debug("Альтернативный URL сработал")
                            alt_data = await alt_response.json()
                            return {"data": {"products": [alt_data]}}
                        else:
                            logger.error(f"Альтернативный URL тоже не сработал, статус: {alt_response.status}")
                            return None
                
                data = await response.json()
                
                # Проверяем наличие данных о товаре
                if 'data' in data and 'products' in data['data'] and data['data']['products']:
                    logger.debug(f"Найдено товаров в ответе: {len(data['data']['products'])}")
                else:
                    logger.warning(f"В ответе API отсутствуют данные о товаре.")
                    
                    # Пробуем альтернативный URL, если в основном ответе нет товаров
                    alt_url = f'https://wbx-content-v2.wbstatic.net/ru/{product_id}.json'
                    logger.debug(f"Пробуем альтернативный URL: {alt_url}")
                    
                    async with session.get(alt_url) as alt_response:
                        if alt_response.status == 200:
                            logger.debug("Альтернативный URL сработал")
                            alt_data = await alt_response.json()
                            return {"data": {"products": [alt_data]}}
                        else:
                            logger.error(f"Альтернативный URL тоже не сработал, статус: {alt_response.status}")
                
                return data
        except Exception as e:
            logger.exception(f"Исключение при получении данных товара: {e}")
            return None

async def parse_wildberries_url(url):
    """
    Основная функция для парсинга данных с Wildberries по URL
    
    Args:
        url: Ссылка на товар Wildberries
        
    Returns:
        dict: Словарь с данными о товаре или None, если парсинг не удался
    """
    try:
        # Извлекаем ID товара из URL
        product_id = extract_product_id(url)
        if not product_id:
            logger.error("Не удалось извлечь ID товара из URL")
            return None
            
        # Получаем данные о товаре
        product_data = await get_product_details(product_id)
        
        if not product_data or 'data' not in product_data or 'products' not in product_data['data'] or not product_data['data']['products']:
            logger.error("Не удалось получить информацию о товаре")
            return None
            
        product = product_data['data']['products'][0]
        
        # Вычисляем цену с учетом WB-кошелька
        wb_price = None
        if 'salePriceU' in product:
            base_sale_price = product['salePriceU'] / 100
            wb_price = math.floor(base_sale_price * 0.98)
        elif 'priceU' in product:
            base_price = product['priceU'] / 100
            if 'sale' in product:
                sale_percent = product['sale']
                base_sale_price = base_price * (1 - sale_percent/100)
                wb_price = math.floor(base_sale_price * 0.98)
            else:
                wb_price = math.floor(base_price * 0.98)
        
        # Формируем URL изображения
        image_url = None
        try:
            nm = int(product_id)
            vol = nm // 100000
            part = nm // 1000
            async with aiohttp.ClientSession() as session:
                host = await find_working_basket_host(vol, part, nm, session)
                if host:
                    image_url = f"https://basket-{host}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/big/1.webp"
                    logger.info(f"Сформирован image_url: {image_url}")
                else:
                    logger.error(f"Не удалось найти рабочий basket-хост для vol={vol}, nm={nm}")
        except Exception as e:
            logger.error(f"Ошибка при формировании URL изображения: {e}")
        
        # Формируем ответ с данными о товаре
        return {
            "name": product.get('name', ''),
            "article": product_id,
            "url": url,
            "price": wb_price,
            "image": image_url
        }
            
    except Exception as e:
        logger.exception(f"Ошибка при парсинге товара: {e}")
        return None

# Тестовая функция для отладки
if __name__ == "__main__":
    async def test_parser():
        logger.debug("DEBUG сообщение - начало теста")
        logger.info("INFO сообщение - начало теста")
        
        # Тестовый URL Wildberries
        test_url = "https://www.wildberries.ru/catalog/139476294/detail.aspx"
        logger.debug(f"Тестирование URL: {test_url}")
        
        result = await parse_wildberries_url(test_url)
        
        if result:
            logger.debug("DEBUG - Успешный результат парсинга:")
            logger.info("INFO - Успешный результат парсинга:")
            for key, value in result.items():
                logger.debug(f"DEBUG - {key}: {value}")
                logger.info(f"INFO - {key}: {value}")
        else:
            logger.error("Ошибка при парсинге тестового URL")
    
    # Запускаем тест
    asyncio.run(test_parser())