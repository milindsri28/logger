#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Starting PostgreSQL..."
docker compose up -d postgres

echo "==> Waiting for PostgreSQL..."
sleep 3

echo "==> Installing backend dependencies..."
cd backend && npm install

echo "==> Running migrations..."
npm run migrate

echo "==> Installing frontend dependencies..."
cd ../frontend && npm install

echo ""
echo "Setup complete!"
echo ""
echo "1. Copy .env.example to .env and fill in secrets:"
echo "   cp .env.example .env"
echo ""
echo "2. Generate encryption key:"
echo "   node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo ""
echo "3. Start backend:  cd backend && npm run dev"
echo "4. Start frontend: cd frontend && npm run dev"
echo ""
echo "Open http://localhost:3000"
