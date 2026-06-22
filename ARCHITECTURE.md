# AI Debug Investigator — Architecture & Implementation Plan

## 1. System Overview

AI Debug Investigator correlates production VPS logs with a connected GitHub repository to pinpoint root causes, affected code, and relevant commits during incidents.

```
┌─────────────┐     HTTPS/JWT      ┌──────────────┐     SQL      ┌────────────┐
│  Next.js 15 │ ◄────────────────► │ Express API  │ ◄──────────► │ PostgreSQL │
│  Frontend   │                    │   Backend    │              └────────────┘
└─────────────┘                    └──────┬───────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
              ┌──────────┐         ┌──────────┐          ┌──────────┐
              │ GitHub   │         │ VPS SSH  │          │ OpenAI / │
              │ API +    │         │ (Hostinger│          │ Gemini   │
              │ Local    │         │  VPS)    │          │ API      │
              │ Clone    │         └──────────┘          └──────────┘
              └──────────┘
```

### Design Principles

- **Secrets never leave the backend** — GitHub PATs, SSH keys/passwords encrypted at rest (AES-256-GCM).
- **Separation of concerns** — API handles auth & orchestration; worker handles long-running clone/index/analyze jobs.
- **Idempotent analysis** — Each incident run is stored as an immutable `analysis_reports` row.
- **Hostinger-friendly** — SSH on port 22 (or custom), PM2/Nginx/Docker log paths pre-configured.

---

## 2. Folder Structure

```
logger/
├── ARCHITECTURE.md
├── README.md
├── .env.example
├── docker-compose.yml          # PostgreSQL for local dev
├── frontend/                   # Next.js 15 + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/
│   │   ├── lib/                # API client, auth helpers
│   │   └── types/
│   └── package.json
├── backend/                    # Express + TypeScript
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── index.ts
│   └── package.json
├── database/
│   ├── migrations/
│   │   └── 001_initial.sql
│   └── seeds/
├── worker/                     # Background job processor
│   ├── src/
│   │   ├── jobs/
│   │   └── index.ts
│   └── package.json
└── scripts/
    ├── setup.sh
    └── migrate.sh
```

---

## 3. Database Schema

### `users`
| Column        | Type         | Notes                          |
|---------------|--------------|--------------------------------|
| id            | UUID PK      | `gen_random_uuid()`            |
| email         | VARCHAR(255) | UNIQUE, NOT NULL               |
| password_hash | VARCHAR(255) | bcrypt                         |
| name          | VARCHAR(255) |                                |
| created_at    | TIMESTAMPTZ  | DEFAULT NOW()                  |
| updated_at    | TIMESTAMPTZ  |                                |

### `repositories`
| Column              | Type         | Notes                              |
|---------------------|--------------|------------------------------------|
| id                  | UUID PK      |                                    |
| user_id             | UUID FK      | → users                            |
| github_token_enc    | TEXT         | AES-256-GCM encrypted PAT          |
| repo_url            | VARCHAR(512) | e.g. `https://github.com/o/r`      |
| owner               | VARCHAR(255) | Parsed from URL                    |
| name                | VARCHAR(255) | Parsed from URL                    |
| default_branch      | VARCHAR(100) | From GitHub API                    |
| local_path          | VARCHAR(512) | Clone destination on server        |
| clone_status        | VARCHAR(50)  | pending / cloning / ready / failed |
| index_status        | VARCHAR(50)  | pending / indexing / ready / failed|
| file_count          | INTEGER      | Indexed source files               |
| last_synced_at      | TIMESTAMPTZ  |                                    |
| created_at          | TIMESTAMPTZ  |                                    |

### `code_index`
| Column       | Type         | Notes                                    |
|--------------|--------------|------------------------------------------|
| id           | UUID PK      |                                          |
| repository_id| UUID FK      | → repositories                           |
| file_path    | VARCHAR(1024)| Relative path in repo                    |
| language     | VARCHAR(50)  | js, ts, tsx, jsx                         |
| symbols      | JSONB        | `{ functions: [], classes: [], exports }`|
| content_hash | VARCHAR(64)  | SHA-256 of file content                  |
| indexed_at   | TIMESTAMPTZ  |                                          |

### `vps_connections`
| Column           | Type         | Notes                         |
|------------------|--------------|-------------------------------|
| id               | UUID PK      |                               |
| user_id          | UUID FK      | → users                       |
| name             | VARCHAR(255) | e.g. "Hostinger Production"   |
| host             | VARCHAR(255) | VPS IP or hostname            |
| port             | INTEGER      | DEFAULT 22                    |
| username         | VARCHAR(255) |                               |
| auth_type        | VARCHAR(20)  | `key` or `password`           |
| credentials_enc  | TEXT         | Encrypted SSH key or password |
| created_at       | TIMESTAMPTZ  |                               |

### `incidents`
| Column            | Type         | Notes                              |
|-------------------|--------------|------------------------------------|
| id                | UUID PK      |                                    |
| user_id           | UUID FK      | → users                            |
| repository_id     | UUID FK      | → repositories                     |
| vps_connection_id | UUID FK      | → vps_connections                  |
| title             | VARCHAR(255) | User-provided or auto-generated    |
| status            | VARCHAR(50)  | pending / analyzing / completed / failed |
| log_sources       | JSONB        | `["pm2","nginx","docker","node"]`  |
| raw_logs          | TEXT         | Fetched log content                |
| extracted_signals | JSONB        | Parsed errors, stacks, services    |
| created_at        | TIMESTAMPTZ  |                                    |
| completed_at      | TIMESTAMPTZ  |                                    |

### `analysis_reports`
| Column            | Type         | Notes                                    |
|-------------------|--------------|------------------------------------------|
| id                | UUID PK      |                                          |
| incident_id       | UUID FK      | → incidents (UNIQUE)                     |
| root_cause        | TEXT         | LLM output                               |
| confidence_score  | DECIMAL(5,2) | 0.00 – 100.00                            |
| affected_files    | JSONB        | `[{ path, reason, snippet }]`            |
| affected_functions| JSONB        | `[{ name, file, line }]`                 |
| relevant_commits  | JSONB        | `[{ sha, message, author, date }]`       |
| suggested_fix     | TEXT         |                                          |
| code_snippets     | JSONB        | `[{ path, startLine, endLine, code }]`   |
| timeline          | JSONB        | `[{ timestamp, event }]`                 |
| llm_model         | VARCHAR(100) | e.g. gpt-4.1                             |
| llm_raw_response  | JSONB        | Full structured LLM response             |
| created_at        | TIMESTAMPTZ  |                                          |

### Indexes
```sql
CREATE INDEX idx_repositories_user ON repositories(user_id);
CREATE INDEX idx_vps_user ON vps_connections(user_id);
CREATE INDEX idx_incidents_user ON incidents(user_id);
CREATE INDEX idx_code_index_repo ON code_index(repository_id);
CREATE INDEX idx_code_index_symbols ON code_index USING GIN(symbols);
```

---

## 4. API Routes

Base URL: `http://localhost:4000/api`

### Auth (`/api/auth`)
| Method | Path           | Auth | Description              |
|--------|----------------|------|--------------------------|
| POST   | `/register`    | No   | Create account           |
| POST   | `/login`       | No   | Returns JWT              |
| GET    | `/me`          | Yes  | Current user profile     |

### GitHub (`/api/github`)
| Method | Path                    | Auth | Description                    |
|--------|-------------------------|------|--------------------------------|
| POST   | `/connect`              | Yes  | Save encrypted PAT             |
| POST   | `/repository`           | Yes  | Add repo URL, trigger clone    |
| GET    | `/repositories`         | Yes  | List user's repos              |
| GET    | `/repositories/:id`     | Yes  | Repo detail + index status     |
| POST   | `/repositories/:id/sync`| Yes  | Re-clone & re-index            |
| DELETE | `/repositories/:id`     | Yes  | Remove repo + local clone      |

### VPS (`/api/vps`)
| Method | Path              | Auth | Description                         |
|--------|-------------------|------|-------------------------------------|
| POST   | `/connect`        | Yes  | Save VPS connection (encrypted)     |
| GET    | `/connections`    | Yes  | List VPS connections                |
| DELETE | `/connections/:id`| Yes  | Remove connection                   |
| POST   | `/test`           | Yes  | Test SSH connectivity               |
| POST   | `/fetch-logs`     | Yes  | Fetch logs from VPS (see below)     |

#### `POST /api/vps/fetch-logs`
```json
{
  "vpsConnectionId": "uuid",
  "sources": ["pm2", "nginx", "docker", "node"],
  "lines": 500,
  "serviceName": "my-app"
}
```
Response: `{ "logs": { "pm2": "...", "nginx": "..." }, "fetchedAt": "ISO" }`

### Incidents (`/api/incidents`)
| Method | Path              | Auth | Description                          |
|--------|-------------------|------|--------------------------------------|
| POST   | `/analyze`        | Yes  | Start full incident analysis         |
| GET    | `/`               | Yes  | List incidents (history)             |
| GET    | `/:id`            | Yes  | Incident + report if completed       |
| GET    | `/:id/status`     | Yes  | Poll analysis progress               |

#### `POST /api/incidents/analyze`
```json
{
  "repositoryId": "uuid",
  "vpsConnectionId": "uuid",
  "title": "502 errors on checkout",
  "logSources": ["pm2", "nginx"],
  "serviceName": "api"
}
```

### Health
| Method | Path        | Auth | Description |
|--------|-------------|------|-------------|
| GET    | `/health`   | No   | Liveness    |

---

## 5. Service Layer

### `EncryptionService`
- `encrypt(plaintext: string): string` — AES-256-GCM, IV prepended
- `decrypt(ciphertext: string): string`
- Key from `ENCRYPTION_KEY` env (32-byte hex)

### `AuthService`
- Register/login with bcrypt (12 rounds)
- JWT sign/verify (7-day expiry, `JWT_SECRET`)

### `GitHubService`
- Validate PAT via `GET /user`
- Parse repo URL → owner/name
- Clone via `simple-git` to `data/repos/{userId}/{repoId}`
- Fetch recent commits for matched files via GitHub API
- List branches, default branch

### `CodeIndexService`
- Walk cloned repo for `.js`, `.jsx`, `.ts`, `.tsx`
- Skip `node_modules`, `.next`, `dist`, `build`
- Parse with `@babel/parser` + `@babel/traverse`:
  - Function declarations, arrow functions, class methods
  - Class declarations
  - Named exports
- Store in `code_index` with JSONB symbols
- Search by filename, symbol name (case-insensitive)

### `VpsService` (Hostinger-optimized)
- Connect via `node-ssh`
- Log fetch commands:
  - **PM2**: `pm2 logs {service} --lines {n} --nostream` or `pm2 logs --lines {n} --nostream`
  - **Node**: `tail -n {n} ~/.pm2/logs/{service}-error.log` (fallback paths)
  - **Nginx**: `sudo tail -n {n} /var/log/nginx/error.log` (and access.log)
  - **Docker**: `docker logs --tail {n} {container}` (list containers first)
- Connection test: `echo ok && uname -a`

### `LogParserService`
- Regex extraction:
  - Error messages (`Error:`, `TypeError:`, `ECONNREFUSED`, HTTP 5xx)
  - Stack traces (`at FunctionName (file:line:col)`)
  - File references from stacks
  - Service/process names from PM2 output
- Output: `ExtractedSignals` typed object

### `CorrelationService`
- Match stack file paths → indexed `code_index.file_path`
- Fuzzy match filenames (basename)
- Search symbols for function names from stack
- Rank files by match count + recency of commits

### `LlmService`
- Provider switch: `LLM_PROVIDER=openai|gemini`
- Structured prompt with logs, snippets, commits
- Request JSON response schema:
  ```json
  {
    "rootCause": "...",
    "confidenceScore": 85,
    "affectedFiles": [...],
    "affectedFunctions": [...],
    "relevantCommits": [...],
    "suggestedFix": "...",
    "timeline": [...]
  }
  ```
- Parse & validate response; store in `analysis_reports`

### `IncidentAnalysisService` (Orchestrator)
```
analyzeIncident(incidentId):
  1. VpsService.fetchLogs()
  2. LogParserService.extract()
  3. CorrelationService.searchRepo()
  4. GitHubService.getCommitsForFiles()
  5. CodeIndexService.getSnippets()
  6. LlmService.analyze()
  7. Persist analysis_reports
  8. Update incident status
```

---

## 6. Worker Jobs

| Job              | Trigger                    | Duration   |
|------------------|----------------------------|------------|
| `clone-repo`     | POST /github/repository    | 30s–5min   |
| `index-repo`     | After clone completes      | 10s–2min   |
| `analyze-incident`| POST /incidents/analyze   | 30s–2min   |

MVP: In-process job queue (`bull` or simple async with status polling). Production: Redis + BullMQ.

---

## 7. Frontend Pages

| Route                  | Page                | Key Components                          |
|------------------------|---------------------|-----------------------------------------|
| `/login`               | Login               | Email/password form                     |
| `/register`            | Register            | Sign-up form                            |
| `/dashboard`           | Dashboard           | Stats, quick actions                    |
| `/github`              | Connect GitHub      | PAT input, repo URL, status             |
| `/vps`                 | Connect VPS         | Hostinger SSH form, test connection     |
| `/analyze`             | Incident Analyzer   | Select repo + VPS, analyze button       |
| `/incidents`           | Analysis History    | Table of past incidents                 |
| `/incidents/[id]`      | Report Detail       | Full analysis report UI                 |

### Report UI Sections
1. **Incident Summary** — title, date, log sources
2. **Root Cause** — LLM narrative
3. **Confidence Score** — gauge (0–100%)
4. **Affected Files** — linked list with paths
5. **Affected Functions** — name + file + line
6. **Relevant Commits** — sha, message, author, date
7. **Suggested Fix** — markdown rendered
8. **Code Snippets** — syntax-highlighted blocks
9. **Timeline** — vertical timeline component

---

## 8. Security

| Concern              | Mitigation                                      |
|----------------------|-------------------------------------------------|
| Credential storage   | AES-256-GCM, key in env only                    |
| API auth             | JWT in httpOnly cookie or Authorization header  |
| SSH keys             | Never logged; decrypted only in memory per request |
| GitHub tokens        | Encrypted in DB; used server-side only          |
| CORS                 | Restrict to `FRONTEND_URL`                      |
| Rate limiting        | `express-rate-limit` on auth & analyze endpoints|
| Input validation     | `zod` schemas on all POST bodies                |

---

## 9. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ai_debug

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=7d

# Encryption (64 hex chars = 32 bytes)
ENCRYPTION_KEY=...

# LLM
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...

# App
BACKEND_PORT=4000
FRONTEND_URL=http://localhost:3000
REPOS_DATA_DIR=./data/repos

# Worker
REDIS_URL=redis://localhost:6379  # optional for MVP
```

---

## 10. Hostinger VPS Notes

Typical Hostinger VPS setup:
- **SSH**: Port 22, root or `u123456789` style user
- **PM2**: `npm i -g pm2`, apps in `/home/{user}/domains/{domain}/`
- **Nginx**: `/var/log/nginx/error.log`, config in `/etc/nginx/sites-enabled/`
- **Docker**: Optional; `docker ps` to list containers
- **Firewall**: Ensure SSH allowed; app ports may be 3000/8080 behind Nginx

Pre-built log source presets in UI labeled "Hostinger Production".

---

## 11. Implementation Phases

### Phase 1 — Foundation (Day 1)
- [x] Architecture doc
- [ ] docker-compose + migrations
- [ ] Backend scaffold: Express, auth, encryption
- [ ] Frontend scaffold: Next.js 15, Tailwind, auth pages

### Phase 2 — Integrations (Day 2)
- [ ] GitHub connect + clone + index
- [ ] VPS connect + fetch-logs
- [ ] Log parser + correlation engine

### Phase 3 — Analysis (Day 3)
- [ ] LLM service (OpenAI + Gemini)
- [ ] Incident orchestrator + worker
- [ ] Analysis report API

### Phase 4 — UI Polish (Day 4)
- [ ] Dashboard + all pages
- [ ] Report detail with snippets & timeline
- [ ] Error states, loading, polling

### Phase 5 — Hardening
- [ ] Rate limiting, validation
- [ ] README + setup scripts
- [ ] End-to-end smoke test

---

## 12. Key TypeScript Interfaces

```typescript
interface ExtractedSignals {
  errors: string[];
  stackTraces: { frames: StackFrame[] }[];
  fileReferences: string[];
  serviceNames: string[];
  httpErrors: { status: number; path?: string }[];
}

interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
}

interface AnalysisResult {
  rootCause: string;
  confidenceScore: number;
  affectedFiles: { path: string; reason: string }[];
  affectedFunctions: { name: string; file: string; line?: number }[];
  relevantCommits: { sha: string; message: string; author: string; date: string }[];
  suggestedFix: string;
  codeSnippets: { path: string; startLine: number; endLine: number; code: string }[];
  timeline: { timestamp: string; event: string }[];
}
```

---

## 13. Sequence: Analyze Incident

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Backend API
    participant VPS as Hostinger VPS
    participant GH as GitHub
    participant LLM as OpenAI/Gemini
    participant DB as PostgreSQL

    U->>FE: Click Analyze Incident
    FE->>API: POST /incidents/analyze
    API->>DB: Create incident (pending)
    API-->>FE: incidentId

    API->>VPS: SSH fetch PM2/Nginx logs
    VPS-->>API: raw logs
    API->>API: LogParser.extract()
    API->>DB: Search code_index
    API->>GH: Get commits for matched files
    API->>LLM: Analyze(context)
    LLM-->>API: structured report
    API->>DB: Save analysis_reports
    API->>DB: Update incident (completed)

    FE->>API: GET /incidents/:id (poll)
    API-->>FE: Full report
    FE->>U: Display report UI
```
