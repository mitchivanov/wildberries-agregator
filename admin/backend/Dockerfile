FROM python:3.12-slim


#чтобы Python писал логи без задержки
ENV PYTHONUNBUFFERED=1  


WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt psycopg2-binary python-multipart pillow

# Устанавливаем postgresql-client и другие необходимые инструменты
RUN apt-get update && apt-get install -y \
    postgresql-client \
    ffmpeg \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Создаем директорию для логов, даем права
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Создаем директорию для загруженных файлов
RUN mkdir -p /app/uploads/images /app/uploads/videos && chmod -R 777 /app/uploads

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
COPY category_notes_migration.py ./
COPY goods_notes_migration.py ./
COPY sales_limit_migration.py ./

# Копируем и фиксим entrypoint
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && \
    sed -i 's/\r$//' entrypoint.sh  # Эта строка конвертирует CRLF в LF

# Запуск через entrypoint
CMD ["./entrypoint.sh"]