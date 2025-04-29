FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
# Устанавливаем dotenv явно, так как он используется в vite.config.js
RUN npm install --save-dev dotenv
COPY . .

# Явно указываем переменные окружения, если они не передались через ARG
ARG VITE_ADMIN_LOGIN
ARG VITE_ADMIN_PASSWORD
ARG COMMIT_HASH
ENV VITE_ADMIN_LOGIN=${VITE_ADMIN_LOGIN}
ENV VITE_ADMIN_PASSWORD=${VITE_ADMIN_PASSWORD}
ENV VITE_COMMIT_HASH=${COMMIT_HASH}

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем необходимую структуру директорий для Let's Encrypt
RUN mkdir -p /etc/letsencrypt/live/libertylib.online

EXPOSE 80
EXPOSE 443 