# ArgusOps Agent (Local MVP)

Lightweight Go agent for infrastructure monitoring and whitelisted command execution.

## Build

```bash
cd agent
go mod tidy
make build   # outputs dist/argusops-agent (linux/amd64)
```

For local development on the same machine:

```bash
go build -o argusops-agent ./cmd/argusops-agent
```

## Register manually

```bash
export BACKEND_URL=http://localhost:4000
./argusops-agent --register --token agent_xxxxx
./argusops-agent
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `BACKEND_URL` | Base backend URL (e.g. `http://localhost:4000`) |
| `API_URL` | REST API prefix (default: `{BACKEND_URL}/api`) |
| `WS_URL` | WebSocket URL (default: `ws://localhost:4000/agent/ws`) |
| `ARGUSOPS_CONFIG` | Path to config file |

## Allowed commands

- `docker_ps`
- `docker_logs` (args: `containerId`, optional `tail`)
- `systemctl_status` (args: `unit`)
