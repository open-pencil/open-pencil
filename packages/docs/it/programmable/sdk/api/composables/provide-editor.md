---
title: provideEditor
description: Fornisce un'istanza dell'editor OpenPencil a un sottoalbero Vue tramite iniezione.
---

# provideEditor

`provideEditor(editor)` rende un editor OpenPencil disponibile ai composable e alle primitive headless discendenti tramite l'iniezione Vue.

È il fondamento di `useEditor()`.

## Utilizzo

```ts
import { provideEditor } from '@open-pencil/vue'

provideEditor(editor)
```

## Esempio base

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

## Note

L'SDK attuale usa `provideEditor()` e `useEditor()` direttamente. Alcuni esempi e messaggi di errore più vecchi fanno ancora riferimento a un componente `OpenPencilProvider`, ma il modello di iniezione è la vera superficie API da preferire nella documentazione e nel codice dell'app.

## API correlate

- [useEditor](./use-editor)
