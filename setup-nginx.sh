#!/bin/bash

# Установка системного nginx и настройка конфигурации с переменными окружения
# Убедитесь, что запускаете с правами sudo

echo "🚀 Настройка системного nginx для Wildberries Aggregator"

# Проверяем наличие переменных окружения
if [ -z "$DOMAIN_NAME" ] || [ -z "$API_PORT" ] || [ -z "$COMPOSE_PROJECT_NAME" ]; then
    echo "❌ Ошибка: Не заданы обязательные переменные окружения!"
    echo "Убедитесь, что заданы:"
    echo "  DOMAIN_NAME (например: develooper.ru)"
    echo "  API_PORT (например: 8000)"
    echo "  COMPOSE_PROJECT_NAME (например: wildberries-agregator)"
    echo ""
    echo "Загрузите их из .env файла:"
    echo "  source .env && sudo -E ./setup-nginx.sh"
    exit 1
fi

echo "📋 Используемые настройки:"
echo "  Домен: $DOMAIN_NAME"
echo "  API порт: $API_PORT"
echo "  Проект: $COMPOSE_PROJECT_NAME"

# Устанавливаем nginx если его нет
if ! command -v nginx &> /dev/null; then
    echo "📦 Устанавливаем nginx..."
    apt update
    apt install -y nginx
else
    echo "✅ nginx уже установлен"
fi

# Останавливаем nginx перед настройкой
echo "⏸️ Останавливаем nginx..."
systemctl stop nginx

# Создаем резервную копию дефолтной конфигурации
if [ -f /etc/nginx/sites-available/default ]; then
    echo "💾 Создаем резервную копию дефолтной конфигурации..."
    cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
fi

# Генерируем конфигурацию из шаблона
echo "📋 Генерируем конфигурацию nginx из шаблона..."
envsubst '${DOMAIN_NAME} ${API_PORT} ${COMPOSE_PROJECT_NAME}' < nginx.conf.template > /etc/nginx/sites-available/wildberries-aggregator

# Создаем symlink для активации сайта
echo "🔗 Активируем сайт..."
ln -sf /etc/nginx/sites-available/wildberries-aggregator /etc/nginx/sites-enabled/

# Отключаем дефолтный сайт
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo "🚫 Отключаем дефолтный сайт..."
    rm /etc/nginx/sites-enabled/default
fi

# Отключаем конфликтующие конфиги
if [ -L /etc/nginx/sites-enabled/000-default ]; then
    echo "🚫 Отключаем конфликтующий конфиг..."
    rm /etc/nginx/sites-enabled/000-default
fi

# Проверяем конфигурацию
echo "🔍 Проверяем конфигурацию nginx..."
if nginx -t; then
    echo "✅ Конфигурация nginx корректна"
    
    # Добавляем nginx в автозапуск
    echo "🔄 Добавляем nginx в автозапуск..."
    systemctl enable nginx
    
    # Запускаем nginx
    echo "▶️ Запускаем nginx..."
    systemctl start nginx
    
    echo "🎉 nginx успешно настроен!"
    echo "📍 Конфигурация для домена: $DOMAIN_NAME"
    echo "📍 API доступно на порту: $API_PORT"
    echo "📍 Статические файлы: /var/lib/docker/volumes/${COMPOSE_PROJECT_NAME}_frontend_static/_data"
    echo ""
    echo "📋 Для управления nginx используйте:"
    echo "   sudo systemctl start nginx"
    echo "   sudo systemctl stop nginx"
    echo "   sudo systemctl reload nginx"
    echo "   sudo systemctl status nginx"
    
else
    echo "❌ Ошибка в конфигурации nginx!"
    echo "Проверьте файл /etc/nginx/sites-available/wildberries-aggregator"
    exit 1
fi 