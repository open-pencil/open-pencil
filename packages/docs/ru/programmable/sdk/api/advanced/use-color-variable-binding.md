---
title: useColorVariableBinding
description: Привязка цветовых переменных к заливкам и обводкам.
---

# useColorVariableBinding

`useColorVariableBinding(kind)` предоставляет функции поиска, установки и удаления привязки цветовых переменных в заливках или обводках.

Используйте composable в элементах управления цветом с поддержкой переменных дизайна.

```ts
const fillBinding = useColorVariableBinding('fills')
const strokeBinding = useColorVariableBinding('strokes')
```

## См. также

- [useFillControls](../composables/use-fill-controls)
- [useStrokeControls](../composables/use-stroke-controls)
- [FillRoot](/programmable/sdk/api/components/fill-root)
