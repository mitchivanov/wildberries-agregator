import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select, update
from database import AsyncScopedSession, init_db, close_db
from models import Goods

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('goods_activity_worker')

async def update_goods_activity():
    """
    Обновляет статус активности товаров на основе дат начала и окончания
    """
    try:
        logger.info("Обновление статуса активности товаров...")
        async with AsyncScopedSession() as session:
            # Получаем текущее время в UTC
            current_time = datetime.now(timezone.utc)
            
            # Получаем все товары
            query = select(Goods)
            result = await session.execute(query)
            goods_list = result.scalars().all()
            
            updated_count = 0
            
            for goods in goods_list:
                # Определяем, должен ли товар быть активным
                should_be_active = True
                
                # Проверяем start_date если она задана
                if goods.start_date and goods.start_date > current_time:
                    should_be_active = False
                
                # Проверяем end_date если она задана
                if goods.end_date and goods.end_date < current_time:
                    should_be_active = False
                
                # Обновляем статус, если он отличается от текущего
                if goods.is_active != should_be_active:
                    goods.is_active = should_be_active
                    updated_count += 1
            
            # Сохраняем изменения, если были обновления
            if updated_count > 0:
                await session.commit()
                logger.info(f"Обновлено {updated_count} товаров")
            else:
                logger.info("Нет товаров для обновления")
    
    except Exception as e:
        logger.error(f"Ошибка при обновлении статуса товаров: {e}")

async def run_worker():
    """
    Запускает рабочий цикл проверки активности товаров
    """
    await init_db()
    logger.info("Воркер активности товаров запущен")
    
    try:
        while True:
            await update_goods_activity()
            # Проверяем каждые 5 минут
            await asyncio.sleep(300)
    except asyncio.CancelledError:
        logger.info("Воркер активности товаров остановлен")
    finally:
        await close_db()

if __name__ == "__main__":
    # Запускаем воркер при непосредственном выполнении файла
    asyncio.run(run_worker()) 