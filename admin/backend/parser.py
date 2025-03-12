import re
import aiohttp
import logging
import math

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    """Определяет номер basket-хоста на основе vol"""
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
    elif 1920 <= vol <= 3053: return '18'
    elif 1920 <= vol <= 3269: return '19'
    else: return '20'

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
            # Преобразуем product_id в число
            nm = int(product_id)
            vol = nm // 100000
            part = nm // 1000
            
            # Получаем номер хоста
            host = get_basket_host(vol)
            
            # Создаем URL изображения большого размера
            image_url = f"https://basket-{host}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/big/1.webp"
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