#!/usr/bin/env bash

set -euo pipefail

base_url="${BASE_URL:-http://localhost:${NGINX_PORT:-8088}}"
temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT

for command_name in curl ruby; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "missing required command: $command_name" >&2
    exit 1
  fi
done

echo "waiting for ${base_url}/health"
for attempt in {1..60}; do
  if curl --fail --silent --show-error "${base_url}/health" >"${temporary_directory}/health.json"; then
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    echo "stack did not become healthy" >&2
    exit 1
  fi
  sleep 2
done

curl --fail --silent --show-error \
  -H 'X-Demo-User: user-a' \
  "${base_url}/api/v1/me" >"${temporary_directory}/me.json"
curl --fail --silent --show-error \
  -H 'X-Demo-User: user-a' \
  "${base_url}/api/v1/backgrounds" >"${temporary_directory}/backgrounds.json"
curl --fail --silent --show-error \
  -H 'X-Demo-User: user-a' \
  "${base_url}/api/v1/policies/random" >"${temporary_directory}/policy.json"

policy_id="$(ruby -rjson -e 'puts JSON.parse(File.read(ARGV.fetch(0))).fetch("id")' \
  "${temporary_directory}/policy.json")"

ruby -rzlib -e '
  path = ARGV.fetch(0)
  width = height = 1080
  raw = (("\x00" + "\xF4\xB4\x42" * width) * height).b
  chunk = lambda do |type, data|
    [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N")
  end
  png = "\x89PNG\r\n\x1a\n".b
  png << chunk.call("IHDR", [width, height, 8, 2, 0, 0, 0].pack("NNCCCCC"))
  png << chunk.call("IDAT", Zlib::Deflate.deflate(raw))
  png << chunk.call("IEND", "")
  File.binwrite(path, png)
' "${temporary_directory}/artwork.png"

curl --fail --silent --show-error \
  -H 'X-Demo-User: user-a' \
  -F "image=@${temporary_directory}/artwork.png;type=image/png" \
  -F 'backgroundId=1' \
  -F "policyId=${policy_id}" \
  -F 'sloganText=早安台北，平安順心！' \
  "${base_url}/api/v1/artworks" >"${temporary_directory}/artwork.json"

artwork_id="$(ruby -rjson -e 'puts JSON.parse(File.read(ARGV.fetch(0))).fetch("id")' \
  "${temporary_directory}/artwork.json")"
image_url="$(ruby -rjson -e 'puts JSON.parse(File.read(ARGV.fetch(0))).fetch("imageUrl")' \
  "${temporary_directory}/artwork.json")"

curl --fail --silent --show-error "$image_url" >"${temporary_directory}/source.png"
curl --fail --silent --show-error \
  -X PUT \
  -H 'X-Demo-User: user-b' \
  "${base_url}/api/v1/artworks/${artwork_id}/like" >"${temporary_directory}/like.json"
curl --fail --silent --show-error \
  -H 'X-Demo-User: user-b' \
  "${base_url}/api/v1/leaderboard" >"${temporary_directory}/leaderboard.json"
curl --fail --silent --show-error \
  -H 'X-Demo-User: user-b' \
  "${base_url}/api/v1/artworks/${artwork_id}/download" >"${temporary_directory}/download.png"
curl --fail --silent --show-error \
  -H 'X-Demo-User: user-b' \
  "${base_url}/api/v1/artworks/${artwork_id}" >"${temporary_directory}/artwork-after-download.json"
curl --fail --silent --show-error \
  -X DELETE \
  -H 'X-Demo-User: user-b' \
  "${base_url}/api/v1/artworks/${artwork_id}/like" >"${temporary_directory}/unlike.json"

ruby -rjson -e '
  artwork_id = Integer(ARGV.fetch(0))
  like = JSON.parse(File.read(ARGV.fetch(1)))
  ranking = JSON.parse(File.read(ARGV.fetch(2)))
  detail = JSON.parse(File.read(ARGV.fetch(3)))
  abort "like state mismatch" unless like["liked"] && like["likeCount"] >= 1
  abort "artwork missing from leaderboard" unless ranking.any? { |row| row.dig("artwork", "id") == artwork_id }
  abort "download count was not incremented" unless detail["downloadCount"] >= 1
' "$artwork_id" \
  "${temporary_directory}/like.json" \
  "${temporary_directory}/leaderboard.json" \
  "${temporary_directory}/artwork-after-download.json"

ruby -e '
  [ARGV.fetch(0), ARGV.fetch(1)].each do |path|
    bytes = File.binread(path)
    abort "not a PNG: #{path}" unless bytes.start_with?("\x89PNG\r\n\x1a\n".b)
    width, height = bytes.byteslice(16, 8).unpack("NN")
    abort "unexpected dimensions: #{width}x#{height}" unless width == 1080 && height == 1080
  end
' "${temporary_directory}/source.png" "${temporary_directory}/download.png"

if command -v docker >/dev/null 2>&1; then
  docker compose exec -T mariadb mariadb \
    "-u${DB_USERNAME:-good_morning}" \
    "-p${DB_PASSWORD:-good_morning}" \
    "${DB_NAME:-good_morning}" \
    -e 'SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;' \
    >/dev/null
fi

echo "smoke test passed: artwork=${artwork_id} policy=${policy_id}"
