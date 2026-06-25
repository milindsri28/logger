package ws

type Type string

const (
	TypePing        Type = "ping"
	TypePong        Type = "pong"
	TypeHeartbeat   Type = "heartbeat"
	TypeJob         Type = "job"
	TypeJobChunk    Type = "job_chunk"
	TypeJobComplete Type = "job_complete"
	TypeJobError    Type = "job_error"
	TypeJobCancel   Type = "job_cancel"
)

type Frame struct {
	Type    Type        `json:"type"`
	ID      string      `json:"id,omitempty"`
	TS      string      `json:"ts,omitempty"`
	Payload interface{} `json:"payload,omitempty"`
}

type JobPayload struct {
	Command string                 `json:"command"`
	Args    map[string]interface{} `json:"args"`
}

type JobChunkPayload struct {
	Stream string `json:"stream"`
	Data   string `json:"data"`
}

type JobCompletePayload struct {
	ExitCode int `json:"exitCode"`
}

type JobErrorPayload struct {
	Message string `json:"message"`
}
