FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
# Устанавливаем dotenv явно, так как он используется в vite.config.js
RUN npm install --save-dev dotenv

# Установка git и получение git hash
RUN apk add --no-cache git
RUN git rev-parse --short HEAD 2>/dev/null || echo dev > /commit_hash.txt

COPY . .

# Явно указываем переменные окружения, если они не передались через ARG
ARG VITE_ADMIN_LOGIN
ARG VITE_ADMIN_PASSWORD
ENV VITE_ADMIN_LOGIN=${VITE_ADMIN_LOGIN}
ENV VITE_ADMIN_PASSWORD=${VITE_ADMIN_PASSWORD}
ENV VITE_COMMIT_HASH=dev

RUN npm run build

FROM nginx:alpine
# Передаем COMMIT_HASH со stage builder
COPY --from=builder /commit_hash.txt /commit_hash.txt
ENV VITE_COMMIT_HASH=dev
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем необходимую структуру директорий для Let's Encrypt
RUN mkdir -p /etc/letsencrypt/live/libertylib.online

# Создаем скрипт для замены версии
RUN echo '#!/bin/sh' > /docker-entrypoint.d/40-set-version.sh && \
    echo 'export VITE_COMMIT_HASH=$(cat /commit_hash.txt)' >> /docker-entrypoint.d/40-set-version.sh && \
    echo 'envsubst "\${VITE_COMMIT_HASH}" < /usr/share/nginx/html/index.html > /tmp/index.html && mv /tmp/index.html /usr/share/nginx/html/index.html' >> /docker-entrypoint.d/40-set-version.sh && \
    chmod +x /docker-entrypoint.d/40-set-version.sh

EXPOSE 80
EXPOSE 443