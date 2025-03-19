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

def execute_sql(conn, sql, params=None, description=None):
    """Выполняет SQL запрос и логирует результат"""
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, params)
            if description:
                logger.info(f"✅ {description}")
            return True
    except psycopg2.errors.DuplicateTable:
        logger.info(f"ℹ️ Таблица уже существует")
        return True
    except psycopg2.errors.DuplicateColumn:
        logger.info(f"ℹ️ Колонка уже существует")
        return True
    except psycopg2.errors.DuplicateObject:
        logger.info(f"ℹ️ Объект уже существует")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        return False

def check_if_exists(conn, query, params=None):
    """Проверяет, существует ли объект в базе данных"""
    with conn.cursor() as cursor:
        cursor.execute(query, params)
        return cursor.fetchone()[0]

def run_migration():
    """Выполняет миграцию для добавления поля confirmation_requirements к товарам"""
    conn = None
    try:
        # Подключаемся к базе данных
        logger.info("🔄 Подключение к базе данных...")
        conn = psycopg2.connect(**DB_PARAMS)
        conn.autocommit = False
        
        # Проверяем существование колонки confirmation_requirements в таблице goods
        column_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'goods' 
                AND column_name = 'confirmation_requirements'
            );
        """
        column_exists = check_if_exists(conn, column_exists_query)
        
        if not column_exists:
            # Добавляем колонку confirmation_requirements типа JSON
            alter_table_sql = """
                ALTER TABLE goods 
                ADD COLUMN confirmation_requirements JSONB DEFAULT NULL;
            """
            if not execute_sql(conn, alter_table_sql, description="Добавлена колонка confirmation_requirements"):
                conn.rollback()
                return False
            
            logger.info("✅ Колонка confirmation_requirements добавлена в таблицу goods")
        
        # Подтверждаем транзакцию
        conn.commit()
        logger.info("✅ Миграция успешно завершена")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка: {e}")
        if conn:
            conn.rollback()
        logger.error("❌ Миграция завершилась с ошибкой")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("🚀 Запуск миграции для добавления поля требований подтверждения к товарам...")
    if not run_migration():
        logger.error("❌ Миграция завершилась с ошибкой")
        sys.exit(1)
    logger.info("✅ Миграция успешно завершена!")