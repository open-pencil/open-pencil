# Release packages and native artifacts

`src/workflow.ts` owns npm release policy and reuses package-artifacts/package-quality mechanics. `src/native/` owns desktop release orchestration. Cross-directory imports within this package use `#release/*`; sibling modules remain relative.

## Canonical release workflow

`.github/workflows/build.yml` runs on a new release tag, or through `workflow_dispatch` with an existing one. Release tags are stable `vX.Y.Z` or beta pre-releases `vX.Y.Z-beta.N` (`src/version.ts`). A dispatch uses the selected workflow revision but builds the immutable application commit resolved from that tag. The source must be an ancestor of `origin/master`.

1. **Plan:** resolve the source commit and generate the native matrix from `native/catalog.ts`.
2. **Frontend:** build packages and the desktop frontend once; prepare and pack npm archives without rebuilding. Archive `dist`, desktop icons, and generated menus together and record its SHA-256.
3. **Native:** five independent jobs check out that same source, verify and extract the shared inputs, then build through Node's Tauri CLI launcher. A generated config sets `build.beforeBuildCommand` to `null` and, for a beta, the numeric MSI version `X.Y.Z.N`; the checked-in local build hook is unchanged. No native job uploads release assets.
4. **Publish:** require the complete matrix with identical source/workflow/run/attempt/frontend identity. Verify file inventories, hashes, every updater signature and the release version it records (the desktop updater sets `requireSignedVersion`), and exact source changelog notes. Generate the updater JSON, source/workflow manifest, and checksums; attest and verify the complete output set. Verify npm consumers and publish the original tarballs with npm provenance. Replace every expected draft asset, then download and verify all uploaded bytes.

Workflow tooling is checked out separately in `.pipeline` and installed from its own frozen lockfile where it runs. Application dependency installation and builds remain owned by the tagged checkout; rebuilding an older tag must not accidentally execute its older release orchestration. Dependency installation is not frontend/package compilation.

## Pre-releases

A `vX.Y.Z-beta.N` tag runs the same workflow. npm packages publish under the `next` dist-tag, so `latest` stays on the last stable release, and the draft is marked pre-release and never latest. The desktop updater and download links follow GitHub's latest release, and the Homebrew cask only matches stable tags, so neither picks up a beta. The app and docs deploy workflows skip pre-release tags. The changelog section is headed `## X.Y.Z-beta.N — YYYY-MM-DD` like any release.

## Nightlies

Every night `build.yml` builds master as a nightly, and a dispatch with **nightly** builds one at once; a night when master is the commit the last complete nightly built, which its release manifest names, builds nothing (`src/nightly/plan.ts`). The version is `X.Y.Z-nightly.YYYYMMDD`, `.N` for a day's second build on, where `X.Y.Z` is the release master heads for: its version while a beta, else the next minor. SemVer puts it after that release's betas and before the release. Master keeps its version; the frontend and native jobs write the nightly's into the checkout's root manifest and Tauri config (`src/nightly/stamp.ts`).

A nightly builds, signs, notarizes, verifies, and attests exactly as a release does, with three differences. It publishes no npm packages. Windows bundles NSIS only, which also answers the platform's own updater key, since an MSI version must be numbers only (`NIGHTLY_BUNDLES`). Its notes name the commit it builds (`src/nightly/notes.ts`). It goes to one rolling pre-release, published at once, whose `nightly` tag moves to each nightly's commit and whose files this run's replace, the updater feed after them and the release manifest last, once every byte is checked, so a nightly that fails partway is built again the next night (`src/nightly/publish.ts`). Desktop apps on the Nightly update channel read that release's `latest.json` (`desktop/src/updates.rs`); the download page leaves it out. A release that the workflow token publishes starts no other workflow, so a nightly deploys neither the docs nor a Cloud image.

## Draft publication

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

## New npm packages

`build.yml` publishes to npm only through trusted publishing, which a package that has never been published cannot have yet. Shortly before the tag build, a maintainer creates each new package by hand, with npm 11.15.0 or later and Node.js 22.14.0 or later, which `npm stage` needs:

1. On `master`, before the release changes the version, run `bun run build:packages`, then, with [`cargo-about`](https://github.com/EmbarkStudios/cargo-about) installed at the version `build.yml` pins, `bun tools/release/release-packages/src/cli.ts notices`, `prepare`, and `pack`. The tarballs land in `.npm-packages/` and carry `master`'s version, which is never the one being released.
2. Stage the package with `npm stage publish ./<tarball> --access public`, adding `--tag <name>` when that version is a pre-release, such as `--tag beta`. The registry creates the package with a `0.0.0-stage` placeholder; wait until `npm stage list <package>` shows the stage as `staged`.
3. Add `open-pencil/open-pencil`'s `.github/workflows/build.yml` as the package's trusted publisher and turn on **Allow npm publish**: a new trusted publisher may only stage, and `build.yml` publishes directly. A trusted publisher that has not published within two days expires and has to be deleted and created again, so add it no earlier than two days before the tag build.
4. Approve the stage with `npm stage approve <id>`, or reject it with `npm stage reject <id>`; both need 2FA. A stage left pending holds its version, and a publish of that version fails with `409 Cannot publish over previously staged version`.

Never publish the version being released by hand: `release-packages resume` stops on a published version without `build.yml` provenance.

## Failure and recovery

- There are explicit job/build/startup/command deadlines. Native builds do not silently retry or upload partial release outputs.
- Missing or mixed matrix identities stop publication. Rerun **all jobs**, not only failed jobs, to obtain a single new run-attempt identity.
- Existing published GitHub releases, moved tags, or unexpected draft assets stop preflight.
- A run that stopped partway through npm publication resumes through a `workflow_dispatch` of `build.yml` for the same tag; a rerun of the stopped run uses the tag's own tooling. `release-packages resume` keeps an already-published version whose registry tarball is byte for byte the one the run built, whoever published it; a manual run signs its provenance from the default branch, so this is how a recovery that published some versions before stopping resumes. Any other published version is accepted only when its npm provenance is signed by this repository's `build.yml` at the tag (Sigstore certificate identity and transparency log) and names this repository, `.github/workflows/build.yml`, the tag's ref and commit, and the tarball the registry serves; it then replaces the rebuilt tarball with the registry's bytes. Either way the manifest attests what npm serves and `publish` skips it; any other published version stops the run (`src/resume.ts`).
- npm publication and GitHub multi-asset uploads are not atomic. A mid-publication failure requires review; the draft is not automatically published or deleted. A failed upload can leave a partial draft, not a successful canonical release.
- Caches improve repeat installs/builds but do not establish provenance. Their scope and writer limits are documented in `.github/actions/setup/workspace/README.md`.
