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
    """Выполняет миграцию для добавления поля total_sales_limit"""
    conn = None
    try:
        # Подключаемся к базе данных
        logger.info("🔄 Подключение к базе данных...")
        conn = psycopg2.connect(**DB_PARAMS)
        conn.autocommit = False
        
        # Проверяем существование колонки total_sales_limit
        column_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'goods' 
                AND column_name = 'total_sales_limit'
            );
        """
        column_exists = check_if_exists(conn, column_exists_query)
        
        if not column_exists:
            # Добавляем колонку total_sales_limit
            alter_table_sql = """
                ALTER TABLE goods 
                ADD COLUMN total_sales_limit INTEGER DEFAULT NULL;
            """
            if not execute_sql(conn, alter_table_sql, description="Добавлена колонка total_sales_limit"):
                conn.rollback()
                return False
            
            logger.info("✅ Колонка total_sales_limit добавлена в таблицу goods")
        
<<<<<<< HEAD:admin/backend/sales_limit_migration.py
        # Подтверждаем транзакцию
=======
        # 3. Проверяем существование таблицы alembic_version
        table_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'alembic_version'
            );
        """
        table_exists = check_if_exists(conn, table_exists_query)
        
        # 4. Обновляем версию миграции только если таблица существует
        if table_exists:
            update_version_sql = """
            UPDATE alembic_version 
            SET version_num = 'add_is_hidden_column'
            WHERE version_num = 'a5b1c3d4e5f6';
            """
            if not execute_sql(conn, update_version_sql, description="Обновлена версия миграции"):
                conn.rollback()
                return False
        else:
            logger.info("ℹ️ Таблица alembic_version не существует, пропускаем обновление версии")
        
        # Фиксируем изменения
>>>>>>> 94e6cf9 (notifications_upd):admin/backend/direct_migration.py
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
    logger.info("🚀 Запуск прямой миграции для добавления поля total_sales_limit...")
    if not run_migration():
        logger.error("❌ Миграция завершилась с ошибкой")
        sys.exit(1)
    logger.info("✅ Миграция успешно завершена!") 