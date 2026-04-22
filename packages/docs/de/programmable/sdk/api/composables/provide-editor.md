---
title: provideEditor
description: Eine OpenPencil-Editor-Instanz über Injection einem Vue-Teilbaum bereitstellen.
---

# provideEditor

`provideEditor(editor)` macht einen OpenPencil-Editor für nachgelagerte Composables und headless Primitive über Vue-Injection verfügbar.

Dies ist die Grundlage für `useEditor()`.

## Verwendung

```ts
import { provideEditor } from '@open-pencil/vue'

provideEditor(editor)
```

## Einfaches Beispiel

```vue
<script setup lang="ts">
import { provideEditor } from '@open-pencil/vue'

import type { Editor } from '@open-pencil/core/editor'

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

Das aktuelle SDK verwendet `provideEditor()` und `useEditor()` direkt. Einige ältere Beispiele und Fehlermeldungen verweisen noch auf eine `OpenPencilProvider`-Komponente, aber das Injektionsmodell ist die eigentliche API-Oberfläche, die in Dokumentation und App-Code bevorzugt werden sollte.

## Verwandte APIs

- [useEditor](./use-editor)
