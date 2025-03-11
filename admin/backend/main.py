from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, or_
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
import hmac
from urllib.parse import urlencode, parse_qsl
import os
from datetime import datetime, timedelta
import random
from sqlalchemy import func
import aiohttp
import asyncio
import json
import logging
from worker import update_goods_activity
import time
from aiohttp import ClientSession

from database import get_db, init_db, close_db, AsyncScopedSession
from models import Goods, Reservation, DailyAvailability
from schemas import (
    GoodsCreate, GoodsUpdate, GoodsResponse,ReservationCreate, ReservationResponse,
    DailyAvailabilityResponse
)

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Получаем токен из окружения
BOT_TOKEN = "7205892472:AAGAShZUu-DiXSIYhW7_GSCwZIq-pVT3cNc"
# Добавляем режим разработки
DEVELOPMENT_MODE = os.environ.get("DEVELOPMENT_MODE", "True").lower() == "true"

# Добавляем URL для бота
BOT_API_URL = os.getenv("BOT_API_URL", "http://bot:8080")

# Добавляем переменную для отслеживания времени последнего запроса
_last_availability_request_time = 0
_availability_cache = None
_availability_cache_ttl = 10  # Время жизни кэша в секундах

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("База данных инициализирована")
    yield
    await close_db()
    logger.info("Соединение с базой данных закрыто")

app = FastAPI(title="Goods Admin API", lifespan=lifespan)

# Добавляем CORS для обработки кросс-доменных запросов от ngrok
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем все источники (для ngrok)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

telegram_security = HTTPBearer()

# Проверка аутентификации через Telegram и получение user_id
async def verify_telegram_user(init_data: str = Header(None, alias="X-Telegram-Init-Data")):
    # Если мы не в режиме разработки, требуем аутентификацию
    if not DEVELOPMENT_MODE and not init_data:
        raise HTTPException(status_code=403, detail="Not authenticated")
        
    if not init_data:
        if DEVELOPMENT_MODE:
            print("Development mode: skipping Telegram authentication")
            return 1  # Возвращаем фиктивный ID пользователя
        else:
            raise HTTPException(status_code=403, detail="Not authenticated")
    
    try:
        # Декодируем данные из параметров URL
        from urllib.parse import parse_qsl
        
        # Распарсим init_data, который имеет формат URL-query
        data = dict(parse_qsl(init_data))
        
        # Проверим наличие user параметра
        if 'user' not in data:
            print("Missing user data in init_data")
            if DEVELOPMENT_MODE:
                return 1  # В режиме разработки возвращаем фиктивный ID
            raise HTTPException(status_code=403, detail="User data not found")
        
        # Telegram передает данные пользователя в JSON формате
        import json
        user_data = json.loads(data['user'])
        user_id = user_data.get('id', 0)
        
        print(f"Telegram user identified: {user_id}")
        return user_id
    except Exception as e:
        print(f"Error extracting user_id: {str(e)}")
        if DEVELOPMENT_MODE:
            return 1  # В режиме разработки возвращаем фиктивный ID
        raise HTTPException(status_code=403, detail=f"Authentication error: {str(e)}")

# Генерация доступности товара по дням
async def generate_daily_availability(db: AsyncSession, goods_id: int, start_date: datetime, 
                                     end_date: datetime, min_daily: int, max_daily: int):
    """
    Генерирует записи о доступности товара на каждый день в заданном диапазоне дат.
    Количество товара на день выбирается случайно между min_daily и max_daily.
    """
    logger.info(f"Начинаем генерацию доступности для товара {goods_id}")
    logger.info(f"Параметры: start_date={start_date}, end_date={end_date}, min_daily={min_daily}, max_daily={max_daily}")
    
    # Удаляем все существующие записи о доступности для этого товара
    # в будущем (от сегодняшнего дня)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    delete_stmt = delete(DailyAvailability).where(
        DailyAvailability.goods_id == goods_id,
        DailyAvailability.date >= today
    )
    await db.execute(delete_stmt)
    logger.info(f"Удалены существующие записи доступности для товара {goods_id}")
    
    # Если не указаны даты начала или окончания, используем сегодня и +30 дней
    if not start_date:
        logger.info("Дата начала не указана, используем сегодня")
        start_date = today
    if not end_date:
        logger.info("Дата окончания не указана, используем сегодня + 30 дней")
        end_date = today + timedelta(days=30)
    
    # Приведение дат к одному формату (без часового пояса)
    if start_date and start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date and end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)
    
    # Гарантируем, что start_date не раньше сегодняшнего дня
    start_date = max(start_date, today)
    logger.info(f"Итоговые даты: start_date={start_date}, end_date={end_date}")
    
    # Создаем новые записи для каждого дня
    count = 0
    current_date = start_date
    while current_date <= end_date:
        # Генерируем случайное количество товара на день
        available_quantity = random.randint(min_daily, max_daily)
        
        # Создаем новую запись
        daily_availability = DailyAvailability(
            goods_id=goods_id,
            date=current_date,
            available_quantity=available_quantity
        )
        db.add(daily_availability)
        count += 1
        
        # Переходим к следующему дню
        current_date += timedelta(days=1)
    
    await db.commit()
    logger.info(f"Сгенерировано {count} записей доступности для товара {goods_id} с {start_date} по {end_date}")

# CRUD маршруты
@app.post("/goods/", response_model=GoodsResponse, status_code=status.HTTP_201_CREATED)
async def create_goods(goods: GoodsCreate, db: AsyncSession = Depends(get_db)):
    """Создать новый товар и сгенерировать доступность по дням"""
    db_goods = Goods(**goods.dict())
    db.add(db_goods)
    await db.commit()
    await db.refresh(db_goods)
    
    # Генерируем доступность товара по дням
    await generate_daily_availability(
        db, 
        db_goods.id, 
        db_goods.start_date, 
        db_goods.end_date, 
        db_goods.min_daily, 
        db_goods.max_daily
    )
    
    return db_goods

@app.get("/goods/", response_model=List[GoodsResponse], dependencies=[Depends(verify_telegram_user)])
async def read_all_goods(
    skip: int = 0, 
    limit: int = 100,
    name: Optional[str] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    article: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех товаров с пагинацией и фильтрацией"""
    # Создаем базовый запрос на товары
    query = select(Goods)
    
    # Применяем фильтры
    if name:
        query = query.filter(Goods.name.ilike(f"%{name}%"))
    if min_price is not None:
        query = query.filter(Goods.price >= min_price)
    if max_price is not None:
        query = query.filter(Goods.price <= max_price)
    if article:
        query = query.filter(Goods.article.ilike(f"%{article}%"))
    if is_active is not None:
        query = query.filter(Goods.is_active == is_active)
    
    # Применяем пагинацию
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    goods_list = result.scalars().all()
    
    # Загружаем доступность товаров на сегодняшний день
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    response_goods = []
    
    # Для каждого товара явно загружаем доступность
    for goods in goods_list:
        # Выполняем отдельный запрос для получения доступности
        availability_query = select(DailyAvailability).filter(
            DailyAvailability.goods_id == goods.id,
            DailyAvailability.date >= today
        )
        availability_result = await db.execute(availability_query)
        availability = availability_result.scalars().all()
        
        # Создаем словарь для ответа
        goods_dict = {
            "id": goods.id,
            "name": goods.name,
            "price": goods.price,
            "cashback_percent": goods.cashback_percent,
            "article": goods.article,
            "url": goods.url,
            "image": goods.image,
            "is_active": goods.is_active,
            "purchase_guide": goods.purchase_guide,
            "start_date": goods.start_date,
            "end_date": goods.end_date,
            "min_daily": goods.min_daily,
            "max_daily": goods.max_daily,
            "created_at": goods.created_at,
            "updated_at": goods.updated_at,
            "daily_availability": [
                {
                    "id": item.id,
                    "goods_id": item.goods_id,
                    "date": item.date,
                    "available_quantity": item.available_quantity
                }
                for item in availability
            ]
        }
        
        response_goods.append(goods_dict)
    
    return response_goods

@app.get("/goods/search/", response_model=List[GoodsResponse])
async def search_goods(
    q: str = Query(..., description="Поисковый запрос (имя или артикул)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Поиск товаров по имени или артикулу
    """
    query = select(Goods).filter(
        or_(
            Goods.name.ilike(f"%{q}%"),
            Goods.article.ilike(f"%{q}%")
        )
    ).limit(50)
    
    result = await db.execute(query)
    goods = result.scalars().all()
    return goods

@app.get("/goods/{goods_id}", response_model=GoodsResponse, dependencies=[Depends(verify_telegram_user)])
async def read_goods(goods_id: int, db: AsyncSession = Depends(get_db)):
    """Получить товар по ID с информацией о доступности и бронированиях"""
    logger.info(f"Запрос товара с ID: {goods_id}")
    
    # Получаем товар
    goods_query = select(Goods).filter(Goods.id == goods_id)
    result = await db.execute(goods_query)
    goods = result.scalars().first()
    
    if not goods:
        logger.warning(f"Товар с ID {goods_id} не найден")
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Получаем доступность товара (начиная с сегодняшнего дня)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    availability_query = select(DailyAvailability).filter(
        DailyAvailability.goods_id == goods_id,
        DailyAvailability.date >= today
    ).order_by(DailyAvailability.date)
    
    availability_result = await db.execute(availability_query)
    availability = availability_result.scalars().all()
    
    # Получаем бронирования для этого товара
    reservations_query = select(Reservation).filter(
        Reservation.goods_id == goods_id
    ).order_by(Reservation.reserved_at.desc())
    
    reservations_result = await db.execute(reservations_query)
    reservations = reservations_result.scalars().all()
    
    # Создаем ответ в формате, который ожидает фронтенд
    goods_dict = {
        "id": goods.id,
        "name": goods.name,
        "price": goods.price,
        "cashback_percent": goods.cashback_percent,
        "article": goods.article,
        "url": goods.url,
        "image": goods.image,
        "is_active": goods.is_active,
        "purchase_guide": goods.purchase_guide,
        "start_date": goods.start_date,
        "end_date": goods.end_date,
        "min_daily": goods.min_daily,
        "max_daily": goods.max_daily,
        "created_at": goods.created_at,
        "updated_at": goods.updated_at,
        "daily_availability": [
            {
                "id": item.id,
                "goods_id": item.goods_id,
                "date": item.date,
                "available_quantity": item.available_quantity
            }
            for item in availability
        ],
        "reservations": [
            {
                "id": item.id,
                "user_id": item.user_id,
                "goods_id": item.goods_id,
                "quantity": item.quantity,
                "reserved_at": item.reserved_at
            }
            for item in reservations
        ]
    }
    
    return goods_dict

@app.put("/goods/{goods_id}", response_model=GoodsResponse)
async def update_goods(goods_id: int, goods_data: GoodsUpdate, db: AsyncSession = Depends(get_db)):
    """Обновить товар по ID"""
    # Проверяем существование товара
    result = await db.execute(select(Goods).filter(Goods.id == goods_id))
    goods = result.scalars().first()
    
    if goods is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Фильтруем только заполненные поля для обновления
    update_data = {k: v for k, v in goods_data.dict().items() if v is not None}
    
    if update_data:
        await db.execute(
            update(Goods)
            .where(Goods.id == goods_id)
            .values(**update_data)
        )
        await db.commit()
    
    # Получаем обновленный товар
    result = await db.execute(select(Goods).filter(Goods.id == goods_id))
    updated_goods = result.scalars().first()
    
    # Перегенерируем доступность товара по дням, если изменились даты или мин/макс значения
    if any(field in update_data for field in ['start_date', 'end_date', 'min_daily', 'max_daily']):
        await generate_daily_availability(
            db, 
            updated_goods.id, 
            updated_goods.start_date, 
            updated_goods.end_date, 
            updated_goods.min_daily, 
            updated_goods.max_daily
        )
    
    return updated_goods

@app.delete("/goods/{goods_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goods(goods_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить товар по ID"""
    # Проверяем существование товара
    result = await db.execute(select(Goods).filter(Goods.id == goods_id))
    goods = result.scalars().first()
    
    if goods is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Удаляем товар
    await db.execute(delete(Goods).where(Goods.id == goods_id))
    await db.commit()
    
    return None

def apply_query_filters(query, filters):
    """Универсальный метод применения фильтров"""
    for field, value in filters.items():
        if value is not None:
            if field == 'name':
                query = query.filter(Goods.name.ilike(f"%{value}%"))
            elif field == 'price':
                if value.get('min'):
                    query = query.filter(Goods.price >= value['min'])
                if value.get('max'):
                    query = query.filter(Goods.price <= value['max'])
            elif field == 'article':
                query = query.filter(Goods.article.ilike(f"%{value}%"))
            elif field == 'is_active':
                query = query.filter(Goods.is_active == value)
    return query

# Функция для удаления устаревших записей
async def clean_expired_availability(db: AsyncSession):
    """Удаляет записи о доступности товаров с истекшей датой"""
    current_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    delete_stmt = delete(DailyAvailability).where(
        DailyAvailability.date < current_date
    )
    
    await db.execute(delete_stmt)
    await db.commit()

# Модифицируем эндпоинт каталога для автоматической очистки
@app.get("/catalog/", response_model=List[GoodsResponse])
async def get_catalog(
    current_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить список доступных товаров на текущую дату"""
    if current_date is None:
        current_date = datetime.now()
    
    # Автоматически очищаем устаревшие записи
    await clean_expired_availability(db)
    
    # Остальной код эндпоинта без изменений
    query = select(Goods).where(
        Goods.is_active == True,
        Goods.start_date <= current_date,
        Goods.end_date >= current_date
    )
    
    result = await db.execute(query)
    goods = result.scalars().all()
    
    # Проверяем наличие доступных товаров на текущую дату
    available_goods = []
    for item in goods:
        availability_query = select(DailyAvailability).where(
            DailyAvailability.goods_id == item.id,
            DailyAvailability.date == current_date.replace(hour=0, minute=0, second=0, microsecond=0),
            DailyAvailability.available_quantity > 0
        )
        availability_result = await db.execute(availability_query)
        if availability_result.scalars().first():
            available_goods.append(item)
    
    return available_goods

@app.get("/catalog/{goods_id}", response_model=GoodsResponse)
async def get_goods_details(
    goods_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить детальную информацию о товаре"""
    result = await db.execute(select(Goods).filter(Goods.id == goods_id))
    goods = result.scalars().first()
    
    if goods is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return goods

# Функция для отправки уведомления в бот
async def notify_bot_about_reservation(user_id, goods_data, quantity):
    """Отправляет уведомление в Telegram бот о новом бронировании"""
    bot_api_url = BOT_API_URL + "/send_notification"
    
    try:
        # Подготавливаем данные для отправки в бота
        data = {
            "user_id": user_id,
            "goods_data": goods_data,
            "quantity": quantity
        }
        
        # Асинхронный запрос к API бота
        async with ClientSession() as session:
            async with session.post(bot_api_url, json=data) as response:
                # Проверяем статус ответа
                if response.status != 200:
                    response_text = await response.text()
                    logger.error(f"Ошибка при отправке уведомления в бот: {response.status}, {response_text}")
                    return False
                
                # Парсим JSON из ответа
                response_data = await response.json()
                
                # Проверяем статус операции
                if response_data.get("status") != "success":
                    error_message = response_data.get("message", "Неизвестная ошибка")
                    logger.warning(f"Бот не смог отправить уведомление: {error_message}")
                    return False
                
                logger.info(f"Уведомление успешно отправлено в бот для пользователя {user_id}")
                return True
    except Exception as e:
        logger.error(f"Исключение при отправке уведомления в бот: {str(e)}")
        return False

@app.post("/reservations/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Создать бронирование товара"""
    # Убедимся, что у нас есть идентификатор пользователя
    if user_id is None:
        # В режиме разработки установим фиктивный ID
        if DEVELOPMENT_MODE:
            user_id = 1
        else:
            raise HTTPException(status_code=403, detail="Не удалось определить пользователя")
    
    # Проверяем существование товара
    result = await db.execute(select(Goods).filter(Goods.id == reservation.goods_id))
    goods = result.scalars().first()
    
    if goods is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Проверяем, доступен ли товар на текущую дату
    current_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Исправляем проблему с часовыми поясами
    start_date = goods.start_date
    end_date = goods.end_date
    
    # Приводим обе даты к одному формату (без часового пояса)
    if start_date and start_date.tzinfo:
        start_date = start_date.replace(tzinfo=None)
    if end_date and end_date.tzinfo:
        end_date = end_date.replace(tzinfo=None)
    
    if start_date and end_date and (start_date > current_date or end_date < current_date):
        raise HTTPException(status_code=400, detail="Товар недоступен для бронирования на текущую дату")
    
    # Проверяем доступность на текущую дату
    availability_query = select(DailyAvailability).where(
        DailyAvailability.goods_id == goods.id,
        DailyAvailability.date == current_date,
    )
    availability_result = await db.execute(availability_query)
    availability = availability_result.scalars().first()
    
    if not availability or availability.available_quantity <= 0:
        raise HTTPException(status_code=400, detail="Товар недоступен для бронирования")
    
    # Проверяем, не бронировал ли уже пользователь этот товар сегодня
    existing_reservation_query = select(Reservation).where(
        Reservation.goods_id == goods.id,
        Reservation.user_id == user_id,
        func.date(Reservation.reserved_at) == current_date.date()
    )
    existing_result = await db.execute(existing_reservation_query)
    if existing_result.scalars().first():
        raise HTTPException(status_code=400, detail="Вы уже бронировали этот товар сегодня")
    
    # Создаем бронирование с гарантированным user_id
    db_reservation = Reservation(
        goods_id=goods.id,
        user_id=user_id,  # Используем ID пользователя из Telegram
        quantity=reservation.quantity
    )
    db.add(db_reservation)
    
    # Уменьшаем доступное количество товара
    availability.available_quantity -= reservation.quantity
    
    await db.commit()
    await db.refresh(db_reservation)
    
    # Отправляем уведомление боту после успешного бронирования
    goods_data = {
        "id": goods.id,
        "name": goods.name,
        "article": goods.article,
        "price": goods.price,
        "cashback_percent": goods.cashback_percent,
        "image": goods.image,
        "purchase_guide": goods.purchase_guide
    }
    
    # Отправляем уведомление, но не ждем результата
    # Обернем в try-except для предотвращения ошибок
    try:
        asyncio.create_task(notify_bot_about_reservation(user_id, goods_data, reservation.quantity))
    except Exception as e:
        logger.error(f"Ошибка при создании задачи для отправки уведомления: {str(e)}")
    
    # Успешно возвращаем данные о бронировании
    return db_reservation

@app.get("/user/reservations/", response_model=List[ReservationResponse])
async def get_user_reservations(
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Получить список бронирований пользователя"""
    query = select(Reservation).filter(Reservation.user_id == user_id)
    result = await db.execute(query)
    reservations = result.scalars().all()
    
    return reservations

# Эндпоинт для проверки работоспособности API
@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

# Эндпоинты для доступности товаров
@app.get("/availability/", response_model=List[DailyAvailabilityResponse], dependencies=[Depends(verify_telegram_user)])
async def read_all_availability(
    skip: int = 0, 
    limit: int = 500,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    goods_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить данные о доступности всех товаров с возможностью фильтрации"""
    global _last_availability_request_time, _availability_cache
    
    # Проверяем, прошло ли достаточно времени с последнего запроса
    current_time = time.time()
    
    # Проверяем, можем ли мы использовать кэш
    if (_availability_cache is not None and 
        current_time - _last_availability_request_time < _availability_cache_ttl and
        not any([date_from, date_to, goods_id]) and  # Не используем кэш при фильтрации
        skip == 0 and limit == 500):  # Не используем кэш при нестандартных параметрах
        logger.info("Возвращаем кэшированные данные о доступности")
        return _availability_cache
    
    logger.info(f"Запрос списка доступности с параметрами: skip={skip}, limit={limit}, date_from={date_from}, date_to={date_to}, goods_id={goods_id}")
    
    # Обновляем время последнего запроса
    _last_availability_request_time = current_time
    
    # Создаем базовый запрос
    query = select(DailyAvailability)
    
    # Применяем фильтры
    if date_from:
        query = query.filter(DailyAvailability.date >= date_from)
    if date_to:
        query = query.filter(DailyAvailability.date <= date_to)
    if goods_id:
        query = query.filter(DailyAvailability.goods_id == goods_id)
    
    # Сортировка и пагинация
    query = query.order_by(DailyAvailability.date.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    availability_list = result.scalars().all()
    
    # Получаем информацию о товарах для отображения названий
    goods_ids = [item.goods_id for item in availability_list]
    if goods_ids:
        goods_query = select(Goods).filter(Goods.id.in_(goods_ids))
        goods_result = await db.execute(goods_query)
        goods_dict = {goods.id: goods.name for goods in goods_result.scalars().all()}
    else:
        goods_dict = {}
    
    # Формируем ответ с включением имени товара
    response_list = []
    for item in availability_list:
        availability_dict = {
            "id": item.id,
            "goods_id": item.goods_id,
            "date": item.date,
            "available_quantity": item.available_quantity,
            "goods_name": goods_dict.get(item.goods_id, None)  # Добавляем имя товара
        }
        response_list.append(availability_dict)
    
    # Обновляем кэш, если это стандартный запрос без фильтров
    if not any([date_from, date_to, goods_id]) and skip == 0 and limit == 500:
        _availability_cache = response_list
    
    return response_list

@app.get("/reservations/", dependencies=[Depends(verify_telegram_user)])
async def read_all_reservations(
    skip: int = 0, 
    limit: int = 500,
    user_id: Optional[int] = None,
    goods_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех бронирований с возможностью фильтрации"""
    logger.info(f"Запрос списка бронирований с параметрами: skip={skip}, limit={limit}, user_id={user_id}, goods_id={goods_id}, date_from={date_from}, date_to={date_to}")
    
    # Создаем базовый запрос
    query = select(Reservation)
    
    # Применяем фильтры
    if user_id:
        query = query.filter(Reservation.user_id == user_id)
    if goods_id:
        query = query.filter(Reservation.goods_id == goods_id)
    if date_from:
        query = query.filter(Reservation.reserved_at >= date_from)
    if date_to:
        query = query.filter(Reservation.reserved_at <= date_to)
    
    # Сортировка и пагинация
    query = query.order_by(Reservation.reserved_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    reservations_list = result.scalars().all()
    
    # Получаем информацию о товарах для отображения названий
    goods_ids = [item.goods_id for item in reservations_list]
    if goods_ids:
        goods_query = select(Goods).filter(Goods.id.in_(goods_ids))
        goods_result = await db.execute(goods_query)
        goods_dict = {goods.id: goods.name for goods in goods_result.scalars().all()}
    else:
        goods_dict = {}
    
    # Формируем ответ с включением имени товара
    response_list = []
    for item in reservations_list:
        reservation_dict = {
            "id": item.id,
            "user_id": item.user_id,
            "goods_id": item.goods_id,
            "quantity": item.quantity,
            "reserved_at": item.reserved_at,
            "goods_name": goods_dict.get(item.goods_id, None)  # Добавляем имя товара
        }
        response_list.append(reservation_dict)
    
    return response_list

# Для тестирования приложения
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)