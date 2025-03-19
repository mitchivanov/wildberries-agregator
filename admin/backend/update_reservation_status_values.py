#!/usr/bin/env python3
import psycopg2
import logging
import sys

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger()

# Параметры подключения
DB_PARAMS = {
    "host": "postgres",
    "database": "wb_aggregator",
    "user": "socialist",
    "password": "revolution2023"
}

def recreate_status_enum():
    """Пересоздает enum с правильными значениями (нижний регистр)"""
    conn = None
    try:
        # Подключаемся к базе данных с автокоммитом
        logger.info("🔄 Подключение к базе данных...")
        conn = psycopg2.connect(**DB_PARAMS)
        conn.autocommit = True
        
        with conn.cursor() as cursor:
            # 1. Проверяем существует ли колонка
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'reservations' 
                    AND column_name = 'status'
                );
            """)
            has_status_column = cursor.fetchone()[0]
            
            # 2. Если колонка существует, удаляем её
            if has_status_column:
                logger.info("🔄 Удаление существующей колонки status")
                cursor.execute("ALTER TABLE reservations DROP COLUMN IF EXISTS status;")
                logger.info("✅ Колонка status удалена")
            
            # 3. Проверяем существование enum и удаляем его
            cursor.execute("SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservationstatus');")
            enum_exists = cursor.fetchone()[0]
            
            if enum_exists:
                logger.info("🔄 Удаление существующего enum reservationstatus")
                cursor.execute("DROP TYPE IF EXISTS reservationstatus CASCADE;")
                logger.info("✅ Тип enum удален")
            
            # 4. Создаем enum с правильными значениями в нижнем регистре
            logger.info("🔄 Создание нового enum с значениями в нижнем регистре")
            cursor.execute("CREATE TYPE reservationstatus AS ENUM ('active', 'confirmed', 'canceled');")
            logger.info("✅ Создан тип enum с правильными значениями")
            
            # 5. Добавляем колонку с правильным типом
            logger.info("🔄 Добавление колонки status с новым типом")
            cursor.execute("""
                ALTER TABLE reservations
                ADD COLUMN status reservationstatus DEFAULT 'active';
            """)
            logger.info("✅ Колонка status добавлена")
            
            # 6. Устанавливаем всем записям статус 'active'
            logger.info("🔄 Установка статуса 'active' для всех записей")
            cursor.execute("UPDATE reservations SET status = 'active';")
            logger.info("✅ Статус установлен для всех записей")
            
            # 7. Создаем индекс для ускорения поиска
            logger.info("🔄 Создание индекса для колонки status")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);")
            logger.info("✅ Индекс создан")
        
        logger.info("✅ Миграция успешно завершена")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка при обновлении типа enum: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("🚀 Запуск миграции для обновления типа enum ReservationStatus...")
    if not recreate_status_enum():
        logger.error("❌ Миграция завершилась с ошибкой")
        sys.exit(1)
    logger.info("✅ Миграция успешно завершена!") 