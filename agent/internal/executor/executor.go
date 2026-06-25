package executor

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"sync"

	"github.com/argusops/agent/internal/discovery"
	"github.com/argusops/agent/internal/runtime"
)

var allowed = map[string]bool{
	"docker_ps":        true,
	"docker_logs":      true,
	"pm2_list":         true,
	"pm2_logs":         true,
	"system_discover":  true,
	"system_logs":      true,
	"systemctl_status": true,
}

var activeCmds sync.Map

type Result struct {
	ExitCode int
	Stdout   string
	Stderr   string
}

func Cancel(jobID string) {
	if v, ok := activeCmds.Load(jobID); ok {
		if cmd, ok := v.(*exec.Cmd); ok && cmd.Process != nil {
			_ = cmd.Process.Kill()
		}
	}
}

func isFollow(args map[string]interface{}) bool {
	v, ok := args["follow"]
	if !ok {
		return false
	}
	b, ok := v.(bool)
	return ok && b
}

func collectExistingServiceNames() []string {
	var names []string
	if runtime.DockerAvailable() {
		out, err := runtime.DockerCommand("ps", "-a", "--format", "{{.Names}}").Output()
		if err == nil {
			for _, line := range strings.Split(string(out), "\n") {
				if t := strings.TrimSpace(line); t != "" {
					names = append(names, t)
				}
			}
		}
	}
	if runtime.PM2Available() {
		out, err := runtime.PM2Command("jlist").Output()
		if err == nil {
			var apps []map[string]interface{}
			if json.Unmarshal(out, &apps) == nil {
				for _, app := range apps {
					if n, ok := app["name"].(string); ok && n != "" {
						names = append(names, n)
					}
				}
			}
		}
	}
	return names
}

func runSystemDiscover() (Result, error) {
	existing := collectExistingServiceNames()
	stdout := discovery.DiscoverSystemJSON(existing)
	return Result{ExitCode: 0, Stdout: stdout}, nil
}

func runSystemLogs(args map[string]interface{}) (Result, error) {
	serviceName, _ := args["serviceName"].(string)
	if serviceName == "" {
		serviceName, _ = args["appName"].(string)
	}
	tail := ParseTail(args)
	stdout, stderr, exitCode := discovery.SystemLogs(serviceName, tail)
	return Result{ExitCode: exitCode, Stdout: stdout, Stderr: stderr}, nil
}

func buildCmd(command string, args map[string]interface{}) (*exec.Cmd, error) {
	if !allowed[command] {
		return nil, fmt.Errorf("command not allowed: %s", command)
	}

	switch command {
	case "docker_ps":
		if !runtime.DockerAvailable() {
			return nil, fmt.Errorf("docker not found in PATH")
		}
		return runtime.DockerCommand("ps", "-a"), nil
	case "docker_logs":
		if !runtime.DockerAvailable() {
			return nil, fmt.Errorf("docker not found in PATH")
		}
		containerID, _ := args["containerId"].(string)
		tail := "100"
		if v, ok := args["tail"]; ok {
			tail = fmt.Sprint(v)
		}
		if isFollow(args) {
			return runtime.DockerCommand("logs", "-f", "--tail", tail, containerID), nil
		}
		return runtime.DockerCommand("logs", "--tail", tail, containerID), nil
	case "systemctl_status":
		unit, _ := args["unit"].(string)
		return runtime.SystemctlCommand("status", unit, "--no-pager"), nil
	case "pm2_list":
		if !runtime.PM2Available() {
			return nil, fmt.Errorf("pm2 not found in PATH")
		}
		return runtime.PM2Command("jlist"), nil
	case "pm2_logs":
		if !runtime.PM2Available() {
			return nil, fmt.Errorf("pm2 not found in PATH")
		}
		name, _ := args["appName"].(string)
		tail := "100"
		if v, ok := args["tail"]; ok {
			tail = fmt.Sprint(v)
		}
		if isFollow(args) {
			return runtime.PM2Command("logs", name, "--raw", "--lines", tail), nil
		}
		return runtime.PM2Command("logs", name, "--lines", tail, "--nostream"), nil
	default:
		return nil, fmt.Errorf("unsupported command")
	}
}

func Run(command string, args map[string]interface{}) (Result, error) {
	if isFollow(args) {
		return Result{}, fmt.Errorf("use RunStreaming for follow jobs")
	}

	switch command {
	case "system_discover":
		return runSystemDiscover()
	case "system_logs":
		return runSystemLogs(args)
	}

	cmd, err := buildCmd(command, args)
	if err != nil {
		return Result{}, err
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err = cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return Result{}, err
		}
	}

	return Result{
		ExitCode: exitCode,
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
	}, nil
}

func RunStreaming(jobID, command string, args map[string]interface{}, onChunk func(stream, data string)) (int, error) {
	cmd, err := buildCmd(command, args)
	if err != nil {
		return 1, err
	}

	activeCmds.Store(jobID, cmd)
	defer activeCmds.Delete(jobID)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return 1, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return 1, err
	}

	if err := cmd.Start(); err != nil {
		return 1, err
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		streamPipe(stdout, "stdout", onChunk)
	}()
	go func() {
		defer wg.Done()
		streamPipe(stderr, "stderr", onChunk)
	}()
	wg.Wait()

	err = cmd.Wait()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return 1, err
		}
	}
	return exitCode, nil
}

func streamPipe(r io.Reader, stream string, onChunk func(string, string)) {
	scanner := bufio.NewScanner(r)
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 1024*1024)
	for scanner.Scan() {
		onChunk(stream, scanner.Text()+"\n")
	}
}

func StreamChunks(stream string, data string, chunkSize int) []string {
	if chunkSize <= 0 {
		chunkSize = 4096
	}
	var chunks []string
	for len(data) > 0 {
		n := chunkSize
		if n > len(data) {
			n = len(data)
		}
		chunks = append(chunks, data[:n])
		data = data[n:]
	}
	if len(chunks) == 0 {
		chunks = append(chunks, "")
	}
	_ = stream
	_ = strings.Builder{}
	return chunks
}

func ParseTail(args map[string]interface{}) int {
	if v, ok := args["tail"]; ok {
		switch t := v.(type) {
		case float64:
			return int(t)
		case int:
			return t
		case string:
			n, _ := strconv.Atoi(t)
			return n
		}
	}
	return 100
}
