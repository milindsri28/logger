package runtime

import (
	"os"
	"os/exec"
	"os/user"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

var (
	mu        sync.RWMutex
	homeDir   string
	pm2Home   string
	dockerBin string
	pm2Bin    string
	execEnv   []string
)

// Init discovers docker/pm2 binaries and builds a stable exec environment for systemd.
func Init() {
	mu.Lock()
	defer mu.Unlock()

	homeDir = resolveHome()
	pm2Home = filepath.Join(homeDir, ".pm2")
	dockerBin = findBinary("docker", []string{"/usr/bin/docker", "/usr/local/bin/docker", "/snap/bin/docker"})
	pm2Bin = findPM2()
	execEnv = buildExecEnv()
}

func resolveHome() string {
	if h := os.Getenv("HOME"); h != "" {
		return h
	}
	if u, err := user.Current(); err == nil && u.HomeDir != "" {
		return u.HomeDir
	}
	return "/root"
}

func findBinary(name string, candidates []string) string {
	if p, err := exec.LookPath(name); err == nil && p != "" {
		return p
	}
	for _, c := range candidates {
		if st, err := os.Stat(c); err == nil && !st.IsDir() {
			return c
		}
	}
	return ""
}

func findPM2() string {
	if p := findBinary("pm2", []string{"/usr/bin/pm2", "/usr/local/bin/pm2"}); p != "" {
		return p
	}

	nvmBase := filepath.Join(homeDir, ".nvm", "versions", "node")
	entries, err := os.ReadDir(nvmBase)
	if err != nil {
		return ""
	}

	var versions []string
	for _, e := range entries {
		if e.IsDir() {
			versions = append(versions, e.Name())
		}
	}
	sort.Strings(versions)

	for i := len(versions) - 1; i >= 0; i-- {
		candidate := filepath.Join(nvmBase, versions[i], "bin", "pm2")
		if st, err := os.Stat(candidate); err == nil && !st.IsDir() {
			return candidate
		}
	}
	return ""
}

func buildExecEnv() []string {
	pathDirs := []string{
		"/usr/local/sbin",
		"/usr/local/bin",
		"/usr/sbin",
		"/usr/bin",
		"/sbin",
		"/bin",
		"/snap/bin",
	}

	if dockerBin != "" {
		pathDirs = append([]string{filepath.Dir(dockerBin)}, pathDirs...)
	}
	if pm2Bin != "" {
		pathDirs = append([]string{filepath.Dir(pm2Bin)}, pathDirs...)
	}

	seen := map[string]bool{}
	var pathParts []string
	for _, p := range pathDirs {
		if p == "" || seen[p] {
			continue
		}
		seen[p] = true
		pathParts = append(pathParts, p)
	}

	env := []string{
		"HOME=" + homeDir,
		"PM2_HOME=" + pm2Home,
		"PATH=" + strings.Join(pathParts, ":"),
		"LANG=C.UTF-8",
	}
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "HOME=") || strings.HasPrefix(e, "PM2_HOME=") || strings.HasPrefix(e, "PATH=") {
			continue
		}
		env = append(env, e)
	}
	return env
}

func applyEnv(cmd *exec.Cmd) {
	mu.RLock()
	env := execEnv
	mu.RUnlock()
	if len(env) > 0 {
		cmd.Env = env
	}
}

func DockerPath() string {
	mu.RLock()
	defer mu.RUnlock()
	if dockerBin != "" {
		return dockerBin
	}
	return "docker"
}

func PM2Path() string {
	mu.RLock()
	defer mu.RUnlock()
	if pm2Bin != "" {
		return pm2Bin
	}
	return "pm2"
}

func DockerAvailable() bool {
	mu.RLock()
	defer mu.RUnlock()
	return dockerBin != ""
}

func PM2Available() bool {
	mu.RLock()
	defer mu.RUnlock()
	return pm2Bin != ""
}

func DockerCommand(args ...string) *exec.Cmd {
	cmd := exec.Command(DockerPath(), args...)
	applyEnv(cmd)
	return cmd
}

func PM2Command(args ...string) *exec.Cmd {
	cmd := exec.Command(PM2Path(), args...)
	applyEnv(cmd)
	return cmd
}

func SystemctlCommand(args ...string) *exec.Cmd {
	cmd := exec.Command("systemctl", args...)
	applyEnv(cmd)
	return cmd
}

func ExecEnv() []string {
	mu.RLock()
	defer mu.RUnlock()
	if len(execEnv) > 0 {
		out := make([]string, len(execEnv))
		copy(out, execEnv)
		return out
	}
	return os.Environ()
}
