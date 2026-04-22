---
title: Arquitectura del SDK
description: Estructura de carpetas, límites de API pública y patrones de composición en @open-pencil/vue.
---

# Arquitectura del SDK

`@open-pencil/vue` es la capa orientada a Vue sobre `@open-pencil/core`.

No posee el modelo del editor en sí. Adapta el editor central en:

- inyección de Vue
- composables reactivos
- primitivos estructurales headless
- cableado de canvas e inputs

## Estructura de carpetas

Este paquete está organizado por dominio.

### Familias de componentes

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `ScrubInput/`
- `Toolbar/`

Contienen primitivos estructurales/headless y helpers locales.

### Controles

`controls/` contiene composables de controles de paneles de propiedades y del editor:

- `usePosition`
- `useLayout`
- `useAppearance`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`

### Variables

`VariablesEditor/` contiene composables del dominio de variables y el cableado de estado.

### Selección

`selection/` contiene el estado del editor derivado de la selección y sus capacidades.

### Contexto

`context/` contiene helpers de inyección del editor:

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Interno

`internal/` contiene utilidades transversales que no están pensadas como primitivos headless principales.

## Filosofía de la API pública

### Preferir composables

Si el problema es principalmente lógica de control, derivación de estado o acciones del editor, expón un composable.

### Reservar los primitivos headless para estructura significativa

Usa raíces de componentes cuando coordinan estructura, hijos, slots o contexto.

Ejemplos:

- `PageListRoot`
- `PropertyListRoot`
- `ToolbarRoot`

### Evitar slots que vuelquen contexto de forma masiva

Prefiere props de slot enfocados o uso directo de composables en lugar de grandes payloads `v-slot="ctx"`.

## Responsabilidad de la app vs el SDK

### El SDK es responsable de

- integración con el editor
- lógica headless reutilizable
- estructura de UI reutilizable sin suposiciones de estilo
- integración del renderizado del canvas

### La app es responsable de

- estilos
- shells de layout
- enrutamiento
- flujos de archivos del producto
- toasts, menús y UX específica de la app

## Regla práctica

Si una pieza de lógica podría reutilizarse en una app diferente basada en OpenPencil sin llevar consigo los estilos de la app, probablemente pertenece a `@open-pencil/vue`.

## Páginas relacionadas

- [Primeros pasos con el SDK](./getting-started)
- [Referencia de API](./api/)
