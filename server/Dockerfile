FROM golang:1.24-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /usr/local/bin/reactor-server ./cmd/reactor-server/

FROM alpine:3.21

RUN adduser -D -u 1000 reactor

COPY --from=build /usr/local/bin/reactor-server /usr/local/bin/reactor-server

# Copy dashboard static export if available (built externally).
# The STATIC_DIR env var tells reactor-server where to find SPA files.
COPY --chown=reactor:reactor dashboard/ /app/dashboard/
ENV STATIC_DIR=/app/dashboard

USER reactor

EXPOSE 8080

ENTRYPOINT ["reactor-server"]
