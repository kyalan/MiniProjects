#!/bin/sh
set -eu
attempt=0
until python manage.py migrate --noinput; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 30 ]; then
    echo "Database migrate failed" >&2
    exit 1
  fi
  echo "Waiting for the database..."
  sleep 2
done
python manage.py ensure_superuser
exec "$@"
