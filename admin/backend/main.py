from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update, delete, or_
from typing import List, Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import hashlib
import hmac
from urllib.parse import urlencode
import os

from database import get_db, init_db, close_db, AsyncScopedSession
from models import Goods, Admin
from schemas import GoodsBase, GoodsCreate, GoodsUpdate, GoodsResponse

# Получаем токен из окружения
BOT_TOKEN = os.environ.get("BOT_TOKEN")

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()

app = FastAPI(title="Goods Admin API", lifespan=lifespan)

# Настройка CORS для работы с React на порту 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://libertylib.online"],  # Адрес React-приложения
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

telegram_security = HTTPBearer()

async def verify_telegram_user(
    credentials: HTTPAuthorizationCredentials = Depends(telegram_security)
):
    try:
        # Проверка подписи Telegram WebApp
        data = dict(pair.split('=') for pair in credentials.credentials.split('&'))
        hash_str = data.pop('hash')
        
        secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
        check_hash = hmac.new(secret_key, urlencode(data).encode(), hashlib.sha256).hexdigest()
        
        if check_hash != hash_str:
            raise HTTPException(status_code=403, detail="Invalid auth")
            
        user_id = int(data['user']['id'])
        # Проверка что пользователь в списке админов
        async with AsyncScopedSession() as session:
            admin = await session.get(Admin, user_id)
            if not admin:
                raise HTTPException(status_code=403, detail="Not an admin")
                
        return user_id
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))

# CRUD маршруты
@app.post("/goods/", response_model=GoodsResponse, status_code=status.HTTP_201_CREATED)
async def create_goods(goods: GoodsCreate, db: AsyncSession = Depends(get_db)):
    """Создать новый товар"""
    db_goods = Goods(**goods.dict())
    db.add(db_goods)
    await db.commit()
    await db.refresh(db_goods)
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

# Для тестирования приложения
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)