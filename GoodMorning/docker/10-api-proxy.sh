#!/bin/sh
# 有設定 BACKEND_URL 才產生 /api/ 反向代理；沒設定（mock 模式）就不產生，nginx 不會因找不到後端而無法啟動。
#   BACKEND_URL=http://xxx.elb.amazonaws.com   → /api/v1/me 原樣轉發到 http://xxx.elb.amazonaws.com/api/v1/me
#   BACKEND_URL 若帶路徑（例如 http://host/prefix），開頭的 /api/ 會換成該路徑
set -eu
mkdir -p /etc/nginx/conf.d/api
rm -f /etc/nginx/conf.d/api/api.conf
if [ -n "${BACKEND_URL:-}" ]; then
  target="$BACKEND_URL"
  rest="${target#*://}"
  case "$rest" in
    */*)
      # 帶路徑：結尾補斜線，nginx 會把 /api/ 換成這個路徑
      case "$target" in */) ;; *) target="$target/" ;; esac
      ;;
  esac
  cat > /etc/nginx/conf.d/api/api.conf <<CONF
location /api/ {
  proxy_pass ${target};
  proxy_set_header Host \$proxy_host;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_read_timeout 60s;
}
CONF
  echo "api-proxy: /api/ -> ${target}"
else
  echo "api-proxy: BACKEND_URL 未設定，不啟用 /api/ 代理"
fi
