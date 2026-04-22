---
title: provideEditor
description: Dostarcz instancję edytora OpenPencil do poddrzewa Vue przez wstrzykiwanie.
---

# provideEditor

`provideEditor(editor)` udostępnia edytor OpenPencil potomnym kompozytom i bezstanowym prymitywom przez wstrzykiwanie Vue.

To fundament dla `useEditor()`.

## Użycie

```ts
import { provideEditor } from '@open-pencil/vue'

provideEditor(editor)
```

## Podstawowy przykład

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

## Uwagi

Obecny SDK używa bezpośrednio `provideEditor()` i `useEditor()`. Niektóre starsze przykłady i komunikaty błędów nadal odwołują się do komponentu `OpenPencilProvider`, ale model wstrzykiwania jest rzeczywistą powierzchnią API preferowaną w dokumentacji i kodzie aplikacji.

## Powiązane API

- [useEditor](./use-editor)
