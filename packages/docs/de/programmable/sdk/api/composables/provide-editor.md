---
title: provideEditor
description: Eine Lawha-Editor-Instanz über Vue dependency injection bereitstellen.
---

# provideEditor

`provideEditor(editor)` stellt den Editor für composables und headless components weiter unten im Vue component tree bereit.

`useEditor()` basiert auf diesem Context.

## Verwendung

```ts
import { provideEditor } from '@lawha/vue'

provideEditor(editor)
```

## Beispiel

```vue
<script setup lang="ts">
import { provideEditor } from '@lawha/vue'

import type { Editor } from '@lawha/core'

const props = defineProps<{
  editor: Editor
}>()

provideEditor(props.editor)
</script>

<template>
  <slot />
</template>
```

## Hinweise

Das aktuelle SDK verwendet direkt `provideEditor()` und `useEditor()`. Ältere Beispiele und einzelne Fehlermeldungen erwähnen noch `LawhaProvider`; dieser Component gehört jedoch nicht zum aktuellen öffentlichen API.

## Siehe auch

- [useEditor](./use-editor)
