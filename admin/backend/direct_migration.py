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
    """Выполняет миграцию для добавления поля is_hidden"""
    conn = None
    try:
        # Подключаемся к базе данных
        logger.info("🔄 Подключение к базе данных...")
        conn = psycopg2.connect(**DB_PARAMS)
        conn.autocommit = False
        
        # 1. Проверяем существование колонки is_hidden
        column_exists_query = """
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'goods' 
                AND column_name = 'is_hidden'
            );
        """
        column_exists = check_if_exists(conn, column_exists_query)
        
        # 2. Добавляем колонку is_hidden если не существует
        if not column_exists:
            add_column_sql = """
            ALTER TABLE goods 
            ADD COLUMN is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
            """
            if not execute_sql(conn, add_column_sql, description="Добавлена колонка is_hidden в таблицу goods"):
                conn.rollback()
                return False
            
            # Создаем индекс для оптимизации запросов
            create_index_sql = """
            CREATE INDEX ix_goods_is_hidden ON goods (is_hidden);
            """
            if not execute_sql(conn, create_index_sql, description="Создан индекс для колонки is_hidden"):
                conn.rollback()
                return False
        else:
            logger.info("ℹ️ Колонка is_hidden уже существует")
        
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
        
        # 5. Каскадное удаление для daily_availability.goods_id
        logger.info("Пробуем добавить ON DELETE CASCADE для daily_availability.goods_id...")
        # Удаляем старый внешний ключ, если есть
        drop_fk_sql = '''
        DO $$
        DECLARE
            fk_name text;
        BEGIN
            SELECT tc.constraint_name INTO fk_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'daily_availability' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'goods_id';
            IF fk_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE daily_availability DROP CONSTRAINT %I', fk_name);
            END IF;
        END$$;
        '''
        execute_sql(conn, drop_fk_sql, description="Удалён старый FK daily_availability.goods_id")
        # Добавляем новый FK с CASCADE
        add_fk_sql = '''
        ALTER TABLE daily_availability
        ADD CONSTRAINT daily_availability_goods_id_fkey
        FOREIGN KEY (goods_id) REFERENCES goods(id) ON DELETE CASCADE;
        '''
        execute_sql(conn, add_fk_sql, description="Добавлен FK с CASCADE для daily_availability.goods_id")
        # 6. Каскадное удаление для reservations.goods_id
        logger.info("Пробуем добавить ON DELETE CASCADE для reservations.goods_id...")
        drop_fk_sql2 = '''
        DO $$
        DECLARE
            fk_name text;
        BEGIN
            SELECT tc.constraint_name INTO fk_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name = 'reservations' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'goods_id';
            IF fk_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE reservations DROP CONSTRAINT %I', fk_name);
            END IF;
        END$$;
        '''
        execute_sql(conn, drop_fk_sql2, description="Удалён старый FK reservations.goods_id")
        add_fk_sql2 = '''
        ALTER TABLE reservations
        ADD CONSTRAINT reservations_goods_id_fkey
        FOREIGN KEY (goods_id) REFERENCES goods(id) ON DELETE CASCADE;
        '''
        execute_sql(conn, add_fk_sql2, description="Добавлен FK с CASCADE для reservations.goods_id")
        
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
    logger.info("🚀 Запуск прямой миграции для добавления поля is_hidden...")
    if not run_migration():
        logger.error("❌ Миграция завершилась с ошибкой")
        sys.exit(1)
    logger.info("✅ Миграция успешно завершена!") 