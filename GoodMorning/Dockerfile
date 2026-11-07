# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# mock：瀏覽器內示範資料，不需後端；http：串接 openapi.yaml 的後端（同網域 /api）
ARG VITE_API_MODE=mock
ARG VITE_API_BASE_URL=/api
ARG VITE_DEMO_USERS=user-a,user-b,user-c
ENV VITE_API_MODE=$VITE_API_MODE VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_DEMO_USERS=$VITE_DEMO_USERS
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
# PORT：容器監聽埠（ECS 預設 80；Cloud Run 等平台會注入 PORT）
# BACKEND_URL：後端位址，例如 http://backend.internal:8080；留空＝不代理 /api（mock 模式）
ENV PORT=80 BACKEND_URL=""
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker/10-api-proxy.sh /docker-entrypoint.d/10-api-proxy.sh
RUN chmod +x /docker-entrypoint.d/10-api-proxy.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
