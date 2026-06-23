#!/bin/sh
set -e

echo "Running database migrations..."
node dist/scripts/migrate.js

exec "$@"
