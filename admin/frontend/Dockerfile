FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Устанавливаем переменные среды при сборке
ARG API_URL
ENV REACT_APP_API_URL=${API_URL}

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Создаем необходимую структуру директорий для Let's Encrypt
RUN mkdir -p /etc/letsencrypt/live/libertylib.online

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"] 