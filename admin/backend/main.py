from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Query, Header, UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, or_
from typing import List, Optional, Dict, Any, Union
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import os
from datetime import datetime, timedelta
import random
from sqlalchemy import func, desc
import aiohttp
import asyncio
import json
import logging
from worker import update_goods_activity
from aiohttp import ClientSession
from sqlalchemy.orm import selectinload
from parser import parse_wildberries_url
from logging.handlers import RotatingFileHandler
from pydantic import ValidationError
import uuid
import aiofiles
from fastapi.staticfiles import StaticFiles

from database import get_db, init_db, close_db, AsyncScopedSession
from models import Goods, Reservation, DailyAvailability, Category, CategoryNote, ReservationStatus
from schemas import (
    GoodsCreate, GoodsUpdate, GoodsResponse,ReservationCreate, ReservationResponse,
    DailyAvailabilityResponse, CategoryCreate, CategoryUpdate, CategoryResponse,
    BulkVisibilityUpdate, CategoryNoteCreate, CategoryNoteResponse,
    ReservationConfirmationUpdate
)

# Настраиваем базовую конфигурацию, чтобы логи сразу уходили в stdout (для docker logs)
logging.basicConfig(
    level=logging.DEBUG,  # Максимум информации
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Убедимся, что буферизация отключена, чтобы логи писались сразу
# (Это дополнительно можно указать через переменную окружения PYTHONUNBUFFERED=1)

# Создаем директорию для логов
log_dir = "/app/logs"
os.makedirs(log_dir, exist_ok=True)

# Обработчик для записи в файл
file_handler = RotatingFileHandler(
    os.path.join(log_dir, "api.log"),
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5,
    encoding='utf-8'
)
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
))

# Обработчик для вывода в консоль (stdout), чтобы видеть логи через docker logs
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
console_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s'
))

# Настраиваем наш логгер
logger = logging.getLogger('api')
logger.setLevel(logging.DEBUG)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Теперь все логи через logger.info/error/debug будут писаться и в файл, и в docker logs.

# Получаем токен из окружения
# Добавляем режим разработки
DEVELOPMENT_MODE = os.getenv("DEVELOPMENT_MODE").lower() == "true"
TELEGRAM_WEBAPP_URL = os.getenv("TELEGRAM_WEBAPP_URL")
# Добавляем URL для бота
BOT_API_URL = os.getenv("BOT_API_URL")

# Добавляем переменную для отслеживания времени последнего запроса
_last_availability_request_time = 0
_availability_cache = None
_availability_cache_ttl = 10  # Время жизни кэша в секундах

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("База данных инициализирована")
    # Создаем директории, если они не существуют
    os.makedirs("uploads/images", exist_ok=True)
    os.makedirs("uploads/videos", exist_ok=True)
    yield
    await close_db()
    logger.info("Соединение с базой данных закрыто")

app = FastAPI(title="Goods Admin API", lifespan=lifespan)

# Добавляем CORS для обработки запросов с нового домена
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    
    # Получаем информацию о товаре
    goods_query = select(Goods).where(Goods.id == goods_id)
    goods_result = await db.execute(goods_query)
    goods = goods_result.scalar_one_or_none()
    
    if not goods:
        logger.error(f"Товар с ID {goods_id} не найден")
        return
    
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
    
    # Генерируем случайное количество товара для каждого дня в диапазоне
    current_date = start_date
    count = 0
    
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
    
    # Загружаем созданную доступность отдельным запросом
    availability_query = select(DailyAvailability).filter(
        DailyAvailability.goods_id == db_goods.id
    ).order_by(DailyAvailability.date)
    
    availability_result = await db.execute(availability_query)
    availability = availability_result.scalars().all()
    
    # Создаем словарь с данными товара для ответа
    goods_dict = {
        "id": db_goods.id,
        "name": db_goods.name,
        "price": db_goods.price,
        "cashback_percent": db_goods.cashback_percent,
        "article": db_goods.article,
        "url": db_goods.url,
        "image": db_goods.image,
        "is_active": db_goods.is_active,
        "purchase_guide": db_goods.purchase_guide,
        "start_date": db_goods.start_date,
        "end_date": db_goods.end_date,
        "min_daily": db_goods.min_daily,
        "max_daily": db_goods.max_daily,
        "created_at": db_goods.created_at,
        "updated_at": db_goods.updated_at,
        "daily_availability": [
            {
                "id": item.id,
                "goods_id": item.goods_id,
                "date": item.date,
                "available_quantity": item.available_quantity
            }
            for item in availability
        ],
        "reservations": []
    }
    
    return goods_dict

@app.get("/goods/", response_model=List[GoodsResponse], dependencies=[Depends(verify_telegram_user)])
async def read_goods(
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    include_hidden: bool = False  # По умолчанию скрытые товары не включаются
):
    """Получить список всех товаров с фильтрацией"""
    try:
        logger.info(f"Запрос товаров: search={search}, include_hidden={include_hidden}")
        
        query = select(Goods).options(
            selectinload(Goods.daily_availability),
            selectinload(Goods.category).selectinload(Category.notes),
            selectinload(Goods.reservations)  # Добавляем загрузку резерваций
        )

        # Применяем поиск, если указан
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Goods.name.ilike(search_pattern),
                    Goods.article.ilike(search_pattern)
                )
            )

        # Фильтруем скрытые товары только если include_hidden=False
        if not include_hidden:
            query = query.where(Goods.is_hidden == False)

        # Применяем пагинацию
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        goods = result.scalars().all()
        
        logger.info(f"Найдено товаров: {len(goods)}")
        return goods
    except Exception as e:
        logger.error(f"Ошибка при получении списка товаров: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении списка товаров: {str(e)}"
        )

@app.get("/goods/search/", response_model=List[GoodsResponse])
async def search_goods(
    q: str = Query(..., description="Поисковый запрос (имя или артикул)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Поиск товаров по имени или артикулу
    """
    try:
        query = select(Goods).options(
            selectinload(Goods.daily_availability),
            selectinload(Goods.category),
            selectinload(Goods.reservations)  # Добавляем загрузку резерваций
        ).filter(
            or_(
                Goods.name.ilike(f"%{q}%"),
                Goods.article.ilike(f"%{q}%")
            )
        ).limit(50)
        
        result = await db.execute(query)
        goods = result.scalars().all()
        return goods
    except Exception as e:
        logger.error(f"Ошибка при поиске товаров: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при поиске товаров: {str(e)}"
        )

@app.get("/goods/{goods_id}", response_model=GoodsResponse, dependencies=[Depends(verify_telegram_user)])
async def read_goods(goods_id: int, db: AsyncSession = Depends(get_db)):
    """Получить товар по ID"""
    try:
        # Загружаем товар вместе с категорией и примечаниями категории
        goods_query = select(Goods).options(
            selectinload(Goods.daily_availability),
            selectinload(Goods.reservations),
            selectinload(Goods.category).selectinload(Category.notes)
        ).where(Goods.id == goods_id)
        
        result = await db.execute(goods_query)
        goods = result.scalars().first()
        
        if goods is None:
            raise HTTPException(status_code=404, detail="Товар не найден")
        
        # Обязательно инициализируем поле confirmation_requirements
        if not hasattr(goods, 'confirmation_requirements') or goods.confirmation_requirements is None:
            goods.confirmation_requirements = []
        
        logger.info(f"Отправляем данные о товаре: {goods.id} - {goods.name}")
        
        # Нормализуем ответ для Pydantic модели
        return {
            **goods.__dict__,
            "confirmation_requirements": goods.confirmation_requirements or [],
            "daily_availability": [da.__dict__ for da in goods.daily_availability] if goods.daily_availability else [],
            "reservations": [res.__dict__ for res in goods.reservations] if goods.reservations else []
        }
    except Exception as e:
        logger.error(f"Ошибка при получении товара: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении товара: {str(e)}"
        )

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
    
    # Получаем обновленный товар с информацией о категории
    query = select(Goods).options(selectinload(Goods.category)).filter(Goods.id == goods_id)
    result = await db.execute(query)
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
    
    # Загружаем связанные данные
    availability_query = select(DailyAvailability).filter(DailyAvailability.goods_id == goods_id)
    availability_result = await db.execute(availability_query)
    availability = availability_result.scalars().all()
    
    reservations_query = select(Reservation).filter(Reservation.goods_id == goods_id)
    reservations_result = await db.execute(reservations_query)
    reservations = reservations_result.scalars().all()
    
    # Формируем полный ответ
    goods_dict = {
        "id": updated_goods.id,
        "name": updated_goods.name,
        "price": updated_goods.price,
        "cashback_percent": updated_goods.cashback_percent,
        "article": updated_goods.article,
        "url": updated_goods.url,
        "image": updated_goods.image,
        "is_active": updated_goods.is_active,
        "is_hidden": updated_goods.is_hidden,
        "purchase_guide": updated_goods.purchase_guide,
        "start_date": updated_goods.start_date,
        "end_date": updated_goods.end_date,
        "min_daily": updated_goods.min_daily,
        "max_daily": updated_goods.max_daily,
        "total_sales_limit": updated_goods.total_sales_limit,
        "note": updated_goods.note,
        "created_at": updated_goods.created_at,
        "updated_at": updated_goods.updated_at,
        "category_id": updated_goods.category_id,
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
        ],
        "category": {
            "id": updated_goods.category.id,
            "name": updated_goods.category.name,
            "description": updated_goods.category.description,
            "is_active": updated_goods.category.is_active
        } if updated_goods.category else None
    }
    
    return goods_dict

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
    """Получить список доступных товаров на текущую дату с учетом ограничения общего числа продаж"""
    try:
        if current_date is None:
            current_date = datetime.now()
        
        # Автоматически очищаем устаревшие записи
        await clean_expired_availability(db)
        
        # Добавляем условие is_hidden=False и загрузку связанных данных
        query = select(Goods).options(
            selectinload(Goods.daily_availability),
            selectinload(Goods.category).selectinload(Category.notes),
            selectinload(Goods.reservations)  # Добавляем загрузку резерваций
        ).where(
            Goods.is_active == True,
            Goods.is_hidden == False
        )
        
        result = await db.execute(query)
        goods = result.scalars().all()
        
        available_goods = []
        for item in goods:
            # Проверяем ограничение общего числа продаж
            if item.total_sales_limit is not None:
                # Подсчитываем текущее количество резерваций
                total_reserved = sum(res.quantity for res in item.reservations)
                
                # Если уже достигнут лимит продаж, пропускаем товар
                if total_reserved >= item.total_sales_limit:
                    continue
            
            availability_query = select(DailyAvailability).where(
                DailyAvailability.goods_id == item.id,
                DailyAvailability.date == current_date.replace(hour=0, minute=0, second=0, microsecond=0),
                DailyAvailability.available_quantity > 0
            )
            availability_result = await db.execute(availability_query)
            if availability_result.scalars().first():
                available_goods.append(item)
        
        return available_goods
    except Exception as e:
        logger.error(f"Ошибка при получении каталога: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении каталога: {str(e)}"
        )

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
    """Отправляет уведомление в Telegram бот о новом бронировании с повторными попытками"""
    bot_api_url = BOT_API_URL + "/send_notification"
    max_retries = 3
    retry_delay = 1  # Начальная задержка в секундах
    
    for attempt in range(max_retries):
        try:
            # Подготавливаем данные для отправки в бота
            data = {
                "user_id": user_id,
                "goods_data": goods_data,
                "quantity": quantity,
                "attempt": attempt + 1  # Добавляем номер попытки
            }
            
            # Асинхронный запрос к API бота
            async with ClientSession() as session:
                async with session.post(bot_api_url, json=data) as response:
                    # Проверяем статус ответа
                    if response.status != 200:
                        response_text = await response.text()
                        logger.error(f"Ошибка при отправке уведомления в бот (попытка {attempt + 1}): {response.status}, {response_text}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(retry_delay * (2 ** attempt))  # Экспоненциальная задержка
                            continue
                        return False
                    
                    # Парсим JSON из ответа
                    response_data = await response.json()
                    
                    # Проверяем статус операции
                    if response_data.get("status") != "success":
                        error_message = response_data.get("message", "Неизвестная ошибка")
                        logger.warning(f"Бот не смог отправить уведомление (попытка {attempt + 1}): {error_message}")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(retry_delay * (2 ** attempt))
                            continue
                        return False
                    
                    # Проверяем подтверждение доставки
                    if not response_data.get("delivery_confirmed", False):
                        logger.warning(f"Нет подтверждения доставки уведомления (попытка {attempt + 1})")
                        if attempt < max_retries - 1:
                            await asyncio.sleep(retry_delay * (2 ** attempt))
                            continue
                        return False
                    
                    logger.info(f"Уведомление успешно отправлено в бот для пользователя {user_id} (попытка {attempt + 1})")
                    return True
                    
        except Exception as e:
            logger.error(f"Исключение при отправке уведомления в бот (попытка {attempt + 1}): {str(e)}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay * (2 ** attempt))
                continue
            return False
    
    logger.error(f"Не удалось отправить уведомление после {max_retries} попыток")
    return False

@app.post("/reservations/", response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation: ReservationCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    try:
        # Ищем товар
        goods = await db.get(Goods, reservation.goods_id)
        if not goods:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Товар не найден")
        
        # Проверяем, что товар активен и не скрыт
        if not goods.is_active or goods.is_hidden:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Товар недоступен для бронирования")
        
        # Проверяем, что у пользователя нет активных бронирований этого товара
        stmt = select(Reservation).where(
            Reservation.goods_id == reservation.goods_id,
            Reservation.user_id == user_id,
            Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.ACTIVE])
        )
        
        # Используем значения "pending", "active" в нижнем регистре
        existing_reservation = await db.execute(
            select(Reservation).where(
                Reservation.goods_id == reservation.goods_id,
                Reservation.user_id == user_id,
                Reservation.status.in_(["pending", "active"])
            )
        )
        result = existing_reservation.scalars().first()
        
        if result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="У вас уже есть активное бронирование этого товара"
            )
        
        # Проверяем, что количество не превышает максимальное дневное
        if reservation.quantity > goods.max_daily:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Максимальное количество для бронирования: {goods.max_daily}"
            )
        
        # Проверяем, что количество не меньше минимального дневного
        if reservation.quantity < goods.min_daily:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Минимальное количество для бронирования: {goods.min_daily}"
            )
        
        # Проверяем доступность на текущую дату
        availability_query = select(DailyAvailability).filter(
            DailyAvailability.goods_id == reservation.goods_id,
            DailyAvailability.date == datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        )
        availability_result = await db.execute(availability_query)
        availability = availability_result.scalars().first()
        
        if not availability:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Товар недоступен для бронирования на текущую дату"
            )
        
        if availability.available_quantity < reservation.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Доступное количество товара: {availability.available_quantity}"
            )
        
        # Создаем запись о бронировании
        db_reservation = Reservation(
            goods_id=reservation.goods_id,
            user_id=user_id,
            quantity=reservation.quantity,
            status=ReservationStatus.PENDING  # Используем PENDING из enum
        )
        db.add(db_reservation)
        
        # Обновляем доступное количество товара
        availability.available_quantity -= reservation.quantity
        
        # Фиксируем изменения в БД
        await db.commit()
        await db.refresh(db_reservation)
        
        # Формируем ответ
        response = {
            "id": db_reservation.id,
            "user_id": db_reservation.user_id,
            "goods_id": db_reservation.goods_id,
            "quantity": db_reservation.quantity,
            "reserved_at": db_reservation.reserved_at,
            "status": db_reservation.status.value,
            "goods_name": goods.name,
            "goods_image": goods.image,
            "goods_price": goods.price,
            "goods_cashback_percent": goods.cashback_percent,
        }
        
        # Асинхронно уведомляем бота о бронировании
        asyncio.create_task(notify_bot_about_reservation(
            user_id=user_id, 
            goods_data={
                "id": goods.id,
                "name": goods.name,
                "price": goods.price,
                "cashback_percent": goods.cashback_percent,
                "image": goods.image
            },
            quantity=reservation.quantity
        ))
        
        return response
        
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка при создании бронирования: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании бронирования: {e}"
        )

@app.get("/user-reservations/", response_model=List[ReservationResponse])
async def get_current_user_reservations(
    status: Optional[str] = None,  # Можно фильтровать по статусу
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Получить список бронирований текущего пользователя"""
    if user_id is None:
        raise HTTPException(status_code=403, detail="Не удалось определить пользователя")
    
    # Создаем базовый запрос с полной загрузкой товара
    query = select(Reservation).options(
        selectinload(Reservation.goods)
    ).filter(Reservation.user_id == user_id)
    
    # Применяем фильтр по статусу, если указан
    if status:
        try:
            status_enum = ReservationStatus[status.upper()]
            query = query.filter(Reservation.status == status_enum)
        except (KeyError, ValueError):
            raise HTTPException(status_code=400, detail=f"Недопустимый статус: {status}")
    
    # Сортировка по дате бронирования (по убыванию)
    query = query.order_by(desc(Reservation.reserved_at))
    
    result = await db.execute(query)
    reservations = result.scalars().all()
    
    # Формируем ответ с полной информацией о товаре
    response_list = []
    for item in reservations:
        goods = item.goods
        
        reservation_dict = {
            "id": item.id,
            "user_id": item.user_id,
            "goods_id": item.goods_id,
            "quantity": item.quantity,
            "reserved_at": item.reserved_at,
            "status": item.status.value if item.status else "active",
            "confirmation_data": item.confirmation_data if hasattr(item, 'confirmation_data') else None,
            "goods_name": goods.name if goods else None,
            "goods_image": goods.image if goods else None,
            "goods_price": goods.price if goods else None,
            "goods_cashback_percent": goods.cashback_percent if goods else None,
            "goods": {
                "id": goods.id,
                "name": goods.name,
                "article": goods.article,
                "price": goods.price,
                "cashback_percent": goods.cashback_percent,
                "image": goods.image,
                "purchase_guide": goods.purchase_guide,
                "confirmation_requirements": goods.confirmation_requirements or []
            } if goods else None
        }
        response_list.append(reservation_dict)
    
    return response_list

# Добавляем функцию для обработки загруженных файлов
async def save_uploaded_file(
    file: UploadFile,
    folder: str,
    user_id: int,
    file_type: str
) -> Dict[str, Any]:
    """
    Сохраняет загруженный файл в папку uploads/<folder>/<user_id>/ 
    и возвращает путь к файлу без префикса 'uploads/'
    """
    logger.info(f"Сохранение {file_type} файла: {file.filename}, размер: {file.size if hasattr(file, 'size') else 'unknown'}")
    
    # Проверяем, что файл содержит данные
    if not file or not file.file:
        logger.error("Файл пуст или не содержит данных")
        raise HTTPException(status_code=400, detail="Файл пуст или не содержит данных")
    
    # Создаем директорию для загрузок, если она не существует
    user_upload_dir = f"uploads/{folder}/{user_id}"
    os.makedirs(user_upload_dir, exist_ok=True)
    
    # Генерируем уникальное имя файла
    file_extension = os.path.splitext(file.filename)[1] if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = f"{user_upload_dir}/{unique_filename}"
    
    # Логируем путь сохранения
    logger.info(f"Сохраняем файл по пути: {file_path}")
    
    try:
        # Читаем и сохраняем содержимое файла
        contents = await file.read()
        
        # Сохраняем файл
        with open(file_path, "wb") as f:
            f.write(contents)
        
        # Возвращаем информацию о сохраненном файле
        # Возвращаем путь без префикса 'uploads/' для фронтенда
        relative_path = f"{folder}/{user_id}/{unique_filename}"
        
        return {
            "filename": unique_filename,
            "content_type": file.content_type,
            "path": file_path,  # полный путь к файлу
            "relative_path": relative_path  # относительный путь для формирования URL
        }
    except Exception as e:
        logger.error(f"Ошибка при сохранении файла: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении файла: {str(e)}")

# Обновляем эндпоинт подтверждения бронирования
@app.post("/reservations/{reservation_id}/confirm", status_code=status.HTTP_200_OK)
async def confirm_reservation(
    reservation_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Подтверждение бронирования пользователем с данными подтверждения и файлами"""
    # Добавляем подробное логирование
    logger.info(f"Получен запрос на подтверждение бронирования {reservation_id} от пользователя {user_id}")
    
    if user_id is None:
        raise HTTPException(status_code=403, detail="Не удалось определить пользователя")
    
    # Получаем данные формы
    form_data = await request.form()
    
    # Разделяем файлы и текстовые данные
    files = {}
    field_data = {}
    
    # Более детальное логирование для отладки формы
    logger.info(f"Получены ключи формы: {list(form_data.keys())}")
    
    for key, value in form_data.items():
        # Добавляем проверку на UploadFile через content_type
        if hasattr(value, 'filename') and hasattr(value, 'content_type'):
            files[key] = value
            logger.info(f"Получен файл: {key}, имя: {value.filename}, тип: {value.content_type}, размер: {value.size if hasattr(value, 'size') else 'неизвестно'}")
        else:
            field_data[key] = value
            # Не логируем содержимое полей, только ключи
            logger.info(f"Получено поле: {key}")

    # Логируем полученные данные для отладки
    logger.info(f"Всего получено полей данных: {len(field_data)}")
    logger.info(f"Всего получено файлов: {len(files)}")

    # Получаем бронирование
    result = await db.execute(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(selectinload(Reservation.goods))
    )
    reservation = result.scalars().first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    
    # Проверяем права пользователя
    if reservation.user_id != user_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для подтверждения бронирования")
    
    # Проверяем, что бронирование активно
    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(status_code=400, detail=f"Бронирование не может быть подтверждено в текущем статусе: {reservation.status.value}")
    
    # Обрабатываем данные формы
    confirmation_data = {}
    
    # Группируем данные по идентификаторам полей
    field_groups = {}
    for key, value in form_data.items():
        if not key.startswith('field_'):
            continue
            
        # Извлекаем ID поля и тип (meta, text, file)
        parts = key.split('_')
        if len(parts) >= 3:
            field_id = '_'.join(parts[1:-1])  # Берем все части между field_ и _meta/_text/_file
            field_type = parts[-1]
            
            if field_id not in field_groups:
                field_groups[field_id] = {}
            
            # Сохраняем значение в соответствующую группу
            field_groups[field_id][field_type] = value
    
    # Обрабатываем сгруппированные данные
    for field_id, group in field_groups.items():
        meta_key = 'meta'
        if meta_key not in group:
            logger.warning(f"Пропускаем поле {field_id} без метаданных")
            continue
            
        try:
            meta = json.loads(group[meta_key])
            
            confirmation_data[field_id] = {
                'type': meta['type'],
                'title': meta['title'],
                'value': '',
                'file_info': None
            }
            
            # Заполняем текстовое значение
            if 'text' in group:
                confirmation_data[field_id]['value'] = group['text']
                logger.info(f"Добавлено текстовое поле {field_id}: {meta['title']}")
            
            # Обрабатываем файл
            if 'file' in group and hasattr(group['file'], 'filename'):
                file = group['file']
                file_type = meta['type']
                
                # Сохраняем файл
                folder = os.path.join('uploads', 'images' if file_type == 'photo' else 'videos')
                file_info = await save_uploaded_file(
                    file=file,
                    folder=folder,
                    user_id=user_id,
                    file_type='image' if file_type == 'photo' else 'video'
                )
                
                confirmation_data[field_id]['value'] = file_info['relative_path']
                confirmation_data[field_id]['file_info'] = file_info
                logger.info(f"Сохранен файл для поля {field_id}: {file_info['relative_path']}")
        except Exception as e:
            logger.error(f"Ошибка обработки поля {field_id}: {str(e)}")
            # Продолжаем с другими полями
    
    logger.info(f"Обработано полей подтверждения: {len(confirmation_data)}")
    
    # Сохраняем данные подтверждения и обновляем статус
    reservation.confirmation_data = confirmation_data
    reservation.status = ReservationStatus.CONFIRMED
    
    await db.commit()
    await db.refresh(reservation)
    
    # Добавляем уведомление администраторов о подтверждении бронирования
    if hasattr(reservation, 'goods') and reservation.goods:
        goods_data = {
            "id": reservation.goods.id,
            "name": reservation.goods.name,
            "article": reservation.goods.article,
            "price": reservation.goods.price,
            "cashback_percent": reservation.goods.cashback_percent,
            "image": reservation.goods.image
        }
        
        # Асинхронно отправляем уведомление администраторам
        asyncio.create_task(notify_admin_about_confirmation(
            user_id=user_id,
            goods_data=goods_data,
            reservation_id=reservation_id,
            confirmation_data=confirmation_data
        ))
    
    return {"status": "success", "message": "Бронирование подтверждено с данными"}

# Добавляем эндпоинт для отмены бронирования с обновлением статуса
@app.post("/reservations/{reservation_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_reservation_with_status(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Отмена бронирования с обновлением статуса"""
    if user_id is None:
        raise HTTPException(status_code=403, detail="Не удалось определить пользователя")
    
    # Получаем бронирование
    result = await db.execute(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(selectinload(Reservation.goods))
    )
    reservation = result.scalars().first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    
    # Проверяем права пользователя
    if reservation.user_id != user_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для отмены бронирования")
    
    # Проверяем, можно ли отменить бронирование
    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(status_code=400, detail=f"Бронирование не может быть отменено в текущем статусе: {reservation.status.value}")
    
    # Обновляем статус бронирования на CANCELED
    reservation.status = ReservationStatus.CANCELED
    
    # Находим соответствующую запись о доступности
    availability_result = await db.execute(
        select(DailyAvailability)
        .where(
            DailyAvailability.goods_id == reservation.goods_id,
            DailyAvailability.date == reservation.reserved_at.date()
        )
    )
    daily_availability = availability_result.scalars().first()
    
    if daily_availability:
        # Возвращаем товар в доступное количество
        daily_availability.available_quantity += reservation.quantity
    
    await db.commit()
    
    return {"status": "success", "message": "Бронирование отменено"}

# Обновляем эндпоинт получения всех бронирований с фильтрацией по статусу
@app.get("/reservations/", dependencies=[Depends(verify_telegram_user)])
async def read_all_reservations(
    skip: int = 0, 
    limit: int = 500,
    user_id: Optional[int] = None,
    goods_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    status: Optional[str] = None,  # Фильтр по статусу
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех бронирований с возможностью фильтрации"""
    logger.info(f"Запрос списка бронирований с параметрами: skip={skip}, limit={limit}, user_id={user_id}, goods_id={goods_id}, date_from={date_from}, date_to={date_to}, status={status}")
    
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
    if status:
        # Проверяем корректность статуса
        try:
            status_enum = ReservationStatus[status.upper()]
            query = query.filter(Reservation.status == status_enum)
        except (KeyError, ValueError):
            # Если статус не является допустимым значением Enum, игнорируем этот фильтр
            logger.warning(f"Недопустимое значение статуса: {status}")
    
    # Сортировка и пагинация
    query = query.order_by(Reservation.reserved_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    reservations_list = result.scalars().all()
    
    # Получаем информацию о товарах для отображения названий
    goods_ids = [item.goods_id for item in reservations_list]
    if goods_ids:
        goods_query = select(Goods).filter(Goods.id.in_(goods_ids))
        goods_result = await db.execute(goods_query)
        goods_dict = {goods.id: goods for goods in goods_result.scalars().all()}
    else:
        goods_dict = {}
    
    # Формируем ответ с включением имени товара и статуса
    response_list = []
    for item in reservations_list:
        goods = goods_dict.get(item.goods_id)
        
        # Проверяем и нормализуем данные подтверждения
        confirmation_data = {}
        if item.confirmation_data:
            # Обрабатываем пути к файлам в данных подтверждения
            for field_id, field_data in item.confirmation_data.items():
                processed_field = field_data.copy()
                if field_data.get('type') in ['photo', 'video'] and field_data.get('value'):
                    # Получаем чистый путь к файлу без 'uploads/' в начале
                    path = field_data['value']
                    # Удаляем все начальные слеши
                    while path.startswith('/'):
                        path = path[1:]
                    # Удаляем префикс 'uploads/' если он есть
                    if path.startswith('uploads/'):
                        path = path[8:]
                        
                    processed_field['value'] = path
                    logger.info(f"Нормализованный путь к файлу для поля {field_id}: {processed_field['value']}")
                confirmation_data[field_id] = processed_field
        
        reservation_dict = {
            "id": item.id,
            "user_id": item.user_id,
            "goods_id": item.goods_id,
            "quantity": item.quantity,
            "reserved_at": item.reserved_at,
            "status": item.status.value if item.status else "active",
            "confirmation_data": confirmation_data,
            "goods_name": goods.name if goods else None,
            "goods_image": goods.image if goods else None,
            "goods_price": goods.price if goods else None,
            "goods_cashback_percent": goods.cashback_percent if goods else None
        }
        response_list.append(reservation_dict)
    
    logger.info(f"Возвращаем {len(response_list)} бронирований")
    return response_list

@app.delete("/reservations/{reservation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_reservation(
    reservation_id: int, 
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Отмена бронирования и возврат товара"""
    logger.info(f"Запрос на отмену бронирования {reservation_id} от пользователя {user_id}")
    
    # Получаем бронирование
    result = await db.execute(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(selectinload(Reservation.goods))
    )
    reservation = result.scalars().first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    
    # Проверяем права пользователя
    if reservation.user_id != user_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для отмены бронирования")
    
    # Находим соответствующую запись о доступности
    availability_result = await db.execute(
        select(DailyAvailability)
        .where(
            DailyAvailability.goods_id == reservation.goods_id,
            DailyAvailability.date == reservation.reserved_at.date()
        )
    )
    daily_availability = availability_result.scalars().first()
    
    if daily_availability:
        # Возвращаем товар в доступное количество
        daily_availability.available_quantity += reservation.quantity
        await db.commit()
        logger.info(f"Возвращено {reservation.quantity} шт. товара {reservation.goods_id}")
    
    # Удаляем бронирование
    await db.execute(
        delete(Reservation)
        .where(Reservation.id == reservation_id)
    )
    await db.commit()
    
    return None

@app.post("/parse-wildberries/")
async def parse_wildberries(request_data: dict):
    """Парсит данные о товаре с Wildberries по URL"""
    url = request_data.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="URL не указан")
    
    try:
        # Используем функцию из parser.py
        result = await parse_wildberries_url(url)
        
        if not result:
            raise HTTPException(status_code=404, detail="Не удалось получить информацию о товаре")
            
        return result
        
    except Exception as e:
        logger.exception(f"Ошибка при парсинге товара: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка при парсинге товара: {str(e)}")


@app.delete("/reservations/{reservation_id}/user/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def bot_cancel_reservation(reservation_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    """Отмена бронирования по прямому запросу от бота"""
    # Получаем бронирование
    result = await db.execute(
        select(Reservation)
        .where(Reservation.id == reservation_id)
        .options(selectinload(Reservation.goods))
    )
    reservation = result.scalars().first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="Бронирование не найдено")
    
    # Проверяем права пользователя
    if reservation.user_id != user_id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для отмены бронирования")
    
    # Находим соответствующую запись о доступности
    availability_result = await db.execute(
        select(DailyAvailability)
        .where(
            DailyAvailability.goods_id == reservation.goods_id,
            DailyAvailability.date == reservation.reserved_at.date()
        )
    )
    daily_availability = availability_result.scalars().first()
    
    if daily_availability:
        # Возвращаем товар в доступное количество
        daily_availability.available_quantity += reservation.quantity
        await db.commit()
        logger.info(f"Возвращено {reservation.quantity} шт. товара {reservation.goods_id}")
    
    # Удаляем бронирование
    await db.execute(
        delete(Reservation)
        .where(Reservation.id == reservation_id)
    )
    await db.commit()
    
    return None

# Эндпоинты для категорий
@app.post("/categories/", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(category: CategoryCreate, db: AsyncSession = Depends(get_db)):
    """Создать новую категорию товаров"""
    try:
        db_category = Category(
            name=category.name,
            description=category.description,
            is_active=category.is_active
        )
        db.add(db_category)
        await db.commit()
        await db.refresh(db_category)
        
        # Создаем объект ответа вручную, чтобы избежать проблем с lazy loading
        return {
            "id": db_category.id,
            "name": db_category.name,
            "description": db_category.description,
            "is_active": db_category.is_active,
            "created_at": db_category.created_at,
            "updated_at": db_category.updated_at,
            "notes": []  # Новая категория не имеет примечаний
        }
    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка при создании категории: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при создании категории: {str(e)}"
        )

@app.get("/categories/", response_model=List[CategoryResponse])
async def read_all_categories(
    skip: int = 0, 
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получить список всех категорий товаров"""
    try:
        # Создаем базовый запрос
        query = select(Category)
        
        # Применяем фильтр по активности, если указан
        if is_active is not None:
            query = query.filter(Category.is_active == is_active)
        
        # Добавляем пагинацию
        query = query.offset(skip).limit(limit)
        
        # Выполняем запрос
        result = await db.execute(query)
        categories = result.scalars().all()
        
        # Формируем список категорий с примечаниями
        response_list = []
        for category in categories:
            # Загружаем примечания для текущей категории
            notes_query = select(CategoryNote).filter(CategoryNote.category_id == category.id)
            notes_result = await db.execute(notes_query)
            notes = notes_result.scalars().all()
            
            # Формируем объект категории с примечаниями
            category_dict = {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "is_active": category.is_active,
                "created_at": category.created_at,
                "updated_at": category.updated_at,
                "notes": [
                    {
                        "id": note.id,
                        "category_id": note.category_id,
                        "text": note.text,
                        "created_at": note.created_at
                    } 
                    for note in notes
                ]
            }
            response_list.append(category_dict)
        
        return response_list
    except Exception as e:
        logger.error(f"Ошибка при получении списка категорий: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении списка категорий: {str(e)}"
        )

@app.get("/categories/{category_id}", response_model=CategoryResponse)
async def read_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """Получить категорию по ID"""
    try:
        # Получаем категорию
        query = select(Category).filter(Category.id == category_id)
        result = await db.execute(query)
        category = result.scalars().first()
        
        if not category:
            raise HTTPException(status_code=404, detail="Категория не найдена")
        
        # Получаем примечания для категории
        notes_query = select(CategoryNote).filter(CategoryNote.category_id == category_id)
        notes_result = await db.execute(notes_query)
        notes = notes_result.scalars().all()
        
        # Формируем ответ
        return {
            "id": category.id,
            "name": category.name,
            "description": category.description,
            "is_active": category.is_active,
            "created_at": category.created_at,
            "updated_at": category.updated_at,
            "notes": [
                {
                    "id": note.id,
                    "category_id": note.category_id,
                    "text": note.text,
                    "created_at": note.created_at
                } 
                for note in notes
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка при получении категории: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при получении категории: {str(e)}"
        )

@app.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: int, 
    category_data: CategoryUpdate, 
    db: AsyncSession = Depends(get_db)
):
    """Обновить категорию по ID"""
    try:
        query = select(Category).filter(Category.id == category_id)
        result = await db.execute(query)
        db_category = result.scalars().first()
        
        if not db_category:
            raise HTTPException(status_code=404, detail="Категория не найдена")
        
        # Обновляем только предоставленные поля
        update_data = category_data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_category, key, value)
        
        await db.commit()
        await db.refresh(db_category)
        
        # Получаем примечания для обновленной категории
        notes_query = select(CategoryNote).filter(CategoryNote.category_id == category_id)
        notes_result = await db.execute(notes_query)
        notes = notes_result.scalars().all()
        
        # Создаем словарь с данными категории и примечаниями
        category_dict = {
            "id": db_category.id,
            "name": db_category.name,
            "description": db_category.description,
            "is_active": db_category.is_active,
            "created_at": db_category.created_at,
            "updated_at": db_category.updated_at,
            "notes": [
                {
                    "id": note.id,
                    "category_id": note.category_id,
                    "text": note.text,
                    "created_at": note.created_at
                } 
                for note in notes
            ]
        }
        
        return category_dict
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка при обновлении категории: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при обновлении категории: {str(e)}"
        )

@app.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(category_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить категорию по ID"""
    result = await db.execute(select(Category).filter(Category.id == category_id))
    category = result.scalars().first()
    
    if category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Обновляем все товары, связанные с этой категорией
    await db.execute(
        update(Goods)
        .where(Goods.category_id == category_id)
        .values(category_id=None)
    )
    
    # Удаляем категорию
    await db.execute(delete(Category).where(Category.id == category_id))
    await db.commit()
    
    return None


@app.put("/goods/bulk/hide", status_code=status.HTTP_200_OK)
async def bulk_hide_goods(
    payload: BulkVisibilityUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Массовое скрытие товаров"""
    try:
        goods_ids = payload.goods_ids
        logger.info(f"Запрос на скрытие товаров: {goods_ids}")
        
        if not goods_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Список товаров для скрытия пуст"
            )

        # Обновляем все указанные товары
        await db.execute(
            update(Goods)
            .where(Goods.id.in_(goods_ids))
            .values(is_hidden=True, updated_at=datetime.utcnow())
        )
        await db.commit()
        
        # Получаем обновленные товары для логирования
        result = await db.execute(
            select(Goods.id, Goods.name)
            .where(Goods.id.in_(goods_ids))
        )
        updated_goods = result.all()
        
        logger.info(f"Успешно скрыты товары: {[g.name for g in updated_goods]}")
        
        return {"message": f"Успешно скрыто товаров: {len(goods_ids)}"}
        
    except ValidationError as e:
        logger.error(f"Ошибка валидации данных: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка при скрытии товаров: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при скрытии товаров: {str(e)}"
        )

@app.put("/goods/bulk/show", status_code=status.HTTP_200_OK)
async def bulk_show_goods(
    payload: BulkVisibilityUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Массовое отображение товаров"""
    try:
        goods_ids = payload.goods_ids
        logger.info(f"Запрос на отображение товаров: {goods_ids}")
        
        if not goods_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Список товаров для отображения пуст"
            )

        # Обновляем все указанные товары
        await db.execute(
            update(Goods)
            .where(Goods.id.in_(goods_ids))
            .values(is_hidden=False, updated_at=datetime.utcnow())
        )
        
        await db.commit()
        
        # Получаем обновленные товары для логирования
        result = await db.execute(
            select(Goods.id, Goods.name)
            .where(Goods.id.in_(goods_ids))
        )
        updated_goods = result.all()
        
        logger.info(f"Успешно показаны товары: {[g.name for g in updated_goods]}")
        
        return {"message": f"Успешно показано товаров: {len(goods_ids)}"}
        
    except ValidationError as e:
        logger.error(f"Ошибка валидации данных: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Ошибка при отображении товаров: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при отображении товаров: {str(e)}"
        )

# Эндпоинты для примечаний категорий
@app.post("/category-notes/", response_model=CategoryNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_category_note(note: CategoryNoteCreate, db: AsyncSession = Depends(get_db)):
    """Создать новое примечание для категории"""
    # Проверяем существование категории
    result = await db.execute(select(Category).filter(Category.id == note.category_id))
    category = result.scalars().first()
    
    if category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    db_note = CategoryNote(**note.dict())
    db.add(db_note)
    await db.commit()
    await db.refresh(db_note)
    return db_note

@app.get("/category-notes/{category_id}", response_model=List[CategoryNoteResponse])
async def read_category_notes(category_id: int, db: AsyncSession = Depends(get_db)):
    """Получить все примечания для указанной категории"""
    # Проверяем существование категории
    result = await db.execute(select(Category).filter(Category.id == category_id))
    category = result.scalars().first()
    
    if category is None:
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Получаем примечания
    notes_query = select(CategoryNote).filter(CategoryNote.category_id == category_id)
    notes_result = await db.execute(notes_query)
    notes = notes_result.scalars().all()
    
    return notes

@app.delete("/category-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category_note(note_id: int, db: AsyncSession = Depends(get_db)):
    """Удалить примечание для категории"""
    result = await db.execute(select(CategoryNote).filter(CategoryNote.id == note_id))
    note = result.scalars().first()
    
    if note is None:
        raise HTTPException(status_code=404, detail="Примечание не найдено")
    
    await db.delete(note)
    await db.commit()
    return None

# Монтируем папку uploads как статические файлы 
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Создаем директории для статических файлов, если их нет
os.makedirs("uploads/images", exist_ok=True)
os.makedirs("uploads/videos", exist_ok=True)

# Монтируем статические директории
app.mount("/api/static", StaticFiles(directory="uploads"), name="static")

# Для тестирования приложения
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

async def notify_admin_about_confirmation(user_id: int, goods_data: Dict, reservation_id: int, confirmation_data: Dict):
    """Отправляет уведомление администраторам о подтверждении бронирования"""
    try:
        # Формируем сообщение с данными подтверждения
        confirmation_details = []
        for field_id, data in confirmation_data.items():
            if data['type'] == 'text':
                confirmation_details.append(f"{data['title']}: {data['value']}")
            else:
                confirmation_details.append(f"{data['title']}: [Файл загружен]")
        
        message = f"🔔 Пользователь {user_id} подтвердил выкуп товара!\n\n"
        message += f"📦 Товар: {goods_data['name']}\n"
        message += f"💲 Цена: {goods_data['price']} ₽\n"
        message += f"🔢 Артикул: {goods_data['article']}\n\n"
        message += "📋 Данные подтверждения:\n"
        message += "\n".join(confirmation_details)
        
        # ID супер-администраторов из переменной окружения
        super_admin_ids = os.getenv("SUPER_ADMIN_IDS", "").split(",")
        
        # Отправляем уведомление каждому супер-администратору
        async with aiohttp.ClientSession() as session:
            for admin_id in super_admin_ids:
                if admin_id:
                    admin_id = int(admin_id)
                    endpoint = f"{BOT_API_URL}/send-confirmation-notification"
                    async with session.post(
                        endpoint,
                        json={
                            "user_id": admin_id,
                            "message": message,
                            "reservation_id": reservation_id
                        },
                        timeout=aiohttp.ClientTimeout(total=5)
                    ) as response:
                        if response.status != 200:
                            logger.warning(f"Ошибка при отправке уведомления администратору {admin_id}: {response.status}")
    except Exception as e:
        logger.error(f"Ошибка при отправке уведомления администраторам: {str(e)}")

@app.get("/availability/", response_model=List[Dict[str, Any]])
async def get_all_availability(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    """Получение всех данных о доступности товаров с названиями и артикулами"""
    
    query = select(
        DailyAvailability.id,
        DailyAvailability.goods_id,
        DailyAvailability.date,
        DailyAvailability.available_quantity,
        Goods.name.label("goods_name"),
        Goods.article.label("goods_article"),
        Goods.image.label("goods_image"),
        Goods.price.label("goods_price")
    ).join(
        Goods, DailyAvailability.goods_id == Goods.id
    )
    
    # Добавляем фильтры по дате, если они указаны
    if date_from:
        query = query.filter(DailyAvailability.date >= date_from)
    if date_to:
        query = query.filter(DailyAvailability.date <= date_to)
    
    # Сортируем по goods_id и дате
    query = query.order_by(DailyAvailability.goods_id, DailyAvailability.date)
    
    try:
        result = await db.execute(query)
        availability_data = result.mappings().all()
        
        # Преобразуем данные для удобства использования на фронтенде
        return [dict(item) for item in availability_data]
    except Exception as e:
        logger.error(f"Ошибка при получении данных о доступности: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при получении данных о доступности: {str(e)}"
        )

@app.post("/reservations/{reservation_id}/confirm-order", status_code=status.HTTP_200_OK)
async def confirm_reservation_order(
    reservation_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Подтверждение заказа (перевод из pending в active)"""
    try:
        # Получаем бронирование по ID
        query = select(Reservation).filter(Reservation.id == reservation_id)
        result = await db.execute(query)
        reservation = result.scalars().first()
        
        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Бронирование с ID {reservation_id} не найдено"
            )
        
        # Проверяем, что бронирование принадлежит пользователю
        if reservation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет прав на подтверждение этого бронирования"
            )
        
        # Проверяем, что бронирование находится в статусе PENDING
        if reservation.status != ReservationStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Нельзя подтвердить заказ для бронирования в статусе {reservation.status.value}"
            )
        
        # Получаем данные товара
        goods_query = select(Goods).filter(Goods.id == reservation.goods_id)
        goods_result = await db.execute(goods_query)
        goods = goods_result.scalars().first()
        
        if not goods:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Товар с ID {reservation.goods_id} не найден"
            )
        
        # Обрабатываем форму данных
        form_data = await request.form()
        
        # Инициализируем словарь для данных подтверждения
        confirmation_data = {}
        
        # Обрабатываем метаданные полей
        for key in form_data.keys():
            if key.startswith('field_') and key.endswith('_meta'):
                field_id = key.split('_')[1]  # Извлекаем ID поля
                try:
                    meta = json.loads(form_data[key])
                    field_type = meta.get('type', 'text')
                    field_title = meta.get('title', 'Без названия')
                    
                    # Инициализируем запись для поля
                    confirmation_data[field_id] = {
                        'type': field_type,
                        'title': field_title,
                        'value': ''
                    }
                    
                    # Получаем значение поля в зависимости от его типа
                    if field_type == 'text':
                        text_key = f'field_{field_id}_text'
                        if text_key in form_data:
                            confirmation_data[field_id]['value'] = form_data[text_key]
                    elif field_type in ['photo', 'video']:
                        file_key = f'field_{field_id}_file'
                        if file_key in form_data:
                            # Сохраняем файл на сервере
                            file = form_data[file_key]
                            file_type = 'image' if field_type == 'photo' else 'video'
                            
                            # Проверяем размер файла
                            max_size_mb = 5 if field_type == 'photo' else 50
                            max_size_bytes = max_size_mb * 1024 * 1024
                            
                            if not hasattr(file, 'file'):
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Не удалось обработать файл для поля {field_title}"
                                )
                            
                            if file.size > max_size_bytes:
                                raise HTTPException(
                                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                    detail=f"Файл слишком большой. Максимальный размер: {max_size_mb} МБ"
                                )
                            
                            # Сохраняем файл
                            file_info = await save_uploaded_file(file, file_type + 's', user_id, file_type)
                            confirmation_data[field_id]['value'] = file_info['relative_path']
                except Exception as e:
                    logger.error(f"Ошибка при обработке поля {key}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Ошибка при обработке поля: {str(e)}"
                    )
        
        # Проверяем, что все необходимые поля заполнены
        for field_id, field_data in confirmation_data.items():
            if not field_data['value']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Поле '{field_data['title']}' обязательно для заполнения"
                )
        
        # Обновляем бронирование
        reservation.status = ReservationStatus.ACTIVE
        reservation.confirmation_data = confirmation_data
        
        await db.commit()
        
        # Асинхронно уведомляем администратора о подтверждении заказа
        goods_data = {
            "id": goods.id,
            "name": goods.name,
            "price": goods.price,
            "cashback_percent": goods.cashback_percent,
            "image": goods.image
        }
        asyncio.create_task(notify_admin_about_confirmation(
            user_id, goods_data, reservation_id, confirmation_data
        ))
        
        return {"status": "success", "message": "Заказ успешно подтвержден"}
    
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Ошибка при подтверждении заказа: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при подтверждении заказа: {e}"
        )

@app.post("/reservations/{reservation_id}/confirm-delivery", status_code=status.HTTP_200_OK)
async def confirm_reservation_delivery(
    reservation_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(verify_telegram_user)
):
    """Подтверждение получения товара (перевод из active в confirmed)"""
    try:
        # Получаем бронирование по ID
        query = select(Reservation).filter(Reservation.id == reservation_id)
        result = await db.execute(query)
        reservation = result.scalars().first()
        
        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Бронирование с ID {reservation_id} не найдено"
            )
        
        # Проверяем, что бронирование принадлежит пользователю
        if reservation.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="У вас нет прав на подтверждение этого бронирования"
            )
        
        # Проверяем, что бронирование находится в статусе ACTIVE
        if reservation.status != ReservationStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Нельзя подтвердить получение для бронирования в статусе {reservation.status.value}"
            )
        
        # Получаем данные товара
        goods_query = select(Goods).filter(Goods.id == reservation.goods_id)
        goods_result = await db.execute(goods_query)
        goods = goods_result.scalars().first()
        
        if not goods:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Товар с ID {reservation.goods_id} не найден"
            )
        
        # Обрабатываем форму данных
        form_data = await request.form()
        
        # Инициализируем словарь для данных подтверждения получения
        delivery_confirmation_data = {}
        
        # Обрабатываем метаданные полей
        for key in form_data.keys():
            if key.startswith('field_') and key.endswith('_meta'):
                field_id = key.split('_')[1]  # Извлекаем ID поля
                try:
                    meta = json.loads(form_data[key])
                    field_type = meta.get('type', 'text')
                    field_title = meta.get('title', 'Без названия')
                    
                    # Инициализируем запись для поля
                    delivery_confirmation_data[field_id] = {
                        'type': field_type,
                        'title': field_title,
                        'value': ''
                    }
                    
                    # Получаем значение поля в зависимости от его типа
                    if field_type == 'text':
                        text_key = f'field_{field_id}_text'
                        if text_key in form_data:
                            delivery_confirmation_data[field_id]['value'] = form_data[text_key]
                    elif field_type in ['photo', 'video']:
                        file_key = f'field_{field_id}_file'
                        if file_key in form_data:
                            # Сохраняем файл на сервере
                            file = form_data[file_key]
                            file_type = 'image' if field_type == 'photo' else 'video'
                            
                            # Проверяем размер файла
                            max_size_mb = 5 if field_type == 'photo' else 50
                            max_size_bytes = max_size_mb * 1024 * 1024
                            
                            if not hasattr(file, 'file'):
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Не удалось обработать файл для поля {field_title}"
                                )
                            
                            if file.size > max_size_bytes:
                                raise HTTPException(
                                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                    detail=f"Файл слишком большой. Максимальный размер: {max_size_mb} МБ"
                                )
                            
                            # Сохраняем файл
                            file_info = await save_uploaded_file(file, file_type + 's', user_id, file_type)
                            delivery_confirmation_data[field_id]['value'] = file_info['relative_path']
                except Exception as e:
                    logger.error(f"Ошибка при обработке поля {key}: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Ошибка при обработке поля: {str(e)}"
                    )
        
        # Проверяем, что все необходимые поля заполнены
        for field_id, field_data in delivery_confirmation_data.items():
            if not field_data['value']:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Поле '{field_data['title']}' обязательно для заполнения"
                )
        
        # Объединяем данные подтверждения заказа и получения
        original_confirmation = reservation.confirmation_data or {}
        for key, value in delivery_confirmation_data.items():
            original_confirmation[f"delivery_{key}"] = value
        
        # Обновляем бронирование
        reservation.status = ReservationStatus.CONFIRMED
        reservation.confirmation_data = original_confirmation
        
        await db.commit()
        
        # Асинхронно уведомляем администратора о подтверждении получения
        goods_data = {
            "id": goods.id,
            "name": goods.name,
            "price": goods.price,
            "cashback_percent": goods.cashback_percent,
            "image": goods.image
        }
        asyncio.create_task(notify_admin_about_delivery_confirmation(
            user_id, goods_data, reservation_id, delivery_confirmation_data
        ))
        
        return {"status": "success", "message": "Получение товара успешно подтверждено"}
    
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        logger.error(f"Ошибка при подтверждении получения: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при подтверждении получения: {e}"
        )