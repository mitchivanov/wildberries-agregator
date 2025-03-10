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

from database import get_db, init_db, close_db, AsyncScopedSession
from models import Goods, Reservation, DailyAvailability
from schemas import (
    GoodsCreate, GoodsUpdate, GoodsResponse,ReservationCreate, ReservationResponse,
)

# Получаем токен из окружения
BOT_TOKEN = os.environ.get("BOT_TOKEN")
# Добавляем режим разработки
DEVELOPMENT_MODE = os.environ.get("DEVELOPMENT_MODE", "True").lower() == "true"

# Добавляем URL для бота
BOT_API_URL = os.getenv("BOT_API_URL", "http://bot:8080")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()

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

# CRUD маршруты
@app.post("/goods/", response_model=GoodsResponse, status_code=status.HTTP_201_CREATED)
async def create_goods(goods: GoodsCreate, db: AsyncSession = Depends(get_db)):
    """Создать новый товар и сгенерировать доступность по дням"""
    db_goods = Goods(**goods.dict())
    db.add(db_goods)
    await db.commit()
    await db.refresh(db_goods)
    
    # Если указаны даты начала и конца продажи, генерируем доступность
    if db_goods.start_date and db_goods.end_date:
        await generate_daily_availability(db, db_goods)
        
    return db_goods

async def generate_daily_availability(db: AsyncSession, goods: Goods):
    """Генерирует случайное количество товаров для каждого дня в промежутке продажи"""
    current_date = goods.start_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_date = goods.end_date.replace(hour=0, minute=0, second=0, microsecond=0)
    
    while current_date <= end_date:
        # Генерируем случайное число в диапазоне [min_daily, max_daily]
        daily_quantity = random.randint(goods.min_daily, goods.max_daily)
        
        # Создаем запись о доступности на этот день
        availability = DailyAvailability(
            goods_id=goods.id,
            date=current_date,
            available_quantity=daily_quantity
        )
        db.add(availability)
        
        # Переходим к следующему дню
        current_date += timedelta(days=1)
    
    await db.commit()

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
    query = select(Goods)
    
    # Применяем фильтры через единый метод
    filters = {
        'name': name,
        'price': {'min': min_price, 'max': max_price},
        'article': article,
        'is_active': is_active
    }
    query = apply_query_filters(query, filters)
    
    # Применяем пагинацию
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    goods = result.scalars().all()
    return goods

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

@app.get("/goods/{goods_id}", response_model=GoodsResponse)
async def read_goods(goods_id: int, db: AsyncSession = Depends(get_db)):
    """Получить товар по ID"""
    result = await db.execute(select(Goods).filter(Goods.id == goods_id))
    goods = result.scalars().first()
    
    if goods is None:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return goods

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

# Функция уведомления бота с обработкой ошибок
async def notify_bot_about_reservation(user_id, goods_data, quantity):
    try:
        # Формируем данные для отправки боту
        current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        payload = {
            "user_id": user_id,
            "goods_data": goods_data,
            "quantity": quantity,
            "reservation_date": current_date
        }
        
        print(f"Отправка уведомления в бот по адресу: {BOT_API_URL}/send_notification")
        
        # Делаем POST запрос к API бота
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{BOT_API_URL}/send_notification", json=payload, timeout=5) as response:
                if response.status != 200:
                    error_text = await response.text()
                    print(f"Ошибка отправки уведомления боту: {error_text}")
                    return {"status": "error", "message": error_text}
                
                return await response.json()
    except Exception as e:
        print(f"Ошибка при взаимодействии с ботом: {str(e)}")
        # Важно: не блокируем основной процесс, если бот недоступен
        return {"status": "error", "message": str(e)}

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
    # Но не блокируем процесс, если бот недоступен
    goods_data = {
        "id": goods.id,
        "name": goods.name,
        "article": goods.article,
        "price": goods.price,
        "image": goods.image,
        "purchase_guide": goods.purchase_guide
    }
    
    # Отправляем уведомление, но не ждем результата
    asyncio.create_task(notify_bot_about_reservation(user_id, goods_data, reservation.quantity))
    
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


# Для тестирования приложения
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)