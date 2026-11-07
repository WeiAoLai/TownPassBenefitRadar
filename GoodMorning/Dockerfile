# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# mock：瀏覽器內示範資料；http：串接 openapi.yaml 的後端
ARG VITE_API_MODE=mock
ARG VITE_API_BASE_URL=/api
ARG VITE_DEMO_USERS=user-a,user-b,user-c
ENV VITE_API_MODE=$VITE_API_MODE VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_DEMO_USERS=$VITE_DEMO_USERS
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
# 後端位址（同網域 /api 反向代理，前端不需處理 CORS）
ENV BACKEND_URL=http://backend:8080
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
