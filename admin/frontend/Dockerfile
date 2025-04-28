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
ENV VITE_ADMIN_LOGIN=${VITE_ADMIN_LOGIN}
ENV VITE_ADMIN_PASSWORD=${VITE_ADMIN_PASSWORD}

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"] 