#!/bin/sh

# Ждем готовности базы
echo "Checking database connection..."
until pg_isready -h postgres -U socialist -d wb_aggregator; do
  echo "Waiting for database..."
  sleep 2
done
echo "Database is up and running!"



# Запускаем прямую миграцию
#echo "Running direct migrations..."
#python sales_limit_migration.py
#if [ $? -ne 0 ]; then
#  echo "sales_limit_migration failed! Exiting..."
#  exit 1
#fi
#
#python category_notes_migration.py
#if [ $? -ne 0 ]; then
#  echo "category_notes_migration failed! Exiting..."
#  exit 1
#fi

#python goods_notes_migration.py
#if [ $? -ne 0 ]; then
#  echo "goods_notes_migration failed! Exiting..."
#  exit 1
#fi

# Запускаем миграцию статуса бронирований
echo "Running reservation status migration..."
python reservation_status_migration.py
if [ $? -ne 0 ]; then
  echo "reservation_status_migration failed! Exiting..."
  exit 1
fi

# Запускаем миграцию требований подтверждения для товаров
#echo "Running confirmation requirements migration..."
#python confirmation_requirements_migration.py
#if [ $? -ne 0 ]; then
#  echo "confirmation_requirements_migration failed! Exiting..."
#  exit 1
#fi



# Обновляем значения статуса бронирований
#echo "Updating reservation status values..."
#python update_reservation_status_values.py
#if [ $? -ne 0 ]; then
#  echo "update_reservation_status_values failed! Exiting..."
#  exit 1
#fi

# Запускаем воркер активности товаров в фоновом режиме
echo "Starting worker..."
python worker.py &

# Запускаем приложение
echo "Starting application..."
exec uvicorn main:app --host 0.0.0.0 --port 8000 