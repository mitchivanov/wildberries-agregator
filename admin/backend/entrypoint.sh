#!/bin/sh

# Ждем готовности базы
until pg_isready -h postgres -U socialist -d wb_aggregator; do
  echo "Waiting for database..."
  sleep 2
done

# Применяем миграции
alembic upgrade head

# Запускаем приложение
exec uvicorn main:app --host 0.0.0.0 --port 8000 