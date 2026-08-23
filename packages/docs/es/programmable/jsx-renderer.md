---
title: Renderizador JSX
description: Crear diseños desde JSX y exportar selecciones como JSX con Tailwind.
---

# Renderizador JSX

OpenPencil puede convertir JSX declarativo en un árbol de diseño. El mismo sistema está disponible en el chat con AI, MCP y `eval`.

```jsx
<Frame flex="col" gap={16} p={24} w={320} bg="#ffffff" radius={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text color="#667085">Description</Text>
  <Button>Continue</Button>
</Frame>
```

## Elementos

| JSX | Resultado |
|-----|-----------|
| `<Frame>` | Marco, opcionalmente con disposición automática |
| `<Text>` | Objeto de texto |
| `<Rectangle>` | Rectángulo |
| `<Ellipse>` | Elipse |
| `<Image>` | Forma con relleno de imagen |
| Componente registrado | Árbol reutilizable definido por la aplicación |

## Disposición

- `flex="row"` o `flex="col"` activa la disposición automática.
- `gap` establece la separación.
- `p`, `px`, `py`, `pt`, `pr`, `pb` y `pl` establecen el relleno.
- `align` y `justify` controlan la alineación.
- `wrap` permite saltos de línea.

## Tamaño y posición

- `w` y `h` aceptan números, `"fill"` o `"hug"`.
- `minW`, `maxW`, `minH` y `maxH` establecen límites.
- `x` e `y` fijan la posición cuando el objeto no participa en el flujo.

## Apariencia

- `bg` o `fill` define el relleno.
- `color` define el color del texto.
- `stroke`, `strokeWidth`, `opacity` y `radius` controlan contorno, opacidad y esquinas.
- `shadow` añade una sombra.

## Tipografía

`size`, `font`, `weight`, `lineHeight`, `letterSpacing` y `align` configuran el texto. Los nombres de propiedades se mantienen en inglés porque forman parte de la API JSX.

## Eventos y metadatos

Las propiedades desconocidas se conservan cuando el tipo de objeto las admite. Los eventos DOM no se ejecutan: el resultado es un documento de diseño, no una aplicación web.

## Exportar a JSX

El menú **Copiar como → JSX** convierte la selección en JSX y clases Tailwind. La salida intenta conservar jerarquía, disposición, tamaños, colores, tipografía y bordes, y sirve como punto de partida para implementar una interfaz.
