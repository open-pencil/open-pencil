---
pageClass: guide
title: Variables
description: Guarda colores, tamaños y otros valores en un solo lugar, cámbialos con modos y llévalos al código como CSS o design tokens.
---

# Variables

Una variable es un valor con nombre, como un color de marca o un radio de esquina, que las capas usan en lugar de un número propio. Cambia la variable y cambiarán todas las capas que la usan. Los modos dan otros valores a las mismas variables, como un tema oscuro.

## Abrir las variables

Elige **Ver → Variables…**, o haz clic en una zona vacía del lienzo y abre **Variables** en el panel Diseño.

<GuideImage name="variables/dialog" alt="La ventana Variables con la colección Theme, cuatro variables en Light y Dark, los ajustes de la colección y la hoja de estilos" />

1. Las **colecciones** agrupan variables, como colores o espaciados.
2. Cada **variable** tiene un valor en cada modo, en columnas.
3. **Ajustes** de la variable seleccionada, o de la colección cuando no hay ninguna seleccionada.
4. La **hoja de estilos** muestra la colección como CSS.

**Expandir**, en la esquina de la ventana, hace que ocupe casi toda la pantalla. En una ventana estrecha o en un teléfono, muestra un modo cada vez.

## Crear una variable

1. Haz clic en **Crear variable** y elige un tipo: color, número, texto, verdadero/falso, aceleración o tiempo.
2. Escribe un nombre. Las barras la colocan en un grupo: `Brand/Primary` aparece como **Primary** dentro de **Brand**.
3. Define su valor en cada modo.

A la derecha también puedes definir:

- **Nombre CSS**, que usa la hoja de estilos. Si lo dejas vacío, se deriva del nombre, como `--color-brand-primary`.
- **Unidad** para los números: `px`, `rem`, `%`, `ms`, `s`, `deg` o ninguna.
- **Ámbitos**, los ajustes que ofrecen la variable.
- **Descripción**, y **Ocultar al publicar** para dejarla fuera de las [bibliotecas](./component-libraries).

Para que una variable siga a otra, haz clic en el botón de variable junto a su valor y elígela. **Desvincular variable** la vuelve a convertir en un valor normal.

## Usar una variable

<GuideLegend>

<GuideImage name="variables/apply" alt="La fila Relleno de una capa seleccionada con su botón Aplicar variable abierto, mostrando los colores de Theme" />

1. Selecciona una capa.
2. Haz clic en **Aplicar variable** junto a un ajuste, como un color de relleno, un radio de esquina o un espaciado.
3. Elige una variable.

</GuideLegend>

El ajuste muestra entonces el nombre de la variable. Para volver a usar un valor normal, haz clic en **Aplicar variable** y elige **Desvincular variable**.

## Usar modos

Una colección puede tener varios modos, como **Light** y **Dark**. Cada variable de la colección tiene un valor en cada uno.

- Para añadir un modo, haz clic en **+** junto a **Modos** en los ajustes de la colección.
- Para renombrar uno, edita su nombre. El menú **⋯** que hay a su lado lo duplica, lo establece como predeterminado o lo elimina.

<GuideLegend>

<GuideImage name="variables/mode" alt="El ajuste Theme en Apariencia abierto, con Auto, Light y Dark" />

Para mostrar un marco en otro modo, selecciónalo y elige el modo en **Apariencia**. Las capas que contiene lo siguen, salvo que tengan un modo propio. **Auto** toma el modo de la capa que la rodea.

</GuideLegend>

En el código, **Se aplica cuando** indica cuándo entra en vigor un modo. El CSS que escribe aparece debajo:

| Se aplica cuando | CSS |
| --- | --- |
| **se cambia manualmente** | un atributo en un elemento, como `[data-theme="dark"]` |
| **el sistema está en modo oscuro** | `@media (prefers-color-scheme: dark)` |
| **el sistema está en modo claro** | `@media (prefers-color-scheme: light)` |
| **el contraste alto está activado** | `@media (prefers-contrast: more)` |
| **la reducción de movimiento está activada** | `@media (prefers-reduced-motion: reduce)` |
| **la pantalla es más estrecha que** un ancho | `@media (max-width: 640px)` |
| **la pantalla es más ancha que** un ancho | `@media (min-width: 640px)` |
| **el contenedor es más estrecho que** un ancho | `@container (max-width: 640px)` |
| **el contenedor es más ancho que** un ancho | `@container (min-width: 640px)` |
| **CSS personalizado** | cualquier selector, o una consulta `@media`, `@supports` o `@container` |

El modo predeterminado está siempre activo y va en `:root`. El **Atributo de cambio** de una colección, `data-theme` de forma predeterminada, es el atributo que activa sus modos manuales. Cámbialo para que coincida con tu código, como `data-color-scheme`.

Las capas con un modo manual se exportan con su atributo. Las capas con un modo de cualquier otra condición se exportan con valores normales, ya que es la hoja de estilos la que decide cuándo se aplica ese modo.

## Organizar las variables

- **Colecciones:** haz clic en **+** junto a **Colecciones** para añadir una. Sin ninguna variable seleccionada, el lado derecho permite renombrar la colección, y su menú **⋯** la elimina.
- **Buscar:** escribe en el campo de búsqueda para filtrar por nombre, nombre CSS, descripción o valor. Haz clic en un grupo para mostrar solo ese grupo, o usa el botón de filtro para ver solo algunos tipos.
- **Seleccionar:** haz clic en una fila o usa las teclas de flecha. <Keys mac="⇧" other="Shift" />-clic selecciona un rango, y <Keys mac="⌘" other="Ctrl" />-clic añade una.
- **Editar en el sitio:** haz doble clic en un nombre, un número o un texto de la lista.
- **Mover y eliminar:** haz clic derecho para renombrar, duplicar, mover a un grupo o eliminar. Arrastra las filas para reordenarlas.
- **Deshacer:** <Keys mac="⌘ Z" other="Ctrl Z" /> funciona aquí igual que en el lienzo.

## Escribir una fórmula

El valor de un número puede ser una fórmula sobre otras variables, como `space/base * 4`. Empieza a escribir el nombre de una variable y elígela, o elige **Usar una variable**. El campo muestra el resultado, como `= 16px`. Para otros tipos, elige **Usar una fórmula** junto al valor.

- Los números usan `+`, `-`, `*`, `/` y paréntesis.
- Los valores verdadero/falso usan `and`, `or` y `not`, y comparan con `==`, `!=`, `<`, `<=`, `>` y `>=`: `viewport > 1024 and not loading`.
- El texto va entre comillas dobles, y `+` lo une: `"Hello, " + name`. `text(count)` escribe un número como lo hace Figma.
- `if(condition, then, otherwise)` elige entre dos valores: `if(dark, gray/900, #FFFFFF)`.
- `truthy(value)` es falso para `0`, el texto vacío, `false`, `no` y `off`.

Los errores, como un nombre desconocido o un bucle, aparecen al salir del campo, y se mantiene el valor anterior. Al renombrar una variable, las fórmulas que la usan siguen funcionando.

En la hoja de estilos, una fórmula numérica se convierte en `calc()`. Las fórmulas con `if()`, texto o valores verdadero/falso no se pueden escribir como CSS y se omiten.

Un número también puede tener una **Expresión CSS** que lo sustituye solo en el código, como `clamp(1rem, 4vw, var(--spacing-md))`. Añádela desde el menú **⋯** del valor.

## Variables de aceleración y tiempo

Las variables de aceleración y de tiempo contienen movimiento: cuánto tarda un cambio y cómo se acelera y se frena. Las [transiciones de los componentes](./components#hacer-que-un-componente-funcione-como-un-control) pueden seguirlas, así que un modo de movimiento reducido puede acortar todas las transiciones a la vez.

- **Tiempo** es una duración, escrita en milisegundos, como `250ms`, o en segundos, como `0.25s`.
- **Aceleración** es una curva o un muelle. Haz clic en ella para abrir el editor:
  - **Curva:** elige una aceleración o **Bézier personalizada**, y luego arrastra los dos tiradores o escribe los números. **Invertir curva** la reproduce al revés.
  - **Muelle:** elige Suave, Rápido, Elástico, Lento o **Muelle personalizado**. Arrastra el primer rebote en **Tiempo**, o define la rigidez, la amortiguación y la masa en **Física**.

En CSS, un tiempo se escribe en milisegundos y una curva como una función de tiempo, como `cubic-bezier(0.45, 1.45, 0.8, 1)`. Los muelles no tienen forma CSS ahí y se omiten.

## Copiar las variables como código

El botón de copiar encima de la hoja de estilos copia todas las colecciones como CSS, o como un tema de Tailwind v4.

## Importar y exportar design tokens

Las variables y los estilos pasan entre OpenPencil, Figma y el código como [design tokens](https://www.designtokens.org/).

- **Exportar:** en el menú de copiar de la hoja de estilos, elige **Exportar como design tokens**. Obtienes un zip con un archivo por cada modo, que Figma importa como un modo, y los estilos de texto y de efecto.
- **Importar:** haz clic en **Importar design tokens** en la parte superior de la ventana y elige archivos de tokens o un zip. Funcionan los archivos de Figma y de Tokens Studio.

Antes de importar, la ventana muestra a dónde va cada colección y cada modo: a una nueva, a una existente o a ninguna parte. Las variables con el mismo nombre se actualizan, las demás se añaden y no se elimina nada. **Deshacer** revierte toda la importación.
