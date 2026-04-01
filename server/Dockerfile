FROM golang:1.26-alpine AS build

WORKDIR /src

# Copy module manifests for dependency caching.
# The server module is the main build context; instruments comes from a named
# build context (--build-context instruments=<path>).
COPY go.mod go.sum ./server/
COPY --from=instruments go.mod go.sum ./instruments/

# Create a workspace file matching the Docker filesystem layout.
# The repo go.work uses ../flink-reactor-instruments/server — this adapts
# those paths for the flat /src/{server,instruments} layout inside the image.
RUN printf 'go 1.26.0\n\nuse ./server\nuse ./instruments\n' > go.work

# Download external dependencies (layer is cached unless go.mod/go.sum change).
WORKDIR /src/server
RUN go mod download
WORKDIR /src/instruments
RUN go mod download

# Copy full source for both modules.
WORKDIR /src
COPY . ./server/
COPY --from=instruments . ./instruments/

# Build the server binary.
WORKDIR /src/server
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
