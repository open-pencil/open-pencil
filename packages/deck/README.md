# `@open-pencil/deck`

Figma Slides (`.deck`) archive parse, slide↔page restructure, and write for OpenPencil.

- **Open**: ZIP → normalize `fig-deck` prelude → Kiwi decode → restructure each active `SLIDE` into a `CANVAS` page
- **Save**: multi-page design NodeChanges → slide scaffolding → `fig-deck` container → ZIP with thumbnail

SceneGraph import/export orchestration stays in `@open-pencil/core`.
