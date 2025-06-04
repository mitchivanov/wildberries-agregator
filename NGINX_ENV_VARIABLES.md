# 🔧 Переменные окружения для Nginx

После миграции на системный nginx, конфигурация теперь полностью настраивается через переменные окружения.

## 📋 Обязательные переменные

Добавьте следующие переменные в ваш `.env` файл:

```bash
# Nginx Configuration
DOMAIN_NAME=develooper.ru
API_PORT=8000
COMPOSE_PROJECT_NAME=wildberries-agregator
```

## 🎯 Описание переменных

| Переменная | Описание | Пример |
|------------|----------|---------|
| `DOMAIN_NAME` | Доменное имя для SSL сертификатов и server_name | `develooper.ru` |
| `API_PORT` | Порт backend API для proxy_pass | `8000` |
| `COMPOSE_PROJECT_NAME` | Имя проекта Docker Compose для путей к volumes | `wildberries-agregator` |

## 🚀 Использование

1. **Обновите .env файл** с новыми переменными
2. **Загрузите переменные** и запустите setup:
   ```bash
   source .env && sudo -E ./setup-nginx.sh
   ```
3. **Запустите Docker Compose**:
   ```bash
   docker-compose up -d
   ```

## 🔄 Обновление конфигурации

При изменении переменных окружения:

```bash
# Загружаем новые переменные
source .env

# Перегенерируем конфигурацию nginx
sudo -E ./setup-nginx.sh

# Перезагружаем nginx
sudo systemctl reload nginx
```

## 🎯 Автоматическое определение

В `docker-compose.yml` настроены значения по умолчанию:
- `DOMAIN_NAME`: `develooper.ru`
- `API_PORT`: `8000`  
- `COMPOSE_PROJECT_NAME`: `wildberries-agregator`

Если переменные не заданы в `.env`, будут использованы эти значения. 