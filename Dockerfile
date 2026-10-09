# Release image, built by GoReleaser (dockers_v2) from prebuilt binaries.
# git is included because `ctm diff --base-ref` reads the base revision. Run
# the container with --user "$(id -u):$(id -g)" so git trusts the mounted
# repository; we deliberately do not set safe.directory='*'.
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk add --no-cache git ca-certificates \
 && adduser -D -u 10001 ctm
ARG TARGETPLATFORM
COPY $TARGETPLATFORM/ctm /usr/local/bin/ctm
USER 10001
WORKDIR /work
ENTRYPOINT ["/usr/local/bin/ctm"]
CMD ["--help"]
