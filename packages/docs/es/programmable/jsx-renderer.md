---
title: Renderizador JSX
description: Crea diseños con JSX — la sintaxis que los LLMs ya conocen de millones de componentes React.
---

# Renderizador JSX

OpenPencil usa JSX como su lenguaje de creación de diseños. Los LLMs han visto millones de componentes React — describir un layout como `<Frame><Text>` es natural, sin necesidad de entrenamiento especial. Cada token importa cuando un agente de IA realiza docenas de operaciones, y JSX es la representación declarativa más compacta.

JSX también es diferenciable. Cuando una IA modifica un diseño, el cambio es un diff de JSX — legible, revisable, versionable.

## Crear Diseños

La herramienta `render` (disponible en el chat con IA, MCP y CLI eval) acepta JSX:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

En el servidor MCP y el chat con IA, la herramienta `render` acepta cadenas JSX directamente. En el CLI, usa el comando `export` para ir en la dirección opuesta — [exportar diseños como JSX](./cli/exporting).

## Elementos

Todos los tipos de nodos están disponibles como elementos JSX:

| Elemento | Crea | Alias |
|----------|------|-------|
| `<Frame>` | Frame (contenedor, soporta auto-layout) | `<View>` |
| `<Rectangle>` | Rectángulo | `<Rect>` |
| `<Ellipse>` | Elipse / círculo | |
| `<Text>` | Nodo de texto (los hijos se convierten en contenido de texto) | |
| `<Line>` | Línea | |
| `<Star>` | Estrella | |
| `<Polygon>` | Polígono | |
| `<Vector>` | Trazado vectorial | |
| `<Group>` | Grupo | |
| `<Section>` | Sección | |

## Props de Estilo

Props abreviados compactos inspirados en la nomenclatura de Tailwind.

### Layout

| Prop | Descripción |
|------|-------------|
| `flex` | `"row"` o `"col"` — activa auto-layout |
| `gap` | Espacio entre hijos |
| `wrap` | Ajustar hijos a la siguiente línea |
| `rowGap` | Espaciado en el eje transversal al ajustar |
| `justify` | `"start"`, `"end"`, `"center"`, `"between"` |
| `items` | `"start"`, `"end"`, `"center"`, `"stretch"` |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | Padding |

### Tamaño y Posición

| Prop | Descripción |
|------|-------------|
| `w`, `h` | Ancho/alto — número, `"fill"` o `"hug"` |
| `minW`, `maxW`, `minH`, `maxH` | Restricciones de tamaño |
| `x`, `y` | Posición |

### Apariencia

| Prop | Descripción |
|------|-------------|
| `bg` | Relleno de fondo (color hexadecimal) |
| `fill` | Alias de `bg` |
| `stroke` | Color de borde |
| `strokeWidth` | Ancho del borde (predeterminado: 1) |
| `rounded` | Radio de esquina (o `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`) |
| `cornerSmoothing` | Esquinas suaves estilo iOS (0–1) |
| `opacity` | 0–1 |
| `shadow` | Sombra proyectada (ej. `"0 4 8 #00000040"`) |
| `blur` | Radio de desenfoque de capa |
| `rotate` | Rotación en grados |
| `blendMode` | Modo de fusión |
| `overflow` | `"hidden"` o `"visible"` |

### Tipografía

| Prop | Descripción |
|------|-------------|
| `size` / `fontSize` | Tamaño de fuente |
| `font` / `fontFamily` | Familia tipográfica |
| `weight` / `fontWeight` | `"bold"`, `"medium"`, `"normal"` o número |
| `color` | Color del texto |
| `textAlign` | `"left"`, `"center"`, `"right"`, `"justified"` |

## Exportar a JSX

Convierte diseños existentes de vuelta a JSX:

```sh
open-pencil export design.fig -f jsx                   # formato OpenPencil
open-pencil export design.fig -f jsx --style tailwind  # clases Tailwind
```

El viaje de ida y vuelta funciona: exporta un diseño como JSX, modifica el código, renderízalo de nuevo.

## Diferencias Visuales

Como los diseños son representables como JSX, los cambios se convierten en diffs de código:

```diff
 <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF">
-  <Text size={18} weight="bold">Old Title</Text>
+  <Text size={24} weight="bold" color="#1D1B20">New Title</Text>
   <Text size={14} color="#666">Description</Text>
 </Frame>
```

Esto hace que los cambios de diseño sean revisables en pull requests, rastreables en control de versiones y auditables en CI.
