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

# Финальный stage - создаем контейнер только для хранения статических файлов
FROM alpine:latest
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /commit_hash.txt /commit_hash.txt

# Создаем entrypoint для обновления версии в файлах
RUN echo '#!/bin/sh' > /entrypoint.sh && \
    echo 'export VITE_COMMIT_HASH=$(cat /commit_hash.txt)' >> /entrypoint.sh && \
    echo 'if [ -f /usr/share/nginx/html/index.html ]; then' >> /entrypoint.sh && \
    echo '  envsubst "\${VITE_COMMIT_HASH}" < /usr/share/nginx/html/index.html > /tmp/index.html && mv /tmp/index.html /usr/share/nginx/html/index.html' >> /entrypoint.sh && \
    echo 'fi' >> /entrypoint.sh && \
    echo 'tail -f /dev/null' >> /entrypoint.sh && \
    chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]