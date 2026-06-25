.PHONY: build tidy

BINARY=dist/argusops-agent

build:
	mkdir -p dist
	GOOS=linux GOARCH=amd64 go build -o $(BINARY) ./cmd/argusops-agent

tidy:
	go mod tidy

run-local:
	go run ./cmd/argusops-agent
