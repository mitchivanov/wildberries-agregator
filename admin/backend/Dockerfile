FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Устанавливаем postgresql-client для pg_isready
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

COPY . .

# Делаем entrypoint.sh исполняемым
RUN chmod +x entrypoint.sh

# Используем entrypoint.sh вместо прямого запуска uvicorn
CMD ["./entrypoint.sh"] 