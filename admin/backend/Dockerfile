FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary

# Устанавливаем postgresql-client для pg_isready
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Копируем все Python файлы
COPY *.py ./

# Создаем структуру директорий для alembic
RUN mkdir -p alembic/versions

# Копируем файлы миграции
COPY alembic/env.py alembic/
COPY alembic/script.py.mako alembic/
COPY alembic/alembic.ini alembic/
COPY alembic/versions/add_categories_table.py alembic/versions/
COPY run_migrations.py ./

# Копируем файлы для прямой миграции
COPY direct_migration.py ./

# Делаем entrypoint.sh исполняемым
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Запуск через entrypoint
CMD ["./entrypoint.sh"] 