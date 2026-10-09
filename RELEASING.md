# Releasing ctm

Releases are cut by pushing a `v*` tag. [`.github/workflows/release.yml`](.github/workflows/release.yml)
then runs [GoReleaser](.goreleaser.yaml), which:

- builds the binaries and archives;
- writes `checksums.txt` and signs it with cosign (keyless, using the
  workflow's OIDC identity);
- generates SBOMs;
- pushes and signs `ghcr.io/clebeer/ctm`;
- creates the GitHub release with a grouped changelog;
- updates the Homebrew cask (optional).

The workflow then attests build provenance for the archives and the image.
Every PR exercises the build in the `Release dry run` CI job.

## One-time setup

1. **Container image.** After the first release, open the `ctm` package on
   GitHub (Packages), make it **public**, and link it to this repository.
2. **Homebrew (optional).**
   - Create the public repository `clebeer/homebrew-tap`.
   - Create a fine-grained token with *Contents: read & write* on that
     repository only.
   - Store the token as the Actions secret `HOMEBREW_TAP_GITHUB_TOKEN` in
     this repository.

   Without the secret, the cask step is skipped.
3. **Tag protection (recommended).** Add a ruleset so only maintainers can
   create `v*` tags. Anyone who can push such a tag can publish a signed
   release.

## Cutting a release

1. Make sure `main` is green and the README/docs match the release.
2. Pick the version. Follow [semver](https://semver.org/): `0.x` minor bumps
   may break the model format or CLI, and must be called out in the notes.
   Pre-releases (`v0.2.0-rc.1`) are marked as such and do not move the
   `latest` image tag.
3. Tag and push:

   ```bash
   git switch main && git pull
   git tag -s v0.1.0 -m "v0.1.0"      # or -a if you do not sign tags
   git push origin v0.1.0
   ```

4. Watch the **Release** workflow. Then check the release page, the image,
   and the verification commands in [docs/install.md](docs/install.md).

## If something goes wrong

- **Before anything is published:** delete the tag locally and on the remote,
  fix the problem, and tag again.
- **After publishing:** do not reuse the version. Delete or mark the broken
  release, and cut the next patch version.
