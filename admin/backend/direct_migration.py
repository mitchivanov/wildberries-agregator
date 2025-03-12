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
    """Выполняет миграцию для таблицы категорий"""
    conn = None
    try:
        # Подключаемся к базе данных
        logger.info("🔄 Подключение к базе данных...")
        conn = psycopg2.connect(**DB_PARAMS)
        conn.autocommit = False
        
        # 1. Проверяем существование таблицы категорий
        table_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'categories'
            );
        """
        categories_exists = check_if_exists(conn, table_exists_query)
        
        # 2. Создаем таблицу категорий если не существует
        if not categories_exists:
            create_categories_sql = """
            CREATE TABLE categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
            );
            CREATE INDEX ix_categories_id ON categories (id);
            """
            if not execute_sql(conn, create_categories_sql, description="Создана таблица категорий"):
                conn.rollback()
                return False
        else:
            logger.info("ℹ️ Таблица категорий уже существует")
        
        # 3. Проверяем существование колонки category_id в goods
        column_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'goods' 
                AND column_name = 'category_id'
            );
        """
        column_exists = check_if_exists(conn, column_exists_query)
        
        # 4. Добавляем колонку category_id если не существует
        if not column_exists:
            add_column_sql = """
            ALTER TABLE goods ADD COLUMN category_id INTEGER;
            """
            if not execute_sql(conn, add_column_sql, description="Добавлена колонка category_id в таблицу goods"):
                conn.rollback()
                return False
        else:
            logger.info("ℹ️ Колонка category_id уже существует")
        
        # 5. Проверяем существование внешнего ключа
        fk_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.table_constraints 
                WHERE constraint_name = 'fk_goods_category_id' 
                AND table_name = 'goods'
            );
        """
        fk_exists = check_if_exists(conn, fk_exists_query)
        
        # 6. Добавляем внешний ключ если не существует
        if not fk_exists:
            add_fk_sql = """
            ALTER TABLE goods 
            ADD CONSTRAINT fk_goods_category_id 
            FOREIGN KEY (category_id) REFERENCES categories(id) 
            ON DELETE SET NULL;
            """
            if not execute_sql(conn, add_fk_sql, description="Добавлен внешний ключ fk_goods_category_id"):
                conn.rollback()
                return False
        else:
            logger.info("ℹ️ Внешний ключ fk_goods_category_id уже существует")
        
        # 7. Проверяем существование таблицы alembic_version
        alembic_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'alembic_version'
            );
        """
        alembic_exists = check_if_exists(conn, alembic_exists_query)
        
        # 8. Создаем таблицу alembic_version если нужно
        if not alembic_exists:
            create_alembic_sql = """
            CREATE TABLE alembic_version (
                version_num VARCHAR(32) NOT NULL PRIMARY KEY
            );
            """
            if not execute_sql(conn, create_alembic_sql, description="Создана таблица alembic_version"):
                conn.rollback()
                return False
        
        # 9. Обновляем версию миграции
        update_version_sql = """
        INSERT INTO alembic_version (version_num) 
        VALUES ('a5b1c3d4e5f6') 
        ON CONFLICT (version_num) DO NOTHING;
        """
        if not execute_sql(conn, update_version_sql, description="Обновлена версия миграции"):
            conn.rollback()
            return False
        
        # Фиксируем изменения
        conn.commit()
        logger.info("✅ Миграция успешно завершена!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Критическая ошибка: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    logger.info("🚀 Запуск прямой миграции для таблицы категорий...")
    if not run_migration():
        logger.error("❌ Миграция завершилась с ошибкой")
        sys.exit(1)
    logger.info("✅ Миграция успешно завершена!") 