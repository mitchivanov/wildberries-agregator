#!/bin/bash

# Установка системного nginx и настройка конфигурации
# Убедитесь, что запускаете с правами sudo

echo "🚀 Настройка системного nginx для Wildberries Aggregator"

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

# Копируем нашу конфигурацию
echo "📋 Копируем конфигурацию nginx..."
cp nginx.conf /etc/nginx/sites-available/wildberries-aggregator

# Создаем symlink для активации сайта
echo "🔗 Активируем сайт..."
ln -sf /etc/nginx/sites-available/wildberries-aggregator /etc/nginx/sites-enabled/

# Отключаем дефолтный сайт
if [ -L /etc/nginx/sites-enabled/default ]; then
    echo "🚫 Отключаем дефолтный сайт..."
    rm /etc/nginx/sites-enabled/default
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
    echo "📍 Статические файлы будут доступны из Docker volume:"
    echo "   /var/lib/docker/volumes/wildberries-agregator_frontend_static/_data"
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