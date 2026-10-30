# Image for apps/settlement. Build context is the repo root.
FROM golang:1.24 AS build
WORKDIR /src
COPY apps/settlement/go.mod apps/settlement/go.sum ./
RUN go mod download
COPY apps/settlement ./
# time/tzdata is imported by the binary, so no OS tzdata is needed in the final image.
RUN CGO_ENABLED=0 go build -o /out/settlement ./cmd/settlement

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /out/settlement ./settlement
EXPOSE 8091
# SETTLEMENT_INTERNAL_TOKEN is REQUIRED for `daemon` (it exits at boot without it); there is no dev default.
CMD ["./settlement", "daemon"]
