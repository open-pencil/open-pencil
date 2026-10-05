---
title: Variables
description: Crear variables, colecciones y modos, y vincularlas a propiedades de diseño.
---

# Variables

Las variables almacenan tokens de diseño reutilizables, como colores, espaciados y otras propiedades, que se pueden vincular a objetos. Si cambias el valor de una variable, se actualizan todos los objetos que la usan.

## Abrir el diálogo de variables

Sin objetos seleccionados, la pestaña **Diseño** muestra las propiedades de la página, incluida una sección Variables con el número de colecciones y variables. El icono de ajustes abre el diálogo.

El diálogo muestra a la izquierda las variables de la colección activa, edita a la derecha la variable seleccionada o la colección, y muestra debajo la hoja de estilos que producen. En una ventana estrecha o en un teléfono muestra un modo a la vez, y una variable, los ajustes de la colección o la hoja de estilos se abren sobre la lista con un botón para volver.

## Colecciones

Las variables se organizan en colecciones, que aparecen como pestañas (un menú en pantallas estrechas).

- **Cambiar de colección:** haz clic en una pestaña
- **Crear una colección:** haz clic en el botón de carpeta de la barra de herramientas (**Crear colección**)
- **Renombrar o eliminar:** sin ninguna variable seleccionada, la parte derecha edita la colección: cambia su nombre o elimínala desde el menú **⋯** junto al nombre (**Eliminar colección**)

## Modos

Cada colección puede tener varios modos (por ejemplo, Claro y Oscuro). Los modos aparecen como columnas de valores en la lista, y una variable tiene un valor para cada modo. Se gestionan en los **Ajustes de la colección**:

- **Añadir un modo:** haz clic en **+** junto a **Modos**
- **Renombrar:** edita el nombre del modo
- **Duplicar, establecer como predeterminado, eliminar:** usa el menú **⋯** junto al modo (**Duplicar modo**, **Establecer como predeterminado**, **Eliminar modo**)

El modo predeterminado es **Siempre activo** y va en `:root`. Todos los demás modos tienen **Se aplica cuando**, que indica cuándo el modo toma el control en la hoja de estilos exportada; el CSS que escribe se muestra debajo:

| Se aplica cuando | CSS |
| --- | --- |
| **se cambia manualmente** | un atributo con el nombre de la colección y del modo, como `[data-theme="dark"]` para el modo Oscuro de una colección Theme |
| **el sistema está en modo oscuro** / **el sistema está en modo claro** | `@media (prefers-color-scheme: dark)` / `light` |
| **el contraste alto está activado** | `@media (prefers-contrast: more)` |
| **la reducción de movimiento está activada** | `@media (prefers-reduced-motion: reduce)` |
| **la pantalla es más estrecha que** / **la pantalla es más ancha que** un ancho | `@media (max-width: 640px)` / `min-width` |
| **el contenedor es más estrecho que** / **el contenedor es más ancho que** un ancho | `@container (max-width: 640px)` / `min-width` |
| **CSS personalizado** | cualquier selector, o una consulta `@media`, `@supports` o `@container` |

En el lienzo, una capa muestra un modo cuando la estableces en él, sea cual sea la condición. En el código exportado, un modo que se cambia manualmente se activa añadiendo su atributo a un elemento, así que las capas establecidas en él se exportan con ese atributo. Las capas establecidas en un modo con cualquier otra condición, incluidos los selectores personalizados, se exportan con valores literales en lugar de tokens, porque la hoja de estilos, y no la capa, decide cuándo se aplica ese modo.

## Gestionar variables

Las variables se agrupan según las carpetas de sus nombres (`Brand/Primary` aparece como *Primary* dentro de *Brand*), con su nombre CSS y un valor por modo.

- **Crear una variable:** haz clic en **+** en la barra de herramientas y elige un tipo; la nueva variable se abre para editarla
- **Seleccionar:** haz clic en una fila, o muévete con las flechas y pulsa Intro
- **Buscar:** escribe en la barra de búsqueda para filtrar las variables por nombre
- **Eliminar:** haz clic en **Eliminar variable** al final de sus ajustes

Al seleccionar una variable se editan:

- **Nombre** y **Nombre CSS:** deja el nombre CSS vacío para derivarlo del nombre y los ámbitos, por ejemplo `--color-brand-primary`
- **Unidad:** para números, `px`, `rem`, `%`, `ms`, `s`, `deg` o ninguna; los valores se introducen en esa unidad
- **Valores:** uno por modo; un color abre el selector de color y un alias muestra la variable a la que apunta
- **Expresión CSS:** para números, un valor como `clamp(1rem, 4vw, 1.5rem)` que se escribe en CSS en lugar del número, mientras el lienzo sigue dibujando el número
- **Ámbitos:** para qué propiedades se ofrece la variable
- **Descripción**

## Hoja de estilos

La parte inferior del diálogo muestra la colección activa como propiedades personalizadas de CSS o como un tema de Tailwind v4. El botón de copiar (**Copiar todas las variables como CSS**) copia las variables de todo el documento en ese formato, de modo que los alias a otras colecciones se resuelven.

## Vincular variables a rellenos

En la sección Relleno del panel de propiedades, usa el selector de variables para vincular una variable de color al relleno de un objeto.

- **Vincular:** elige una variable de color en el selector. El relleno muestra una etiqueta morada con el nombre de la variable.
- **Desvincular:** haz clic en el botón de desvincular de la etiqueta para quitar el vínculo. El relleno vuelve al valor de color resuelto.

Cuando cambia el valor de la variable (o al cambiar de modo), todos los rellenos vinculados se actualizan automáticamente.

## Consejos

- Usa colecciones para agrupar tokens relacionados (por ejemplo, `Primitives` para colores base, `Semantic` para alias por función y `Spacing` para valores de maquetación).
- Los modos son útiles para cambiar de tema: define valores Claro y Oscuro en la misma colección.
- Las variables admiten alias: una colección `Semantic` puede hacer referencia a valores de una colección `Primitives`.
- Consulta [Dibujar formas](./drawing-shapes) para ver cómo funcionan los rellenos y el selector de color.
