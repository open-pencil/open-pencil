# Release packages and native artifacts

`src/workflow.ts` owns npm release policy and reuses package-artifacts/package-quality mechanics. `src/native/` owns desktop release orchestration. Cross-directory imports within this package use `#release/*`; sibling modules remain relative.

## Canonical release workflow

`.github/workflows/build.yml` runs on a new stable tag, or through `workflow_dispatch` with an existing `vX.Y.Z` tag. A dispatch uses the selected workflow revision but builds the immutable application commit resolved from that tag. The source must be an ancestor of `origin/master`.

1. **Plan:** resolve the source commit and generate the native matrix from `native/catalog.ts`.
2. **Frontend:** build packages and the desktop frontend once; prepare and pack npm archives without rebuilding. Archive `dist`, desktop icons, and generated menus together and record its SHA-256.
3. **Native:** five independent jobs check out that same source, verify and extract the shared inputs, then build through Node's Tauri CLI launcher. A generated config sets only `build.beforeBuildCommand` to `null`; the checked-in local build hook is unchanged. No native job uploads release assets.
4. **Publish:** require the complete matrix with identical source/workflow/run/attempt/frontend identity. Verify file inventories, hashes, every updater signature, and exact source changelog notes. Generate the updater JSON, source/workflow manifest, and checksums; attest and verify the complete output set. Verify npm consumers and publish the original tarballs with npm provenance. Replace every expected draft asset, then download and verify all uploaded bytes.

Workflow tooling is checked out separately in `.pipeline` and installed from its own frozen lockfile where it runs. Application dependency installation and builds remain owned by the tagged checkout; rebuilding an older tag must not accidentally execute its older release orchestration. Dependency installation is not frontend/package compilation.

The workflow leaves the GitHub Release **draft**. After successful verification, publish it with the exact tagged changelog body and publish any accompanying security advisory separately. Never move a release tag to repair CI.

## Artifact policy and provenance

`native/catalog.ts` is OpenPencil's required asset/naming policy, not a replacement for Tauri artifact discovery. Collection consumes `tauri-action`'s `artifactPaths` output and refuses missing, duplicate, unexpected, empty, or escaping files. The macOS `.app` directory is ignored in favor of its required signed archive. Stable architecture-qualified macOS archive names are preserved.

GitHub's default provenance identifies the **workflow execution revision**, which can differ from the tagged application source in a manual rebuild. The independently attested `release-manifest.json` records both commits, the workflow run/attempt, shared frontend digest, target file digests, and npm tarball digests. Do not describe the default workflow provenance alone as proof of the application's checked-out source. npm also emits its own provenance from the same workflow execution; the signed manifest binds its exact tarballs to the application source.

Verify downloaded release files with:

```sh
gh attestation verify release-manifest.json --repo open-pencil/open-pencil \
  --signer-workflow open-pencil/open-pencil/.github/workflows/build.yml \
  --deny-self-hosted-runners
sha256sum --check SHA256SUMS
```

Each release asset, including `SHA256SUMS`, also has its own attestation. For a pinned audit, pass the independently obtained workflow commit to `--signer-digest`; compare the attested manifest's source commit with the immutable tag. Do not treat an unverified manifest as trusted configuration.

## Homebrew distribution

The macOS app is distributed through the [official `openpencil` cask](https://formulae.brew.sh/cask/openpencil): `brew install --cask openpencil`. This installs the desktop app, not the separately published npm CLI.

Homebrew's BrewTestBot automatically proposes version bumps for this cask (its tooling currently reports a roughly three-hour cadence). Homebrew owns review and merge timing; publishing our GitHub release does not immediately update the cask. Do not add parallel bump-PR automation or push to the archived `open-pencil/homebrew-tap` repository.

After each release:

1. Check the official cask version and search `Homebrew/homebrew-cask` for an existing `openpencil` bump PR.
2. Check that both architecture hashes match the attested release manifest. Follow the bot's PR through upstream review; do not report the cask as updated until it merges.
3. If an update is delayed or fails, investigate the upstream bot/PR and follow Homebrew's current contribution policy rather than bypassing autobump restrictions. Direct GitHub downloads and the app updater remain available in the meantime.

The old `HOMEBREW_TAP_TOKEN` workflow secret is no longer used and can be removed after the obsolete workflow is retired. Revoking the underlying token is a separate credential-owner action if it is shared elsewhere.

## Failure and recovery

- There are explicit job/build/startup/command deadlines. Native builds do not silently retry or upload partial release outputs.
- Missing or mixed matrix identities stop publication. Rerun **all jobs**, not only failed jobs, to obtain a single new run-attempt identity.
- Existing published GitHub releases, moved tags, unexpected draft assets, or already-published npm versions stop preflight. Already-published npm versions require an explicit provenance/recovery review; they are never silently mixed with this run.
- npm publication and GitHub multi-asset uploads are not atomic. A mid-publication failure requires review; the draft is not automatically published or deleted. A failed upload can leave a partial draft, not a successful canonical release.
- Caches improve repeat installs/builds but do not establish provenance. Their scope and writer limits are documented in `.github/actions/setup-bun/README.md`.
