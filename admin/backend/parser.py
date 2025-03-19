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
    elif 2046 <= vol <= 2189: return '14'
    elif 2190 <= vol <= 2405: return '15'
    elif 2406 <= vol <= 2621: return '16'
    elif 2622 <= vol <= 2837: return '17'
    elif 2838 <= vol <= 3053: return '18'
    elif 3054 <= vol <= 3269: return '19'
    elif 3270 <= vol <= 3485: return '20'
    elif 3486 <= vol <= 3701: return '21'
    elif 3702 <= vol <= 3917: return '22'
    elif 3918 <= vol <= 4133: return '23'
    elif 4134 <= vol <= 4349: return '24'
    elif 4350 <= vol <= 4565: return '25'
    elif 4566 <= vol <= 4781: return '26'
    
    

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

async def get_image_url(nm, vol, part, start_host):
    """Получение URL изображения сначала по алгоритму, затем перебором"""
    # Список возможных размеров изображений
    image_sizes = ['big', 'c516x688', 'c246x328']
    
    # Сначала пробуем все размеры с рассчитанным хостом
    async with aiohttp.ClientSession() as session:
        # Проверяем сначала все размеры с рассчитанным хостом
        for size in image_sizes:
            image_url = f"https://basket-{start_host}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/{size}/1.webp"
            logger.debug(f"Проверка доступности изображения с рассчитанным хостом: {image_url}")
            
            try:
                async with session.head(image_url, timeout=3) as response:
                    if response.status == 200:
                        logger.info(f"Найдено доступное изображение (рассчитанный хост): {image_url}")
                        return image_url
            except Exception as e:
                logger.debug(f"Ошибка при проверке изображения {image_url}: {e}")
        
        # Если точный алгоритм не сработал, перебираем все варианты
        logger.warning("Точный алгоритм не сработал, пробуем перебор всех вариантов")
        basket_numbers = ['01', '02', '03', '04', '05', '06', '07', '08', '09', 
                          '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
                          '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
                          '30', '31', '32', '33', '34', '35', '36', '37', '38', '39',
                          '40', '41', '42', '43', '44', '45', '46', '47', '48', '49',
                          '50', '51', '52', '53', '54', '55', '56', '57', '58', '59',
                          '60', '61', '62', '63', '64', '65', '66', '67', '68', '69',
                          '70', '71', '72', '73', '74', '75', '76', '77', '78', '79',
                          '80', '81', '82', '83', '84', '85', '86', '87', '88', '89',
                          ]
        
        # Пропускаем тот хост, который уже проверили
        basket_numbers = [basket for basket in basket_numbers if basket != start_host]
        
        for basket in basket_numbers:
            for size in image_sizes:
                image_url = f"https://basket-{basket}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/{size}/1.webp"
                logger.debug(f"Проверка доступности изображения (перебор): {image_url}")
                
                try:
                    async with session.head(image_url, timeout=3) as response:
                        if response.status == 200:
                            logger.info(f"Найдено доступное изображение (перебор): {image_url}")
                            return image_url
                except Exception as e:
                    logger.debug(f"Ошибка при проверке изображения {image_url}: {e}")
    
    # Если ничего не нашли, возвращаем базовый URL
    default_url = f"https://basket-{start_host}.wbbasket.ru/vol{vol}/part{part}/{nm}/images/big/1.webp"
    logger.warning(f"Не найдено доступное изображение, возвращаем стандартный URL: {default_url}")
    return default_url

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
            
            # Получаем URL изображения с перебором хостов
            image_url = await get_image_url(nm, vol, part, host)
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