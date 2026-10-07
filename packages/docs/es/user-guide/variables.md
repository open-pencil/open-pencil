---
title: Variables
description: Crear variables, colecciones y modos, y vincularlas a propiedades de diseño.
---

# Variables

Las variables almacenan tokens de diseño reutilizables, como colores, espaciados y otras propiedades, que se pueden vincular a objetos. Si cambias el valor de una variable, se actualizan todos los objetos que la usan.

## Abrir el diálogo de variables

Ábrelo desde **Ver → Variables…**, buscando «Variables» en la paleta de comandos o, sin objetos seleccionados, desde la sección Variables de la pestaña **Diseño**. **Expandir** en la esquina del diálogo le da la mayor parte de la ventana.

El diálogo muestra a la izquierda las variables de la colección activa, edita a la derecha la variable seleccionada o la colección, y muestra debajo la hoja de estilos que producen. En una ventana estrecha o en un teléfono muestra un modo a la vez, y una variable, los ajustes de la colección o la hoja de estilos se abren sobre la lista con un botón para volver.

## Colecciones

Las variables se organizan en colecciones. En un diálogo ancho aparecen en una barra lateral con el número de variables de cada una; si es más estrecho, como pestañas, o como menú en el móvil.

- **Cambiar de colección:** haz clic en ella en la barra lateral o en su pestaña
- **Crear una colección:** haz clic en **+** junto a **Colecciones** o en el botón de carpeta de la barra de herramientas (**Crear colección**)
- **Renombrar o eliminar:** sin ninguna variable seleccionada, la parte derecha edita la colección: cambia su nombre o elimínala desde el menú **⋯** junto al nombre (**Eliminar colección**)
- **Atributo de cambio:** el atributo que activa los modos que se cambian manualmente, `data-theme` por defecto para una colección llamada Theme; escribe otro nombre, como `data-color-scheme`, para adaptarlo a un código existente

## Modos

Cada colección puede tener varios modos (por ejemplo, Claro y Oscuro). Los modos aparecen como columnas de valores en la lista, y una variable tiene un valor para cada modo. Se gestionan en los **Ajustes de la colección**:

- **Añadir un modo:** haz clic en **+** junto a **Modos**
- **Renombrar:** edita el nombre del modo
- **Duplicar, establecer como predeterminado, eliminar:** usa el menú **⋯** junto al modo (**Duplicar modo**, **Establecer como predeterminado**, **Eliminar modo**)

El modo predeterminado es **Siempre activo** y va en `:root`. Todos los demás modos tienen **Se aplica cuando**, que indica cuándo el modo toma el control en la hoja de estilos exportada; el CSS que escribe se muestra debajo:

| Se aplica cuando | CSS |
| --- | --- |
| **se cambia manualmente** | el atributo de cambio de la colección con el modo como valor, como `[data-theme="dark"]` para el modo Oscuro de una colección Theme |
| **el sistema está en modo oscuro** / **el sistema está en modo claro** | `@media (prefers-color-scheme: dark)` / `light` |
| **el contraste alto está activado** | `@media (prefers-contrast: more)` |
| **la reducción de movimiento está activada** | `@media (prefers-reduced-motion: reduce)` |
| **la pantalla es más estrecha que** / **la pantalla es más ancha que** un ancho | `@media (max-width: 640px)` / `min-width` |
| **el contenedor es más estrecho que** / **el contenedor es más ancho que** un ancho | `@container (max-width: 640px)` / `min-width` |
| **CSS personalizado** | cualquier selector, o una consulta `@media`, `@supports` o `@container` |

En el lienzo, una capa muestra un modo cuando la estableces en él, sea cual sea la condición. En el código exportado, un modo que se cambia manualmente se activa añadiendo su atributo a un elemento, así que las capas establecidas en él se exportan con ese atributo. Las capas establecidas en un modo con cualquier otra condición, incluidos los selectores personalizados, se exportan con valores literales en lugar de tokens, porque la hoja de estilos, y no la capa, decide cuándo se aplica ese modo.

## Gestionar variables

Las variables se agrupan según las carpetas de sus nombres (`Brand/Primary` aparece como *Primary* dentro de *Brand*), con su nombre CSS y un valor por modo.

- **Crear una variable:** haz clic en **Crear variable** (o en **+**) y elige un tipo; la nueva variable se abre para editarla
- **Seleccionar:** haz clic en una fila, o muévete con las flechas y pulsa Intro. Con Shift y clic seleccionas un rango, y con Cmd y clic (Ctrl y clic en Windows y Linux) añades o quitas una fila
- **Filtrar:** escribe en la barra de búsqueda para filtrar por nombre, nombre CSS, descripción o valor, como `--color-brand`, un color hexadecimal o la variable a la que apunta un alias, tolerando erratas como la paleta de comandos; haz clic en un grupo de la barra lateral para ver solo ese grupo y los grupos que contiene, o usa el botón de filtro (**Filtrar por tipo**) para ver solo algunos tipos
- **Renombrar o editar en el lugar:** haz doble clic en un nombre, o en un valor numérico o de texto, de la lista
- **Clic derecho:** renombra, duplica (**Duplicar**), mueve a un grupo o a uno nuevo (**Mover al grupo**, **Nuevo grupo…**) o elimina (**Eliminar variables**) las variables seleccionadas; Delete o Backspace también las elimina
- **Reordenar:** arrastra una fila; el orden se conserva en el archivo
- **Varias seleccionadas:** la parte derecha las mueve a un grupo, las duplica o las elimina
- **Deshacer y rehacer:** Cmd+Z y Cmd+Mayús+Z o Cmd+Y (Ctrl en Windows y Linux) funcionan en el diálogo igual que en el lienzo, un paso por cambio. Intro confirma un campo y vuelve a la lista; mientras un campo tiene texto sin confirmar, Cmd+Z deshace lo escrito

Al seleccionar una variable se editan:

- **Nombre** y **Nombre CSS:** deja el nombre CSS vacío para derivarlo del nombre y los ámbitos, por ejemplo `--color-brand-primary`. Escribe el nombre sin `--`; un nombre que CSS no puede usar se marca y no se guarda
- **Unidad:** para números, `px`, `rem`, `%`, `ms`, `s`, `deg` o ninguna; los valores se introducen en esa unidad
- **Valor** o **Valores:** uno por modo; un color abre el selector de color. El botón de variable (**Usar una variable**) junto a un valor lo hace apuntar a otra variable del mismo tipo, un alias que sigue a esa variable; **Desvincular variable** lo devuelve al valor que mostraba
- **Expresión CSS:** para números, un valor como `clamp(1rem, 4vw, 1.5rem)` que se escribe en CSS en lugar del número, mientras el lienzo sigue dibujando el número
- **Ámbitos:** para qué propiedades se ofrece la variable
- **Descripción**
- **Ocultar al publicar:** los archivos que usan este como biblioteca no ven la variable

## Hoja de estilos

La parte inferior del diálogo muestra la colección activa como propiedades personalizadas de CSS. El botón de copiar (**Copiar todas las variables como CSS**) copia las variables de todo el documento como CSS o como un tema de Tailwind v4 (**Copiar todas las variables como tema de Tailwind**), de modo que los alias a otras colecciones se resuelven.

## Importar y exportar design tokens

Las variables y los estilos pasan entre OpenPencil, Figma y el código como [design tokens del W3C](https://www.designtokens.org/):

- **Exportar:** en el menú de copia de la hoja de estilos, elige **Exportar como design tokens**. El zip contiene un archivo por cada modo de colección, que Figma importa como modo; los estilos de texto y de efecto como tokens de tipografía y de sombra; y un resolver que lo combina todo para herramientas como Style Dictionary
- **Importar:** haz clic en **Importar design tokens** en la barra de herramientas y elige archivos de tokens o un zip. Funcionan los archivos de Figma, un resolver con los archivos que nombra y los temas de Tokens Studio
- **Elegir el destino:** antes de cambiar nada, el diálogo muestra cada colección y modo que encontró y adónde va: a una colección o un modo nuevos, a uno existente o a ninguna parte. Las variables y los estilos con el mismo nombre se actualizan y el resto se añade; no se elimina nada. Cuenta lo que se añadirá, actualizará y omitirá, y explica por qué se omitió cada token
- La importación es un solo paso: **Deshacer** la revierte entera

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
