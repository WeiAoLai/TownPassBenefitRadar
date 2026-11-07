#!/usr/bin/env bash

set -euo pipefail

if awslocal s3api head-bucket --bucket "$AWS_S3_BUCKET" >/dev/null 2>&1; then
  exit 0
fi

awslocal s3api create-bucket \
  --bucket "$AWS_S3_BUCKET" \
  --region "$AWS_DEFAULT_REGION" \
  --create-bucket-configuration "LocationConstraint=$AWS_DEFAULT_REGION"
