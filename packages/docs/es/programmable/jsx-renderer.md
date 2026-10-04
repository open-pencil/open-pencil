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

## Importar en código

En código de aplicación o de biblioteca sin interfaz, importa `Frame`, `Text` y el resto de exportaciones de autoría desde `@open-pencil/design-jsx` y crea los nodos con `renderTree` o `renderJSX` de `@open-pencil/core/design-jsx`, que añaden iconos, conversión de SVG y disposición. Para escribir los árboles como TSX, define `"jsxImportSource": "@open-pencil/design-jsx"` con `"jsx": "react-jsx"` en `tsconfig.json`, o añade al archivo el comentario `/** @jsxImportSource @open-pencil/design-jsx */`. El entorno de scripting determina qué API se exponen a `eval`; las exportaciones de los paquetes no son globales automáticamente.

## Exportar a JSX

El menú **Copiar como → JSX** convierte la selección en JSX y clases Tailwind. La salida intenta conservar jerarquía, disposición, tamaños, colores, tipografía y bordes, y sirve como punto de partida para implementar una interfaz. El JSX exportado se puede editar y volver a renderizar en el documento. La exportación incluye capas ocultas y bloqueadas, restricciones, límites de tamaño, rellenos apilados, de degradado y de imagen, contornos, efectos, máscaras y enlaces a variables, así que al renderizarla se reproducen y `diff_jsx` muestra los cambios en cualquiera de ellos. Aún no se escriben el texto enriquecido con estilos mixtos, los trazados vectoriales, las cuadrículas de disposición, los estilos compartidos ni las definiciones de propiedades de componentes. Las instancias se escriben como marcos con su contenido, de modo que el JSX exportado se sostiene por sí solo.
