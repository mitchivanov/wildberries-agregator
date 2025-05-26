# Миграция nginx на системный уровень

## Обзор изменений

Данная миграция выносит nginx из Docker контейнера и настраивает его на системном уровне для улучшения производительности и контроля.

## Изменения в архитектуре

### Было:
- nginx работал внутри Docker контейнера `frontend`
- Порты 80/443 пробрасывались из контейнера
- SSL сертификаты монтировались в контейнер

### Стало:
- nginx работает на системном уровне
- Статические файлы берутся из Docker volume
- Backend доступен на порту 8000
- SSL сертификаты доступны системному nginx

## Пошаговая инструкция миграции

### 1. Остановить текущие контейнеры
```bash
docker-compose down
```

### 2. Установить и настроить системный nginx

#### На Ubuntu/Debian:
```bash
# Сделать скрипт исполняемым (только для Linux)
chmod +x setup-nginx.sh

# Запустить установку
sudo ./setup-nginx.sh
```

#### На других системах:
```bash
# Установить nginx
sudo apt update && sudo apt install -y nginx  # Ubuntu/Debian
# или
sudo yum install nginx                         # CentOS/RHEL
# или
brew install nginx                            # macOS

# Скопировать конфигурацию
sudo cp nginx.conf /etc/nginx/sites-available/wildberries-aggregator

# Активировать сайт
sudo ln -sf /etc/nginx/sites-available/wildberries-aggregator /etc/nginx/sites-enabled/

# Отключить дефолтный сайт
sudo rm -f /etc/nginx/sites-enabled/default

# Проверить конфигурацию
sudo nginx -t

# Запустить nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3. Запустить обновленные контейнеры
```bash
docker-compose up -d
```

### 4. Проверить работу
```bash
# Проверить статус nginx
sudo systemctl status nginx

# Проверить доступность статических файлов
ls -la /var/lib/docker/volumes/wildberries-agregator_frontend_static/_data/

# Проверить доступность backend
curl http://localhost:8000/health

# Проверить сайт
curl -I https://develooper.ru
```

## Структура файлов

```
wildberries-agregator/
├── admin/frontend/Dockerfile          # Изменен: убран nginx, только статические файлы
├── docker-compose.yml                 # Изменен: убраны порты 80/443, добавлен volume
├── nginx.conf                         # Изменен: путь к статическим файлам и backend
├── setup-nginx.sh                     # Новый: скрипт автоматической установки
└── NGINX_MIGRATION.md                 # Новый: данная документация
```

## Важные особенности

1. **Путь к статическим файлам**: `/var/lib/docker/volumes/wildberries-agregator_frontend_static/_data`
2. **Backend доступен на**: `http://localhost:8000`
3. **SSL сертификаты**: системный nginx использует существующие сертификаты Let's Encrypt
4. **Домен**: `develooper.ru` (настройте в nginx.conf при необходимости)

## Управление nginx

```bash
# Запуск
sudo systemctl start nginx

# Остановка
sudo systemctl stop nginx

# Перезагрузка конфигурации
sudo systemctl reload nginx

# Статус
sudo systemctl status nginx

# Проверка конфигурации
sudo nginx -t
```

## Откат изменений

Если что-то пошло не так, вы можете откатить изменения:

1. Остановить системный nginx: `sudo systemctl stop nginx`
2. Вернуть старый Dockerfile и docker-compose.yml из git истории
3. Запустить контейнеры: `docker-compose up -d --build`

## Преимущества новой архитектуры

1. **Производительность**: системный nginx работает быстрее
2. **Контроль**: полный контроль над конфигурацией nginx
3. **Мониторинг**: легче интегрировать с системными инструментами мониторинга
4. **SSL**: проще управление сертификатами
5. **Логи**: системные логи nginx доступны через journalctl 