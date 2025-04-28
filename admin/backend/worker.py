import asyncio
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy import select, update
from database import AsyncScopedSession, init_db, close_db
from models import Goods

# Настраиваем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('goods_activity_worker')

# Константа для московского часового пояса
MOSCOW_TZ = ZoneInfo('Europe/Moscow')

async def update_goods_activity():
    """
    Обновляет статус активности товаров на основе дат начала и окончания
    """
    try:
        logger.info("Обновление статуса активности товаров...")
        async with AsyncScopedSession() as session:
            # Получаем текущее время в Москве
            current_time = datetime.now(MOSCOW_TZ)
            
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

async def wait_until_midnight():
    """Ждет до следующей полночи по Москве"""
    now = datetime.now(MOSCOW_TZ)
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    wait_seconds = (tomorrow - now).total_seconds()
    
    logger.info(f"Ожидание до полуночи по МСК: {wait_seconds} секунд")
    logger.info(f"Следующее обновление в: {tomorrow.strftime('%Y-%m-%d %H:%M:%S %Z')}")
    await asyncio.sleep(wait_seconds)

async def run_worker():
    """
    Запускает рабочий цикл проверки активности товаров
    """
    await init_db()
    logger.info("Воркер активности товаров запущен (работает по московскому времени)")
    
    try:
        while True:
            # Ждем до полуночи по МСК
            await wait_until_midnight()
            
            # Выполняем обновление
            await update_goods_activity()
            
            # Логируем следующее время запуска
            next_run = datetime.now(MOSCOW_TZ) + timedelta(days=1)
            next_run = next_run.replace(hour=0, minute=0, second=0, microsecond=0)
            logger.info(f"Следующее обновление запланировано на: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            
    except asyncio.CancelledError:
        logger.info("Воркер активности товаров остановлен")
    finally:
        await close_db()

if __name__ == "__main__":
    # Запускаем воркер при непосредственном выполнении файла
    asyncio.run(run_worker()) 