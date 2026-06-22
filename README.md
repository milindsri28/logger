# AI Debug Investigator

Production-ready MVP that analyzes VPS production logs and correlates them with a connected GitHub repository to identify root causes, affected code, and relevant commits.

## Features

- **GitHub Integration** — Connect via PAT, clone repos, index JS/TS/React/Next.js source files
- **VPS Integration** — SSH to Hostinger (or any Linux VPS), fetch PM2/Nginx/Docker/Node logs
- **Incident Analysis** — Parse logs, correlate with code index, fetch commits, LLM analysis
- **Analysis Reports** — Root cause, confidence score, affected files/functions, commits, fixes, snippets, timeline

## Tech Stack

| Layer      | Technology                    |
|------------|-------------------------------|
| Frontend   | Next.js 15, TypeScript, Tailwind |
| Backend    | Node.js, Express, TypeScript  |
| Database   | PostgreSQL                    |
| Auth       | JWT + bcrypt                  |
| AI         | OpenAI GPT-4.1 or Gemini      |
| VPS        | node-ssh                      |
| Git        | simple-git + GitHub API       |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)
- GitHub Personal Access Token (repo scope)
- OpenAI or Gemini API key

### Setup

```bash
# Clone and enter project
cd logger

# Copy environment file
cp .env.example .env

# Generate encryption key (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste result into ENCRYPTION_KEY in .env

# Start database
docker compose up -d

# Install & migrate
cd backend && npm install && npm run migrate
cd ../frontend && npm install

# Run (two terminals)
cd backend && npm run dev    # http://localhost:4000
cd frontend && npm run dev   # http://localhost:3000
```

### Hostinger VPS Setup

1. Get your VPS IP from Hostinger hPanel
2. SSH user is typically `root` or `u123456789`
3. Use SSH key auth (recommended) or password
4. Ensure PM2 and/or Nginx are installed on the VPS
5. In the app, connect VPS under **VPS** page
6. Test SSH before running analysis

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT |
| POST | `/api/github/repository` | Connect & clone repo |
| POST | `/api/vps/connect` | Save VPS credentials |
| POST | `/api/vps/fetch-logs` | Fetch logs from VPS |
| POST | `/api/incidents/analyze` | Run full incident analysis |
| GET | `/api/incidents/:id` | Get report |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full API and schema documentation.

## Security

- GitHub tokens and SSH credentials encrypted at rest (AES-256-GCM)
- Secrets never returned to frontend after save
- JWT authentication on all protected routes
- Rate limiting on auth and analyze endpoints

## Project Structure

```
logger/
├── ARCHITECTURE.md    # Full system design
├── frontend/          # Next.js dashboard
├── backend/           # Express API
├── database/          # SQL migrations
├── worker/            # Future job queue (MVP uses in-process)
└── scripts/           # Setup helpers
```

## Environment Variables

See `.env.example` for all required variables.

## License

MIT
