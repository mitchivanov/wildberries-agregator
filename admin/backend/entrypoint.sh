#!/bin/sh

# Ждем готовности базы
echo "Checking database connection..."
until pg_isready -h postgres -U socialist -d wb_aggregator; do
  echo "Waiting for database..."
  sleep 2
done
echo "Database is up and running!"

# Запускаем прямую миграцию
echo "Running direct migration..."
#python direct_migration.py
if [ $? -ne 0 ]; then
  echo "Migration failed! Exiting..."
  exit 1
fi

# Запускаем воркер активности товаров в фоновом режиме
echo "Starting worker..."
python worker.py &

# Запускаем приложение
echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 