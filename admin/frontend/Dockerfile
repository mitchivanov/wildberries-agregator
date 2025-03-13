FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
# Устанавливаем dotenv явно, так как он используется в vite.config.js
RUN npm install --save-dev dotenv
COPY . .

# Принимаем аргументы сборки
ARG VITE_API_URL
ARG VITE_ADMIN_LOGIN
ARG VITE_ADMIN_PASSWORD
ARG VITE_TELEGRAM_WEBAPP_URL

# Устанавливаем их как переменные окружения
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_ADMIN_LOGIN=${VITE_ADMIN_LOGIN}
ENV VITE_ADMIN_PASSWORD=${VITE_ADMIN_PASSWORD}
ENV VITE_TELEGRAM_WEBAPP_URL=${VITE_TELEGRAM_WEBAPP_URL}

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем необходимую структуру директорий для Let's Encrypt
RUN mkdir -p /etc/letsencrypt/live/libertylib.online

EXPOSE 80
EXPOSE 443 