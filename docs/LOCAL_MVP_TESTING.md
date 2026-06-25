# Local MVP Testing Guide

This guide covers running the GitHub OAuth + Go agent integrations locally.

## Prerequisites

- Node.js 20+
- Docker (PostgreSQL)
- Go 1.22+ (to build the agent)
- GitHub OAuth App (see below)

## 1. GitHub OAuth App

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Set **Authorization callback URL** to:
   ```
   http://localhost:4000/api/oauth/github/callback
   ```
3. Copy Client ID and Client Secret into `.env`:

```bash
GITHUB_OAUTH_CLIENT_ID=your_client_id
GITHUB_OAUTH_CLIENT_SECRET=your_client_secret
```

## 2. Environment Variables

Copy `.env.example` to `.env` and ensure:

```bash
BACKEND_URL=http://localhost:4000
API_URL=http://localhost:4000/api
WS_URL=ws://localhost:4000/agent/ws
FRONTEND_URL=http://localhost:3000
INSTALL_SCRIPT_URL=http://localhost:4000/agent/install.sh

NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

ENCRYPTION_KEY=<64 hex chars>
JWT_SECRET=<random string>
AGENT_JWT_SECRET=<random string>
OAUTH_STATE_SECRET=<random string>
```

All URLs are env-driven — no hardcoded domains.

## 3. Start the Stack

```bash
docker compose up -d
cd backend && npm install && npm run migrate
cd ../frontend && npm install

# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:4000
- WebSocket: ws://localhost:4000/agent/ws

## 4. Test GitHub OAuth

### Sign in with GitHub (SSO)

1. Open http://localhost:3000/login
2. Click **Sign in with GitHub**
3. Authorize the app
4. You are redirected to `/integrations` with GitHub connected

### Connect GitHub (existing account)

1. Register/login with email
2. Go to `/integrations`
3. Click **Connect GitHub**
4. Status shows connected account

### Disconnect

On `/integrations`, click **Disconnect** on the GitHub card.

## 5. Build the Agent

```bash
cd agent
go mod tidy
make build    # linux/amd64 → dist/argusops-agent
```

For testing on the same Windows dev machine with WSL/Linux VM, copy `dist/argusops-agent` to the target server.

## 6. Install Agent on Linux

### Same network (backend reachable)

1. Go to `/integrations` → **Add Server**
2. Enter a label → **Generate Token**
3. Copy the install command
4. On your Linux VPS:

```bash
export BACKEND_URL=http://<your-backend-host>:4000
export WS_URL=ws://<your-backend-host>:4000/agent/ws
curl -fsSL http://<your-backend-host>:4000/agent/install.sh | bash -s -- agent_xxxxx
```

### Backend on localhost, agent on remote VPS

A remote VPS cannot reach `localhost` on your machine. Use a tunnel:

```bash
ngrok http 4000
```

Update `.env` with ngrok URLs:

```bash
BACKEND_URL=https://abc123.ngrok-free.app
API_URL=https://abc123.ngrok-free.app/api
WS_URL=wss://abc123.ngrok-free.app/agent/ws
INSTALL_SCRIPT_URL=https://abc123.ngrok-free.app/agent/install.sh
FRONTEND_URL=http://localhost:3000
```

Restart the backend, then generate a new install token from `/integrations`.

### Manual registration (no install script)

```bash
export BACKEND_URL=http://localhost:4000
export WS_URL=ws://localhost:4000/agent/ws
./argusops-agent --register --token agent_xxxxx
./argusops-agent
```

## 7. Verify Agent Connection

1. `/integrations` → Infrastructure card shows agent as **connected** (green dot)
2. Status polls every 5s until connected

## 8. Test Whitelisted Commands

With a connected agent, dispatch a test command:

```bash
curl -X POST http://localhost:4000/api/agents/<AGENT_ID>/commands \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"command":"docker_ps","args":{}}'
```

Allowed commands:

| Command | Args |
|---------|------|
| `docker_ps` | `{}` |
| `docker_logs` | `{ "containerId": "abc123", "tail": 100 }` |
| `systemctl_status` | `{ "unit": "nginx" }` |

## 9. API Reference (MVP)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/oauth/github/authorize?action=login` | — | GitHub SSO |
| `GET /api/oauth/github/authorize?action=connect&token=` | User JWT | Connect GitHub |
| `GET /api/integrations/status` | User JWT | Integration status |
| `DELETE /api/integrations/repositories/github` | User JWT | Disconnect GitHub |
| `POST /api/agents/tokens` | User JWT | Generate install token |
| `GET /api/agents` | User JWT | List agents |
| `POST /api/agents/:id/commands` | User JWT | Test command dispatch |
| `POST /agent/register` | — | Agent registration |
| `POST /agent/heartbeat` | Agent JWT | REST heartbeat |
| `WS /agent/ws` | Agent JWT | Persistent connection |

## 10. Troubleshooting

| Issue | Fix |
|-------|-----|
| OAuth redirect error | Callback URL must match GitHub app exactly |
| Agent stays disconnected | Check `WS_URL` is reachable from VPS; use ngrok for local backend |
| `install script not found` | Ensure `agent/scripts/install.sh` exists; backend serves it at `/agent/install.sh` |
| Binary not found | Run `make -C agent build` before install |
| Encryption errors | Set `ENCRYPTION_KEY` to 64 hex characters |
