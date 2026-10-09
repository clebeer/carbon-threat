# Installing ctm

Every release publishes the following:

- archives for Linux, macOS and Windows (amd64 and arm64);
- `checksums.txt`, signed with [Sigstore cosign](https://docs.sigstore.dev/) by the release workflow;
- an SPDX SBOM per archive;
- GitHub build-provenance attestations;
- a multi-arch container image, `ghcr.io/clebeer/ctm`.

## Homebrew (macOS, Linux)

```bash
brew install --cask clebeer/tap/ctm
```

## Binary

Download the archive for your platform from the
[releases page](https://github.com/clebeer/carbon-threat/releases), verify it
(see below), extract it, and put `ctm` on your `PATH`.

```bash
VERSION=0.1.0
curl -fsSLO "https://github.com/clebeer/carbon-threat/releases/download/v${VERSION}/ctm_${VERSION}_linux_amd64.tar.gz"
tar -xzf "ctm_${VERSION}_linux_amd64.tar.gz" ctm
sudo install ctm /usr/local/bin/
```

## Container

```bash
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" ghcr.io/clebeer/ctm:0.1.0 analyze
```

The image includes `git`, so `ctm diff --base-ref` works inside it. Running as
your own user lets git trust the mounted repository. The image deliberately
does not disable git's `safe.directory` protection.

## From source

```bash
go install github.com/clebeer/carbon-threat/cmd/ctm@latest   # Go 1.26+
```

## GitHub Actions

Reference a release tag (or its commit SHA) and the action downloads that
release and checks its checksum. Any other ref builds from source.

```yaml
- uses: clebeer/carbon-threat@v0.1.0
  with:
    fail-on: high
```

## Verifying a download

```bash
# 1. GitHub build provenance (needs the gh CLI)
gh attestation verify ctm_0.1.0_linux_amd64.tar.gz --repo clebeer/carbon-threat

# 2. The checksum file was signed by this repository's release workflow
cosign verify-blob checksums.txt \
  --bundle checksums.txt.sigstore.json \
  --certificate-identity-regexp '^https://github.com/clebeer/carbon-threat/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com

# 3. The archive matches the signed checksum
sha256sum --ignore-missing -c checksums.txt     # macOS: shasum -a 256 --ignore-missing -c checksums.txt
```

For the container image:

```bash
gh attestation verify oci://ghcr.io/clebeer/ctm:0.1.0 --repo clebeer/carbon-threat
cosign verify ghcr.io/clebeer/ctm:0.1.0 \
  --certificate-identity-regexp '^https://github.com/clebeer/carbon-threat/.github/workflows/release.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```
