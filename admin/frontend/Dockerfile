FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем необходимую структуру директорий для Let's Encrypt
RUN mkdir -p /etc/letsencrypt/live/libertylib.online

EXPOSE 80
EXPOSE 443 