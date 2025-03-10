from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.ext.asyncio import async_scoped_session
from asyncio import current_task
import os
from typing import AsyncGenerator
from sqlalchemy.ext.declarative import declarative_base

# Получаем URL подключения из переменных окружения или используем значение по умолчанию
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/postgres")

# Создаем асинхронный движок SQLAlchemy
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
    pool_use_lifo=True,
    connect_args={
        "command_timeout": 60,
        "server_settings": {
            "application_name": "wb_aggregator",
            "timezone": "utc"
        }
    }
)

# Создаем фабрику сессий для асинхронной работы
async_session_factory = sessionmaker(
    engine, 
    class_=AsyncSession, 
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Создаем scoped session для привязки сессии к текущей задаче
AsyncScopedSession = async_scoped_session(
    async_session_factory,
    scopefunc=current_task,
)

# Базовый класс для всех моделей
Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Зависимость для получения сессии базы данных.
    Используется в маршрутах FastAPI.
    """
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    """
    Инициализация базы данных - создание всех таблиц.
    Вызывать при запуске приложения.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def close_db():
    """
    Закрытие соединений с базой данных.
    Вызывать при остановке приложения.
    """
    await engine.dispose()

# Добавляем публичный экспорт
__all__ = ['AsyncScopedSession', 'init_db', 'close_db']