package register

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime"
	"strings"

	"github.com/argusops/agent/internal/config"
)

type registerRequest struct {
	Token    string `json:"token"`
	Hostname string `json:"hostname"`
	OS       string `json:"os"`
}

type registerResponse struct {
	AgentID string `json:"agentId"`
	JWT     string `json:"jwt"`
	WSURL   string `json:"wsUrl"`
}

func hostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return h
}

func Register(token string) (*config.Config, error) {
	body, _ := json.Marshal(registerRequest{
		Token:    token,
		Hostname: hostname(),
		OS:       runtime.GOOS,
	})

	req, err := http.NewRequest(http.MethodPost, config.RegisterURL(), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

  if res.StatusCode >= 300 {
    body, _ := io.ReadAll(res.Body)
    msg := strings.TrimSpace(string(body))
    if msg == "" {
      return nil, fmt.Errorf("registration failed with status %d", res.StatusCode)
    }
    return nil, fmt.Errorf("registration failed with status %d: %s", res.StatusCode, msg)
  }

	var out registerResponse
	if err := json.NewDecoder(res.Body).Decode(&out); err != nil {
		return nil, err
	}

	cfg := &config.Config{
		APIURL:   config.BackendURLFromEnv(),
		WSURL:    out.WSURL,
		AgentID:  out.AgentID,
		AgentJWT: out.JWT,
	}
	if err := config.Save(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}
