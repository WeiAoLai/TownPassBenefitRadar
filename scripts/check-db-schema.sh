#!/usr/bin/env bash

set -euo pipefail

schema_file="src/main/resources/db/migration/V1__create_schema.sql"

if [[ ! -f "$schema_file" ]]; then
  echo "missing Flyway migration: $schema_file" >&2
  exit 1
fi

expected_tables=(users backgrounds policies artworks artwork_likes)

for table_name in "${expected_tables[@]}"; do
  if ! rg -q "CREATE TABLE ${table_name}" "$schema_file"; then
    echo "missing table: $table_name" >&2
    exit 1
  fi
done

table_count="$(rg -c '^CREATE TABLE ' "$schema_file")"
if [[ "$table_count" -ne "${#expected_tables[@]}" ]]; then
  echo "expected ${#expected_tables[@]} tables, found $table_count" >&2
  exit 1
fi

required_patterns=(
  'UNIQUE KEY uk_users_sso_subject'
  'UNIQUE KEY uk_users_account'
  'UNIQUE KEY uk_artwork_likes_user_artwork'
  'CONSTRAINT fk_artworks_owner'
  'CONSTRAINT fk_artworks_background'
  'CONSTRAINT fk_artworks_policy'
  'CONSTRAINT fk_artwork_likes_user'
  'CONSTRAINT fk_artwork_likes_artwork'
  'KEY idx_artworks_owner_created'
  'KEY idx_artworks_created'
  'start_date DATE NOT NULL'
  'end_date DATE NOT NULL'
  'CHECK \(end_date >= start_date\)'
  'CHECK \(like_count >= 0\)'
  'CHECK \(download_count >= 0\)'
  'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
)

for pattern in "${required_patterns[@]}"; do
  if ! rg -q "$pattern" "$schema_file"; then
    echo "missing schema requirement: $pattern" >&2
    exit 1
  fi
done

echo "schema structure checks passed"
