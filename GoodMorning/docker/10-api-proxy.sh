#!/bin/sh
# 有設定 BACKEND_URL 才產生 /api/ 反向代理；沒設定（mock 模式）就不產生，nginx 不會因找不到後端而無法啟動。
set -eu
mkdir -p /etc/nginx/conf.d/api
rm -f /etc/nginx/conf.d/api/api.conf
if [ -n "${BACKEND_URL:-}" ]; then
  cat > /etc/nginx/conf.d/api/api.conf <<CONF
location /api/ {
  proxy_pass ${BACKEND_URL};
  proxy_set_header Host \$proxy_host;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_read_timeout 60s;
}
CONF
  echo "api-proxy: /api/ -> ${BACKEND_URL}"
else
  echo "api-proxy: BACKEND_URL 未設定，不啟用 /api/ 代理"
fi
