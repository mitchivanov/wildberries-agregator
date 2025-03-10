import os
import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from dotenv import load_dotenv
import json
import time

load_dotenv()

def extract_main_image(url: str) -> str:
    """Извлекает URL главного изображения товара из страницы Wildberries"""
    try:
        headers = {
            'User-Agent': os.getenv('USER_AGENT'),
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
        
        # Получаем ID товара из URL
        match = re.search(r'/catalog/(\d+)/', url)
        if not match:
            raise ValueError("Некорректный URL товара")
        product_id = match.group(1)
        
        # Запрос страницы товара
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Проверка и поиск изображения в различных источниках
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. Поиск через JavaScript-данные (самый надежный метод)
        js_data = re.search(r'window\.__APP__\s*=\s*({.*?});', response.text, re.DOTALL)
        if js_data:
            try:
                parsed_data = json.loads(js_data.group(1))
                
                # Используем прямую ссылку на базовый домен из данных
                base_url = parsed_data.get('baseUrl', 'https://basket-10.wb.ru')
                photos = parsed_data.get('product', {}).get('media', {}).get('photos', [])
                if photos and len(photos) > 0:
                    photo_path = photos[0].get('url')
                    if photo_path:
                        # Выбираем альтернативные домены вместо images.wbstatic.net
                        photo_hosts = [
                            'https://basket-10.wb.ru',
                            'https://basket-01.wb.ru',
                            'https://basket-02.wb.ru',
                            'https://basket-03.wb.ru',
                            base_url
                        ]
                        
                        # Пробуем все домены
                        for host in photo_hosts:
                            try:
                                test_url = f"{host}{photo_path}"
                                test_response = requests.head(test_url, timeout=3)
                                if test_response.status_code == 200:
                                    return test_url
                            except Exception:
                                continue
            except Exception:
                pass
        
        # 2. Поиск через микроданные JSON-LD
        json_script = soup.find('script', {'type': 'application/ld+json'})
        if json_script:
            try:
                product_data = json.loads(json_script.string)
                if 'image' in product_data and not 'wb-og-win.jpg' in product_data['image']:
                    image_url = product_data['image'].split('?')[0]
                    # Добавляем схему, если отсутствует
                    if image_url.startswith('//'):
                        image_url = f"https:{image_url}"
                    return image_url
            except Exception:
                pass
        
        # 3. Поиск через прямые теги изображений (без зависимости от CDN)
        for selector in [
            soup.select_one('.slider-item img.slide-card-img'),  # Новый дизайн
            soup.select_one('.sw-slider-kt img'),                # Альтернативный селектор
            soup.select_one('.sw-slider__item img'),             # Еще один вариант
            soup.select_one('.image-color img'),                 # Еще один вариант
            soup.select_one('img.j-zoom-image')                  # Старый дизайн
        ]:
            if selector and selector.get('src'):
                image_url = selector.get('src').split('?')[0]
                if 'wb-og-win.jpg' not in image_url:  # Исключаем служебное изображение
                    # Добавляем схему, если отсутствует
                    if image_url.startswith('//'):
                        image_url = f"https:{image_url}"
                    return image_url
        
        # 4. Поиск через мета-теги
        meta_image = soup.find('meta', {'property': 'og:image'})
        if meta_image and meta_image.get('content'):
            image_url = meta_image.get('content').split('?')[0]
            if 'wb-og-win.jpg' not in image_url:  # Исключаем служебное изображение
                # Добавляем схему, если отсутствует
                if image_url.startswith('//'):
                    image_url = f"https:{image_url}"
                return image_url
                
        # 5. Специализированный метод через API
        try:
            api_url = f"https://card.wb.ru/cards/detail?curr=rub&nm={product_id}"
            api_response = requests.get(api_url, headers=headers, timeout=10)
            if api_response.status_code == 200:
                api_data = api_response.json()
                if api_data.get('data', {}).get('products'):
                    vol = product_id[:-5] + '0000'
                    part = product_id[:-3] + '000'
                    basket_urls = [
                        f"https://basket-10.wb.ru/vol{vol}/part{part}/{product_id}/images/big/1.jpg",
                        f"https://basket-01.wb.ru/vol{vol}/part{part}/{product_id}/images/big/1.jpg",
                        f"https://basket-02.wb.ru/vol{vol}/part{part}/{product_id}/images/big/1.jpg"
                    ]
                    
                    for basket_url in basket_urls:
                        try:
                            test_response = requests.head(basket_url, timeout=3)
                            if test_response.status_code == 200:
                                return basket_url
                        except Exception:
                            continue
        except Exception:
            pass
                
        raise ValueError("Не удалось найти изображение товара")
    
    except Exception as e:
        raise RuntimeError(f"Ошибка при получении изображения: {str(e)}")

def download_image(image_url: str, filename: str = None) -> str:
    """Скачивает изображение по URL и сохраняет в текущую директорию"""
    try:
        # Добавляем схему, если отсутствует
        if image_url.startswith('//'):
            image_url = f"https:{image_url}"
        
        max_retries = 3
        retry_delay = 1
        
        for retry in range(max_retries):
            try:    
                response = requests.get(image_url, stream=True, timeout=15)
                response.raise_for_status()
                
                if not filename:
                    filename = os.path.basename(urlparse(image_url).path)
                    
                with open(filename, 'wb') as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                        
                return os.path.abspath(filename)
            except requests.exceptions.Timeout:
                if retry < max_retries - 1:
                    print(f"Тайм-аут при загрузке, повторная попытка {retry+1}/{max_retries}...")
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Экспоненциальная задержка
                else:
                    raise
    
    except Exception as e:
        raise RuntimeError(f"Ошибка при загрузке изображения: {str(e)}")

if __name__ == "__main__":
    product_url = input("Введите URL товара Wildberries: ").strip()
    try:
        image_url = extract_main_image(product_url)
        saved_path = download_image(image_url)
        print(f"Изображение сохранено: {saved_path}")
    except Exception as e:
        print(f"Ошибка: {str(e)}")
