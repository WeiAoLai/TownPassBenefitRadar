#!/usr/bin/env bash

set -euo pipefail

schema_file="src/main/resources/db/migration/V1__create_schema.sql"
policy_migration_file="src/main/resources/db/migration/V4__align_policy_catalog.sql"

if [[ ! -f "$schema_file" ]]; then
  echo "missing Flyway migration: $schema_file" >&2
  exit 1
fi

if [[ ! -f "$policy_migration_file" ]]; then
  echo "missing Flyway migration: $policy_migration_file" >&2
  exit 1
fi

expected_tables=(users backgrounds policies artworks artwork_likes)

for table_name in "${expected_tables[@]}"; do
  if ! grep -Eq "CREATE TABLE ${table_name}" "$schema_file"; then
    echo "missing table: $table_name" >&2
    exit 1
  fi
done

table_count="$(grep -Ec '^CREATE TABLE ' "$schema_file")"
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
  'CHECK \(like_count >= 0\)'
  'CHECK \(download_count >= 0\)'
  'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
)

for pattern in "${required_patterns[@]}"; do
  if ! grep -Eq "$pattern" "$schema_file"; then
    echo "missing schema requirement: $pattern" >&2
    exit 1
  fi
done

policy_patterns=(
  'MODIFY COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT'
  'MODIFY COLUMN category VARCHAR\(50\) NOT NULL'
  'MODIFY COLUMN title VARCHAR\(255\) NOT NULL'
  'MODIFY COLUMN slogan VARCHAR\(255\) NOT NULL'
  'MODIFY COLUMN source_url VARCHAR\(768\) NOT NULL'
  'MODIFY COLUMN start_date DATE NULL'
  'MODIFY COLUMN end_date DATE NULL DEFAULT NULL'
  'UNIQUE KEY uk_policies_source_url'
  'CHECK \(start_date IS NULL OR end_date IS NULL OR end_date >= start_date\)'
)

for pattern in "${policy_patterns[@]}"; do
  if ! grep -Eq "$pattern" "$policy_migration_file"; then
    echo "missing policy schema requirement: $pattern" >&2
    exit 1
  fi
done

echo "schema structure checks passed"
