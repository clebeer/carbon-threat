VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)

.PHONY: build test lint rules tidy

build:
	go build -ldflags "-X main.version=$(VERSION)" -o bin/ctm ./cmd/ctm

test:
	go test -race -count=1 ./...

lint:
	golangci-lint run ./...

rules: build
	./bin/ctm rules test

tidy:
	go mod tidy
