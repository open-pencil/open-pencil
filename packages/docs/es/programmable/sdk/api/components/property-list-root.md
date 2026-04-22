---
title: PropertyListRoot
description: Primitivo estructural headless para interfaces de lista de rellenos, trazos y efectos.
---

# PropertyListRoot

`PropertyListRoot` es un primitivo estructural headless para editores de propiedades basados en arrays.

Está pensado para interfaces de propiedades como:

- rellenos
- trazos
- efectos

Proporciona props de slot para:

- elementos actuales
- detección de estado mixto
- operaciones de añadir/eliminar/actualizar/parchear
- alternar la visibilidad por elemento

## Uso

```vue
<PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
  <div v-for="(fill, index) in items" :key="index">
    <button @click="remove(index)">Eliminar</button>
  </div>
  <button @click="add(defaultFill)">Añadir relleno</button>
</PropertyListRoot>
```

## APIs relacionadas

- [Resumen de la API del SDK](../)
