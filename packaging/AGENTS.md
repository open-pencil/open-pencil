# Packaging

Store and package-manager definitions for the desktop app, one folder per channel. Each repackages a release artifact that `.github/workflows/build.yml` builds; code that fills in versions or publishes a channel lives in `tools/release/release-packages/src/<channel>/`, beside `native/`.

- Store text, links, and categories come from the AppStream metainfo in `desktop/linux/net.dannote.open-pencil.metainfo.xml`, which the `.deb`, `.rpm`, and AppImage install; a channel reads it from the artifact rather than repeating it (`packaging/snap/snapcraft.yaml`, `parse-info`).
- A channel takes its version from the artifact it repackages, never from a second manifest, so a release cannot ship mismatched versions (`dpkg-deb -f` in `packaging/snap/snapcraft.yaml`).
- Sandboxed channels switch features off with `OPENPENCIL_SELF_UPDATE=0` and `OPENPENCIL_HOST_PROCESSES=0` (`desktop/AGENTS.md`), and a channel whose store delivers updates sets `OPENPENCIL_SELF_UPDATE=0`.
- `snap/` packs the release `.deb` for its architecture, copied into the folder as `openpencil.deb`, with `snapcraft pack` run there; `password-manager-service` and `removable-media` need the Snap Store's auto-connection, without which saving credentials fails visibly (`packaging/snap/snapcraft.yaml`).
- Channels maintained elsewhere, such as Homebrew's `openpencil` cask, get no folder here (`tools/AGENTS.md`, Releases).
