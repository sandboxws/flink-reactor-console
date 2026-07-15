FROM golang:1.26-alpine AS build

WORKDIR /src

# Copy module manifests for dependency caching.
COPY go.mod go.sum ./
RUN go mod download

# Copy full source.
COPY . .

# Build the server binary.
RUN CGO_ENABLED=0 go build -o /usr/local/bin/reactor-server ./cmd/reactor-server/

FROM alpine:3.21

RUN adduser -D -u 1000 reactor

COPY --from=build /usr/local/bin/reactor-server /usr/local/bin/reactor-server

# Copy dashboard static export (built by the just docker recipe).
COPY --chown=reactor:reactor dashboard/ /app/dashboard/
ENV STATIC_DIR=/app/dashboard

USER reactor

EXPOSE 8080

ENTRYPOINT ["reactor-server"]
