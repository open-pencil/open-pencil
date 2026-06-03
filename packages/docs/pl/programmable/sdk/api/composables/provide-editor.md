---
title: provideEditor
description: Dostarcz instancję edytora Inkly do poddrzewa Vue przez wstrzykiwanie.
---

# provideEditor

`provideEditor(editor)` udostępnia edytor Inkly potomnym kompozytom i bezstanowym prymitywom przez wstrzykiwanie Vue.

To fundament dla `useEditor()`.

## Użycie

```ts
import { provideEditor } from '@inkly/vue'

provideEditor(editor)
```

## Podstawowy przykład

```vue
<script setup lang="ts">
import { provideEditor } from '@inkly/vue'

import type { Editor } from '@inkly/core/editor'

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

Obecny SDK używa bezpośrednio `provideEditor()` i `useEditor()`. Niektóre starsze przykłady i komunikaty błędów nadal odwołują się do komponentu `InklyProvider`, ale model wstrzykiwania jest rzeczywistą powierzchnią API preferowaną w dokumentacji i kodzie aplikacji.

## Powiązane API

- [useEditor](./use-editor)
