package heartbeat

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/argusops/agent/internal/config"
	"github.com/argusops/agent/internal/metrics"
)

func Start(cfg *config.Config, interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			snap := metrics.Collect()
			SendREST(cfg, snap)
		}
	}()
}

func SendREST(cfg *config.Config, snap metrics.Snapshot) {
	body, _ := json.Marshal(snap)
	req, err := http.NewRequest(http.MethodPost, config.HeartbeatURL(), bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AgentJWT)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusUnauthorized {
		log.Printf("heartbeat rejected (401): agent no longer registered — re-run with --token <registration-token>")
	}
}

func Snapshot() metrics.Snapshot {
	return metrics.Collect()
}
