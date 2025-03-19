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

def recreate_status_column():
    """Удаляет нахуй и создает заново колонку status и enum с правильными значениями"""
    conn = None
    try:
        # Подключаемся к базе данных с автокоммитом
        logger.info("🔄 Подключение к базе данных...")
        conn = psycopg2.connect(**DB_PARAMS)
        conn.autocommit = True
        
        with conn.cursor() as cursor:
            # 1. Удаляем колонку status, если она существует
            logger.info("🔄 Удаление колонки status...")
            cursor.execute("ALTER TABLE reservations DROP COLUMN IF EXISTS status;")
            logger.info("✅ Колонка status удалена")
            
            # 2. Удаляем enum, если он существует
            logger.info("🔄 Удаление типа enum...")
            cursor.execute("DROP TYPE IF EXISTS reservationstatus CASCADE;")
            logger.info("✅ Тип enum удален")
            
            # 3. Создаем новый enum с нужными значениями, ВКЛЮЧАЯ 'pending'
            logger.info("🔄 Создание нового enum с нижним регистром...")
            cursor.execute("CREATE TYPE reservationstatus AS ENUM ('pending', 'active', 'confirmed', 'canceled');")
            logger.info("✅ Создан новый enum в нижнем регистре")
            
            # 4. Добавляем колонку status с новым типом
            logger.info("🔄 Создание колонки status...")
            cursor.execute("""
                ALTER TABLE reservations 
                ADD COLUMN status reservationstatus DEFAULT 'pending';
            """)
            logger.info("✅ Колонка status добавлена")
            
            # 5. Устанавливаем всем записям статус active (или pending, если вы хотите начать с этого статуса)
            logger.info("🔄 Установка статуса для всех записей...")
            cursor.execute("UPDATE reservations SET status = 'pending';")
            logger.info("✅ Всем записям установлен статус pending")
            
            # 6. Создаем индекс
            logger.info("🔄 Создание индекса...")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations (status);")
            logger.info("✅ Индекс создан")
            
            # 7. Проверяем, что всё корректно
            cursor.execute("SELECT DISTINCT status FROM reservations LIMIT 1;")
            result = cursor.fetchone()
            logger.info(f"✅ Проверка: статус в базе = {result}")
        
        logger.info("✅ Миграция успешно завершена")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("🚀 Запуск миграции для пересоздания колонки status...")
    if not recreate_status_column():
        logger.error("❌ Миграция завершилась с ошибкой")
        sys.exit(1)
    logger.info("✅ Миграция успешно завершена!") 