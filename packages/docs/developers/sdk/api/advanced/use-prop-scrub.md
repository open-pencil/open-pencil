---
title: usePropScrub
description: Low-level helper for drag-to-scrub property updates with commit support.
---

# usePropScrub

`usePropScrub(editor)` coordinates live property updates during scrubbing and commits undo-aware changes when the interaction finishes.

Use it when building numeric controls that scrub selected node properties directly.

## Related APIs

- [NumberField](../components/number-field)
- [useNodeProps](./use-node-props)
