---
pageClass: guide
title: Auto-layout
description: Crea marcos que colocan sus capas y cambian de tamaño con su contenido.
---

# Auto-layout

El auto-layout hace que un marco coloque las capas que contiene. Edita un texto, añade una fila u oculta una capa, y todo lo demás se mueve para encajar. Úsalo para botones, listas, tarjetas y pantallas enteras.

<GuidePair>

<GuideImage name="auto-layout/before" alt="Una tarjeta de lista de reproducción con dos canciones" caption="Dos canciones" />
<GuideImage name="auto-layout/after" alt="Una tarjeta de lista de reproducción más alta con tres canciones" caption="Añade una y la tarjeta crece" />

</GuidePair>

## Añadir auto-layout

1. Selecciona un marco, o las capas que quieres colocar.
2. Pulsa <Keys mac="⇧ A" other="Shift A" />.

Un marco empieza a colocar sus capas. Las capas sueltas se envuelven en un marco nuevo. Vuelve a pulsar <Keys mac="⇧ A" other="Shift A" /> en el marco para desactivar el auto-layout.

## Configurar el marco

Selecciona el marco y busca **Auto-layout** en el panel Diseño.

<GuideLegend>

<GuideImage name="auto-layout/panel" alt="Los ajustes de Auto-layout con seis controles numerados" />

1. **Flujo** coloca las capas libremente, en vertical, en horizontal o en cuadrícula.
2. **Ajustar diseño** pasa las capas a una nueva línea cuando se quedan sin espacio.
3. **Sizing** (tamaño) define cómo se comportan el ancho y el alto del marco.
4. **Alineación** coloca las capas dentro del marco. Haz clic en un punto.
5. **Espaciado** es el espacio entre las capas. Elige **Auto** en su menú para separarlas al máximo.
6. **Padding** (relleno interior) es el espacio dentro de los bordes del marco. El botón que hay a su lado define cada lado por separado.

</GuideLegend>

## Cambiar el espaciado en el lienzo

Selecciona el marco y señala un espacio o un borde para ver su tamaño. Haz doble clic en él, luego haz clic en el valor que aparece y escribe uno nuevo.

## Elegir cómo cambian de tamaño las capas

Selecciona una capa y abre el menú de su campo **W** o **H**.

<GuideLegend>

<GuideImage name="auto-layout/sizing" alt="El menú del ancho abierto, con Fijo, Ajustar al contenido y Rellenar" />

- **Fijo** conserva el tamaño que hayas definido.
- **Ajustar al contenido** se adapta al contenido.
- **Rellenar** ocupa el espacio disponible en el marco que la contiene.

</GuideLegend>

Para una fila de una lista, prueba **Rellenar** para el ancho y **Ajustar al contenido** para el alto. El mismo menú añade tamaños mínimos y máximos.

## Reordenar capas

Arrastra una capa a otro lugar del marco. La línea azul muestra dónde quedará.

<GuidePair>

<GuideImage name="auto-layout/drag" alt="El puntero arrastrando Low Tide, con una línea azul encima de Paper Lanterns" caption="Arrastra Low Tide hacia arriba" />
<GuideImage name="auto-layout/drop" alt="Low Tide entre Slow Morning y Paper Lanterns" caption="Suéltala y se coloca en su sitio" />

</GuidePair>

## Ajustar capas en varias líneas

Activa **Ajustar diseño** para contenido como etiquetas, en el que cambia el número de elementos. Un segundo campo de espaciado define el espacio entre líneas.

<GuideImage name="auto-layout/wrap" alt="Siete etiquetas repartidas en tres líneas" />

## Crear una cuadrícula

<GuideLegend>

<GuideImage name="auto-layout/grid-panel" alt="Ajustes de columnas y filas de una cuadrícula" />

1. Selecciona el marco y elige **Cuadrícula** en **Flujo**.
2. Usa **+** junto a **Columnas** y **Filas** para añadir pistas.
3. Elige **Rellenar (fr)** para pistas que comparten el espacio, o **Fijo (px)** para un tamaño fijo.
4. Define los espaciados entre columnas y filas en la parte inferior.

</GuideLegend>

<GuideImage name="auto-layout/grid" alt="Seis portadas de álbumes en tres columnas y dos filas" />

## Colocar una capa libremente

Algunas capas, como una insignia en una esquina, no deberían colocarse con el resto.

1. Selecciona la capa.
2. Haz clic en **Ignorar diseño automático** junto a **Posición**.
3. Arrástrala a cualquier lugar del marco.

También puedes mantener pulsada <Keys mac="⌃" other="Ctrl" /> mientras arrastras. La capa pasa al marco que hay bajo el puntero.
