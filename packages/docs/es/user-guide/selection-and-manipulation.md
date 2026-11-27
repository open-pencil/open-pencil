---
pageClass: guide
title: Selección y manipulación
description: Selecciona capas y luego muévelas, redimensiónalas, gíralas, cópialas y edita varias a la vez.
---

# Selección y manipulación

Para cambiar una capa, primero selecciónala. El panel Diseño muestra entonces sus ajustes, y los tiradores que la rodean te permiten redimensionarla y girarla.

## Seleccionar una capa

Haz clic en una capa en el lienzo. Dentro de un marco, un clic selecciona una capa que está justo dentro del marco, como una fila de una lista. Haz doble clic para bajar un nivel.

<GuidePair>

<GuideImage name="selection-and-manipulation/click" alt="La fila Paper Lanterns seleccionada en una tarjeta de lista de reproducción" caption="Un clic selecciona la fila" />
<GuideImage name="selection-and-manipulation/double-click" alt="El título y el artista dentro de la fila, seleccionados" caption="Un doble clic entra en ella" />

</GuidePair>

Para llegar directamente a la capa que hay bajo el puntero, mantén pulsada <Keys mac="⌘" other="Ctrl" /> y haz clic. Para no seleccionar nada, haz clic en una zona vacía del lienzo o pulsa <Keys mac="Esc" other="Esc" />.

## Seleccionar varias capas

- Mantén pulsada <Keys mac="⇧" other="Shift" /> y haz clic en capas para añadirlas a la selección o quitarlas de ella.
- Arrastra por el lienzo desde un punto vacío para dibujar un recuadro. Se seleccionan las capas que toca. Un marco de la página solo se selecciona cuando el recuadro lo cubre por completo.
- Pulsa <Keys mac="⌘ A" other="Ctrl A" /> para seleccionar todo lo que hay en la página.

<GuideImage name="selection-and-manipulation/marquee" alt="Un recuadro de selección dibujado sobre dos filas de una tarjeta de lista de reproducción" />

## Seleccionar con el teclado

- <Keys mac="Enter" other="Enter" /> selecciona las capas que hay dentro de la seleccionada.
- <Keys mac="⇧ Enter" other="Shift Enter" /> selecciona la capa que la contiene.
- <Keys mac="Tab" other="Tab" /> y <Keys mac="⇧ Tab" other="Shift Tab" /> seleccionan la capa siguiente y la anterior del mismo nivel.

## Mover capas

Arrastra una capa seleccionada. Las teclas de flecha la mueven un píxel, y diez con <Keys mac="⇧" other="Shift" />.

- Mantén pulsada <Keys mac="⇧" other="Shift" /> mientras arrastras para moverla en línea recta.
- Suéltala sobre un marco para meter la capa en él. Arrástrala fuera del marco para sacarla.
- Mantén pulsada <Keys mac="Space" other="Space" /> mientras arrastras para que la capa siga dentro de su marco.

## Redimensionar y girar

<GuideLegend>

<GuideImage name="selection-and-manipulation/handles" alt="Una tarjeta seleccionada con tres partes numeradas: un tirador de esquina, el tirador de giro y el tamaño" />

1. Arrastra un **tirador** para redimensionar. Mantén pulsada <Keys mac="⇧" other="Shift" /> en una esquina para conservar las proporciones.
2. Arrastra el **tirador de giro** para girar, o señala justo fuera de una esquina y arrastra. Mantén pulsada <Keys mac="⇧" other="Shift" /> para girar en pasos de 15°.
3. El **tamaño** se muestra mientras la capa está seleccionada.

</GuideLegend>

Para escribir un tamaño o un ángulo exactos, usa **W**, **H** y el campo del ángulo en el panel Diseño. <Keys mac="⇧ H" other="Shift H" /> y <Keys mac="⇧ V" other="Shift V" /> voltean la selección en horizontal o en vertical.

## Copiar, pegar y eliminar

- <Keys mac="⌘ D" other="Ctrl D" /> crea una copia junto al original.
- Mantén pulsada <Keys mac="⌥" other="Alt" /> mientras arrastras para sacar una copia.
- <Keys mac="⌘ C" other="Ctrl C" /> y <Keys mac="⌘ V" other="Ctrl V" /> copian y pegan. Una capa pegada conserva su posición; para pegarla bajo el puntero, haz clic derecho y elige **Pegar aquí**.
- <Keys mac="⇧ ⌘ R" other="Ctrl Shift R" /> pega en lugar de las capas seleccionadas.
- <Keys mac="⌫" other="Delete" /> elimina la selección.

El texto copiado de una página web se pega como una sola capa de texto. Cuando copias parte del diseño de una página, como una tarjeta, un aviso ofrece **Pegar como capas** para reconstruirla como marcos y texto.

## Copiar el aspecto de una capa

<Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> copia el aspecto de una capa, y <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> aplica ese aspecto a todas las capas seleccionadas. También funciona con capas copiadas en Figma.

El aspecto son los rellenos, trazos, efectos, la opacidad, el modo de fusión, el radio de esquina y los estilos y variables que usan. Entre marcos incluye el auto-layout, y entre capas de texto, el estilo de texto. La posición, el tamaño, el nombre y el contenido no cambian.

## Agrupar capas

- <Keys mac="⌘ G" other="Ctrl G" /> agrupa la selección.
- <Keys mac="⌥ ⌘ G" other="Ctrl Alt G" /> la mete en un marco nuevo.
- <Keys mac="⇧ ⌘ G" other="Ctrl Shift G" /> deshace un grupo, un marco o una sección, y deja sus capas donde están.

Para colocar capas en una fila o una columna, usa el [auto-layout](./auto-layout).

## Mostrar una capa a través de una forma

Pon la forma debajo de las capas que debe recortar, selecciónalas todas y pulsa <Keys mac="⌥ ⌘ M" other="Ctrl Alt M" />. La capa inferior se convierte en una máscara: las capas de encima solo se ven dentro de ella, como una foto dentro de un círculo. Vuelve a pulsarlo para desactivar la máscara.

## Poner capas delante o detrás

Las capas que están más arriba en la [lista de capas](./layers-and-pages) tapan a las de abajo.

- <Keys mac="]" other="]" /> trae la selección al frente, y <Keys mac="[" other="[" /> la envía al fondo.
- <Keys mac="⌘ ]" other="Ctrl ]" /> y <Keys mac="⌘ [" other="Ctrl [" /> la mueven un paso.

## Ocultar y bloquear capas

- <Keys mac="⇧ ⌘ H" other="Ctrl Shift H" /> oculta la selección o vuelve a mostrarla. Las capas ocultas siguen en la lista de capas.
- <Keys mac="⇧ ⌘ L" other="Ctrl Shift L" /> la bloquea. No puedes seleccionar ni mover una capa bloqueada en el lienzo; selecciónala en la lista de capas.

## Editar varias capas a la vez

Con varias capas seleccionadas, el panel Diseño muestra los ajustes que comparten. **Mixto** marca un ajuste que es distinto entre ellas. Cambia un ajuste y cambiará en todas.

<GuideImage name="selection-and-manipulation/several" alt="El panel Diseño de dos filas seleccionadas, con Y en Mixto" />

<GuideLegend>

<GuideImage name="selection-and-manipulation/selection-colors" alt="Colores de la selección con cuatro colores" />

**Colores de la selección** muestra todos los colores de la selección, incluidas las capas que contiene. Cambia un color aquí para cambiarlo en todos los sitios donde se usa.

</GuideLegend>
