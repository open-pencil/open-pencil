---
title: PageListRoot
description: Primitivo estructural headless para interfaces de lista de páginas.
---

# PageListRoot

`PageListRoot` es un primitivo estructural headless para interfaces de lista de páginas.

Proporciona props de slot para:

- páginas
- id de la página actual
- detección de divisores
- acciones de página como añadir, cambiar, renombrar y eliminar

## Uso

Úsalo cuando quieras la estructura de lista de páginas proporcionada por el SDK con renderizado y estilos propios de la app.

## Ejemplo básico

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage }">
  <ul>
    <li v-for="page in pages" :key="page.id">
      <button
        :data-active="page.id === currentPageId"
        @click="switchPage(page.id)"
      >
        {{ page.name }}
      </button>
    </li>
  </ul>
</PageListRoot>
```

## APIs relacionadas

- [usePageList](../composables/use-page-list)
