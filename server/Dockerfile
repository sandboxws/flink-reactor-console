FROM golang:1.24-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /usr/local/bin/reactor-server ./cmd/reactor-server/

FROM alpine:3.21

RUN adduser -D -u 1000 reactor
USER reactor

COPY --from=build /usr/local/bin/reactor-server /usr/local/bin/reactor-server

EXPOSE 8080

ENTRYPOINT ["reactor-server"]
