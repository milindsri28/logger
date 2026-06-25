package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/argusops/agent/internal/config"
	"github.com/argusops/agent/internal/executor"
	"github.com/argusops/agent/internal/heartbeat"
	"github.com/argusops/agent/internal/metrics"
)

var dialer = websocket.Dialer{
	HandshakeTimeout: 15 * time.Second,
}

func Run(cfg *config.Config) {
	backoff := time.Second
	for {
		if err := connectLoop(cfg); err != nil {
			log.Printf("websocket disconnected: %v", err)
		}
		time.Sleep(backoff)
		if backoff < 60*time.Second {
			backoff *= 2
		}
	}
}

func connectLoop(cfg *config.Config) error {
	header := http.Header{}
	header.Set("Authorization", "Bearer "+cfg.AgentJWT)

	conn, _, err := dialer.Dial(cfg.WSURL, header)
	if err != nil {
		return err
	}
	defer conn.Close()

	log.Printf("connected to %s", cfg.WSURL)

	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			handleMessage(conn, msg)
		}
	}()

	for {
		select {
		case <-done:
			return nil
		case <-heartbeatTicker.C:
			sendHeartbeat(conn)
		}
	}
}

func handleMessage(conn *websocket.Conn, raw []byte) {
	var frame Frame
	if err := json.Unmarshal(raw, &frame); err != nil {
		return
	}

	switch frame.Type {
	case TypePing:
		_ = conn.WriteJSON(Frame{Type: TypePong, TS: time.Now().UTC().Format(time.RFC3339)})
	case TypeJob:
		go runJob(conn, frame)
	case TypeJobCancel:
		if frame.ID != "" {
			executor.Cancel(frame.ID)
		}
	}
}

func runJob(conn *websocket.Conn, frame Frame) {
	payloadBytes, _ := json.Marshal(frame.Payload)
	var job JobPayload
	if err := json.Unmarshal(payloadBytes, &job); err != nil {
		sendJobError(conn, frame.ID, err.Error())
		return
	}

	follow := false
	if job.Command == "docker_logs" || job.Command == "pm2_logs" {
		if v, ok := job.Args["follow"].(bool); ok {
			follow = v
		}
	}

	if follow {
		runJobStreaming(conn, frame, job)
		return
	}

	result, err := executor.Run(job.Command, job.Args)
	if err != nil {
		sendJobError(conn, frame.ID, err.Error())
		return
	}

	for _, chunk := range executor.StreamChunks("stdout", result.Stdout, 4096) {
		_ = conn.WriteJSON(Frame{
			Type:    TypeJobChunk,
			ID:      frame.ID,
			Payload: JobChunkPayload{Stream: "stdout", Data: chunk},
		})
	}
	for _, chunk := range executor.StreamChunks("stderr", result.Stderr, 4096) {
		_ = conn.WriteJSON(Frame{
			Type:    TypeJobChunk,
			ID:      frame.ID,
			Payload: JobChunkPayload{Stream: "stderr", Data: chunk},
		})
	}

	_ = conn.WriteJSON(Frame{
		Type:    TypeJobComplete,
		ID:      frame.ID,
		Payload: JobCompletePayload{ExitCode: result.ExitCode},
	})
}

func runJobStreaming(conn *websocket.Conn, frame Frame, job JobPayload) {
	onChunk := func(stream, data string) {
		_ = conn.WriteJSON(Frame{
			Type:    TypeJobChunk,
			ID:      frame.ID,
			Payload: JobChunkPayload{Stream: stream, Data: data},
		})
	}

	exitCode, err := executor.RunStreaming(frame.ID, job.Command, job.Args, onChunk)
	if err != nil {
		sendJobError(conn, frame.ID, err.Error())
		return
	}

	_ = conn.WriteJSON(Frame{
		Type:    TypeJobComplete,
		ID:      frame.ID,
		Payload: JobCompletePayload{ExitCode: exitCode},
	})
}

func sendJobError(conn *websocket.Conn, id string, message string) {
	_ = conn.WriteJSON(Frame{
		Type:    TypeJobError,
		ID:      id,
		Payload: JobErrorPayload{Message: message},
	})
}

func sendHeartbeat(conn *websocket.Conn) {
	snap := metrics.Collect()
	_ = conn.WriteJSON(Frame{
		Type:    TypeHeartbeat,
		TS:      time.Now().UTC().Format(time.RFC3339),
		Payload: snap,
	})
}

// Send initial heartbeat via REST as fallback
func SendInitialHeartbeat(cfg *config.Config) {
	heartbeat.SendREST(cfg, metrics.Collect())
}
