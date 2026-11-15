---
title: PropertyListRoot
description: Lista controlada para rellenos, contornos, efectos y otras propiedades de tipo matriz.
---

# PropertyListRoot

`PropertyListRoot` coordina propiedades almacenadas como matrices, por ejemplo rellenos, contornos y efectos.

Recibe elementos y estado mixto mediante propiedades, emite cambios y proporciona en la ranura:

- los elementos actuales;
- acciones para añadir, eliminar, sustituir y actualizar parcialmente;
- una acción para cambiar la visibilidad de un elemento.

La conexión con la selección y el historial se realiza mediante `useEditorPropertyList()` o un adaptador de la aplicación.

## Véase también

- [PropertyListItem](./property-list-item)
- [usePropertyList](../advanced/use-property-list)
- [Paneles de propiedades](../../guides/property-panels)
