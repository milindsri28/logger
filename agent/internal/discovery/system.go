package discovery

import (
	"bytes"
	"encoding/json"
	"os/exec"
	"strconv"
	"strings"

	"github.com/argusops/agent/internal/runtime"
)

type SystemService struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}

var systemChecks = []struct {
	name string
	cmd  string
}{
	{
		name: "nginx",
		cmd:  "systemctl is-active nginx 2>/dev/null || pgrep -x nginx >/dev/null && echo active || echo inactive",
	},
	{
		name: "postgres",
		cmd:  "systemctl is-active postgresql 2>/dev/null || docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1 | xargs -I{} echo active || echo inactive",
	},
	{
		name: "redis",
		cmd:  "systemctl is-active redis 2>/dev/null || systemctl is-active redis-server 2>/dev/null || docker ps --format '{{.Names}}' 2>/dev/null | grep -i redis | head -1 | xargs -I{} echo active || echo inactive",
	},
}

func shellOutput(script string) string {
	cmd := exec.Command("bash", "-c", script)
	cmd.Env = runtime.ExecEnv()
	out, err := cmd.CombinedOutput()
	if err != nil {
		return strings.TrimSpace(string(out))
	}
	return strings.TrimSpace(string(out))
}

func hasName(names []string, target string) bool {
	target = strings.ToLower(target)
	for _, n := range names {
		if strings.Contains(strings.ToLower(n), target) {
			return true
		}
	}
	return false
}

// DiscoverSystem probes nginx, postgres, and redis unless already represented in existingNames.
func DiscoverSystem(existingNames []string) []SystemService {
	var services []SystemService
	for _, check := range systemChecks {
		if hasName(existingNames, check.name) {
			continue
		}
		out := strings.ToLower(shellOutput(check.cmd))
		status := "down"
		if strings.Contains(out, "active") {
			status = "running"
		}
		services = append(services, SystemService{Name: check.name, Status: status})
	}
	return services
}

func DiscoverSystemJSON(existingNames []string) string {
	services := DiscoverSystem(existingNames)
	data, _ := json.Marshal(services)
	return string(data)
}

// SystemLogs fetches logs for nginx, postgres, or redis (mirrors legacy SSH behavior).
func SystemLogs(serviceName string, lines int) (stdout string, stderr string, exitCode int) {
	svc := strings.ToLower(strings.TrimSpace(serviceName))
	tail := lines
	if tail <= 0 {
		tail = 300
	}
	tailStr := strconv.Itoa(tail)

	var script string
	switch svc {
	case "nginx":
		script = "tail -n " + tailStr + " /var/log/nginx/error.log 2>/dev/null; echo '---'; tail -n " + tailStr + " /var/log/nginx/access.log 2>/dev/null"
	case "postgres", "postgresql":
		script = "docker logs --tail " + tailStr + " $(docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1) 2>&1 || journalctl -u postgresql -n " + tailStr + " --no-pager 2>/dev/null || echo 'No postgres logs found'"
	case "redis":
		script = "docker logs --tail " + tailStr + " $(docker ps --format '{{.Names}}' 2>/dev/null | grep -i redis | head -1) 2>&1 || journalctl -u redis -n " + tailStr + " --no-pager 2>/dev/null || journalctl -u redis-server -n " + tailStr + " --no-pager 2>/dev/null || echo 'No redis logs found'"
	default:
		return "", "unknown system service: " + serviceName, 1
	}

	cmd := exec.Command("bash", "-c", script)
	cmd.Env = runtime.ExecEnv()
	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf
	err := cmd.Run()
	exitCode = 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			exitCode = ee.ExitCode()
		} else {
			return "", err.Error(), 1
		}
	}
	stdout = stdoutBuf.String()
	stderr = stderrBuf.String()
	if strings.TrimSpace(stdout) == "" && strings.TrimSpace(stderr) == "" {
		stdout = "No logs for " + serviceName
	}
	return stdout, stderr, exitCode
}
