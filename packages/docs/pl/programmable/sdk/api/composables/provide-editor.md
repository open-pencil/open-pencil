---
title: provideEditor
description: Udostępnianie instancji edytora Lawha komponentom potomnym przez dependency injection.
---

# provideEditor

`provideEditor(editor)` udostępnia edytor Lawha funkcjom composable i komponentom bez narzuconych stylów znajdującym się niżej w drzewie Vue.

Na tej funkcji opiera się `useEditor()`.

## Użycie

```ts
import { provideEditor } from '@lawha/vue'

provideEditor(editor)
```

## Przykład

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

## Uwagi

Aktualne SDK używa bezpośrednio `provideEditor()` i `useEditor()`. Niektóre starsze przykłady i komunikaty błędów wspominają komponent `LawhaProvider`, ale nie należy on do obecnego publicznego API.

## Zobacz też

- [useEditor](./use-editor)
