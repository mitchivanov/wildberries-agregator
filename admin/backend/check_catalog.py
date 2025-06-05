import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from datetime import datetime
import os

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@localhost:5432/wildberries_db')

async def check_goods():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Импортируем модели
        from models import Goods, DailyAvailability
        
        # Проверяем общее количество товаров
        total_goods = await session.execute(select(func.count(Goods.id)))
        total = total_goods.scalar()
        print(f'Всего товаров в базе: {total}')
        
        # Проверяем активные и видимые товары
        active_visible = await session.execute(
            select(func.count(Goods.id)).where(
                Goods.is_active == True,
                Goods.is_hidden == False
            )
        )
        active_count = active_visible.scalar()
        print(f'Активных и видимых товаров: {active_count}')
        
        # Проверяем товары с правильными датами
        today = datetime.now()
        date_filtered = await session.execute(
            select(func.count(Goods.id)).where(
                Goods.is_active == True,
                Goods.is_hidden == False,
                Goods.start_date <= today,
                Goods.end_date >= today
            )
        )
        date_count = date_filtered.scalar()
        print(f'Товаров с корректными датами: {date_count}')
        
        # Проверяем доступность на сегодня
        today_date = today.replace(hour=0, minute=0, second=0, microsecond=0)
        availability = await session.execute(
            select(func.count(func.distinct(DailyAvailability.goods_id))).where(
                DailyAvailability.date == today_date,
                DailyAvailability.available_quantity > 0
            )
        )
        avail_count = availability.scalar()
        print(f'Товаров с доступностью на сегодня: {avail_count}')
        
        # Проверяем пересечение - товары которые должны быть видны в каталоге
        catalog_query = select(func.count(func.distinct(Goods.id))).select_from(Goods).join(
            DailyAvailability,
            (Goods.id == DailyAvailability.goods_id) & 
            (DailyAvailability.date == today_date) & 
            (DailyAvailability.available_quantity > 0)
        ).where(
            Goods.is_active == True,
            Goods.is_hidden == False,
            Goods.start_date <= today,
            Goods.end_date >= today
        )
        catalog_result = await session.execute(catalog_query)
        catalog_count = catalog_result.scalar()
        print(f'\nТоваров должно быть видно в каталоге: {catalog_count}')
        
        # Выводим примеры товаров которые должны быть видны
        examples_query = select(Goods.id, Goods.name, Goods.is_active, Goods.is_hidden).select_from(Goods).join(
            DailyAvailability,
            (Goods.id == DailyAvailability.goods_id) & 
            (DailyAvailability.date == today_date) & 
            (DailyAvailability.available_quantity > 0)
        ).where(
            Goods.is_active == True,
            Goods.is_hidden == False,
            Goods.start_date <= today,
            Goods.end_date >= today
        ).limit(5)
        
        examples = await session.execute(examples_query)
        print('\nПримеры товаров которые должны быть видны:')
        for row in examples:
            print(f'  ID: {row.id}, Название: {row.name}, Активен: {row.is_active}, Скрыт: {row.is_hidden}')
            
        # Проверяем товары БЕЗ доступности
        no_availability_query = select(Goods.id, Goods.name).where(
            Goods.is_active == True,
            Goods.is_hidden == False,
            Goods.start_date <= today,
            Goods.end_date >= today,
            ~Goods.id.in_(
                select(DailyAvailability.goods_id).where(
                    DailyAvailability.date == today_date,
                    DailyAvailability.available_quantity > 0
                )
            )
        ).limit(5)
        
        no_avail = await session.execute(no_availability_query)
        print('\nПримеры товаров БЕЗ доступности на сегодня:')
        for row in no_avail:
            print(f'  ID: {row.id}, Название: {row.name}')

if __name__ == "__main__":
    asyncio.run(check_goods()) 