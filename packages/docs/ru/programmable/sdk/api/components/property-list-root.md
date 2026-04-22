---
title: PropertyListRoot
description: Headless-структурный примитив для UI списков заливок, обводок и эффектов.
---

# PropertyListRoot

`PropertyListRoot` — headless-структурный примитив для редакторов свойств на основе массивов.

Предназначен для UI свойств:

- заливок
- обводок
- эффектов

Предоставляет пропы слота для:

- текущих элементов
- определения смешанного состояния
- операций добавления/удаления/обновления/патча
- переключения видимости каждого элемента

## Использование

```vue
<PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
  <div v-for="(fill, index) in items" :key="index">
    <button @click="remove(index)">Удалить</button>
  </div>
  <button @click="add(defaultFill)">Добавить заливку</button>
</PropertyListRoot>
```

## Связанные API

- [Обзор SDK API](../)
