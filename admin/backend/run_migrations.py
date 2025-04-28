import os
import sys
import logging
from alembic.config import Config
from alembic import command

# Настраиваем логирование
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrations")

def run_migrations():
    """Запускает миграции alembic"""
    try:
        logger.info("Начинаем применение миграций...")
        
        # Создаем config и устанавливаем путь к файлу alembic.ini
        alembic_cfg = Config("alembic/alembic.ini")
        
        # Явно устанавливаем URL для подключения (синхронный драйвер)
        alembic_cfg.set_main_option("sqlalchemy.url", 
                                    "postgresql://socialist:revolution2023@postgres:5432/wb_aggregator")
        
        # Дополнительная отладочная информация
        logger.info(f"Используем конфигурацию alembic: {alembic_cfg.config_file_name}")
        logger.info(f"Директория скриптов: {alembic_cfg.get_main_option('script_location')}")
        
        # Выводим информацию о текущей ревизии
        logger.info("Текущая ревизия:")
        command.current(alembic_cfg)
        
        # Выполняем миграцию
        logger.info("Выполняем upgrade до ревизии a5b1c3d4e5f6...")
        command.upgrade(alembic_cfg, "a5b1c3d4e5f6")
        
        logger.info("Миграции успешно применены!")
        return True
    except Exception as e:
        logger.error(f"Ошибка при выполнении миграций: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    success = run_migrations()
    if not success:
        sys.exit(1) 