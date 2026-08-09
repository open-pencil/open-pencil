# Kiwi (`packages/kiwi`)

Pure Kiwi schema/runtime/protocol package. Owns low-level Figma Kiwi codec/container/parse helpers and stays SceneGraph-agnostic.

- `packages/kiwi/src/schema-runtime/` contains the Kiwi codec runtime; keep runtime changes minimal and prefer wrappers/helpers for project-specific validation.
- Use `@open-pencil/kiwi` for low-level Kiwi/FIG schema-runtime, codec, container, GUID, and parse helpers.
