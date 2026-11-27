---
pageClass: guide
title: Dibujar formas
description: Dibuja rectángulos, elipses, líneas, polígonos, estrellas, marcos y secciones, y después dales color y añádeles contornos, sombras y desenfoques.
---

# Dibujar formas

Las herramientas de forma están en la barra de herramientas de la parte inferior de la ventana. Elige una y arrastra en el lienzo.

## Dibujar una forma

1. Pulsa <Keys mac="R" other="R" /> para un rectángulo, <Keys mac="O" other="O" /> para una elipse o <Keys mac="L" other="L" /> para una línea. Los polígonos y las estrellas están en el menú de formas: haz clic en la flecha junto al rectángulo.
2. Arrastra en el lienzo. Mantén pulsada <Keys mac="⇧" other="Shift" /> para dibujar un cuadrado o un círculo, o para mantener una línea en pasos de 45°.
3. Suelta. La forma nueva queda seleccionada y la barra de herramientas vuelve a **Mover**.

<GuideImage name="drawing-shapes/tools" alt="El menú de formas abierto en la barra de herramientas, con Rectángulo, Línea, Elipse, Polígono y Estrella" />

Un clic sin arrastrar crea una forma de 100 × 100, o una línea de 100 de largo. Empieza dentro de un marco para dibujar la forma dentro de él.

## Redondear las esquinas

Pasa el puntero sobre un rectángulo seleccionado: aparece un punto dentro de cada esquina. Arrastra uno para redondear las esquinas: todas mientras sean iguales, o solo esa cuando sean distintas. Mantén pulsada <Keys mac="⌥" other="Alt" /> para hacer lo contrario, y <Keys mac="⇧" other="Shift" /> para avanzar en pasos de 10.

Para escribir un radio, usa **Redondeado** en el panel Diseño. El botón que hay a su lado define cada esquina por separado. **Suavizado de esquinas** hace que la curva empiece antes, como en el icono de una app.

Un polígono o una estrella tiene un punto de radio, debajo de su vértice superior, y dos más:

- Arrastra el punto del siguiente vértice alrededor del centro para cambiar el número de puntas.
- Arrastra hacia dentro o hacia fuera el punto del primer vértice interior de una estrella para hacerla más fina o más gruesa.

**Cantidad** y **Proporción** en el panel Diseño hacen lo mismo. Los puntos se ocultan mientras la forma mide menos de unos 108 píxeles en pantalla: acerca el zoom para alcanzarlos.

<GuidePair>

<GuideImage name="drawing-shapes/corners" alt="Un rectángulo seleccionado con un punto dentro de cada esquina" caption="Puntos de esquina en un rectángulo" />
<GuideImage name="drawing-shapes/star" alt="Una estrella seleccionada con puntos para su radio, su número de puntas y su proporción" caption="Puntos de radio, de puntas y de proporción en una estrella" />

</GuidePair>

## Dar color a una forma

Haz clic en el cuadrado de color bajo **Relleno**. Los botones de la parte superior del selector, de izquierda a derecha, eligen el tipo de relleno:

<GuideLegend>

<GuideImage name="drawing-shapes/fill" alt="El selector de relleno en su botón de degradado, con un degradado lineal morado y sus dos paradas" />

- **Sólido**: un solo color. Escribe un valor hexadecimal en el panel, o usa el cuentagotas para tomar un color del lienzo.
- **Degradado**: lineal, radial, angular o diamante. Mientras el selector está abierto, el lienzo muestra los tiradores del degradado. Arrastra un extremo para moverlo, con <Keys mac="⇧" other="Shift" /> para girarlo en pasos de 15°, y arrastra el cuadrado de una parada para deslizarla.
- **Imagen**: una imagen de tu ordenador o una [foto de stock](./photos). Puede rellenar la forma con **Fill**, **Fit**, **Crop** o **Tile**, y los controles deslizantes ajustan la exposición, el contraste y más.
- **Shader**: un efecto en movimiento, como **Aurora**. El lienzo muestra un fotograma fijo, y se reproduce en la vista previa: haz clic en **▷** en la esquina superior derecha de la ventana, o pulsa <Keys mac="⌘ ⌥ Enter" other="Ctrl Alt Enter" />. Haz clic en **{ }** para pegar un preajuste copiado de shaders.com.

</GuideLegend>

Haz clic en **+** junto a **Relleno** para añadir otro relleno encima. El ojo oculta un relleno y **−** lo quita.

## Añadir un contorno

Haz clic en **+** junto a **Trazo**. Después:

- **Interior**, **Centro** o **Exterior** define dónde se sitúa la línea respecto al borde.
- **W** define el grosor. El botón con cuatro cuadrados define el grosor de cada lado por separado.
- El botón de ajustes que hay a su lado activa una línea discontinua y define el aspecto de los extremos y las esquinas de la línea. Un trazado abierto puede terminar en flecha.

## Añadir sombras y desenfoques

Haz clic en **+** junto a **Efectos** y elige el tipo de efecto:

<GuideLegend>

<GuideImage name="drawing-shapes/effects" alt="La lista de efectos: sombra exterior, sombra interior, desenfoque de capa, desenfoque de fondo, desenfoque de primer plano, ruido, textura y vidrio" />

- **Sombra exterior** y **Sombra interior**: una sombra fuera o dentro de la forma.
- **Desenfoque de capa** desenfoca la forma; **Desenfoque de fondo**, lo que hay detrás, como un cristal esmerilado, y **Desenfoque**, lo que hay delante. Un desenfoque es **Uniforme**, o **Progresivo** para pasar de nítido a desenfocado.
- **Ruido** y **Textura**: grano sobre la forma.
- **Vidrio**: curva e ilumina lo que hay detrás de la forma, como una lente.

</GuideLegend>

Haz clic en el cuadrado junto a un efecto para cambiar sus ajustes. Una forma puede tener varios efectos, pero solo un vidrio y una textura.

## Dibujar un marco

Un marco contiene otras capas: una pantalla, una tarjeta o un botón. Pulsa <Keys mac="F" other="F" /> o <Keys mac="A" other="A" /> y arrastra.

- Las capas que el marco nuevo cubre por completo pasan a estar dentro de él.
- Para un marco del tamaño de la pantalla de un teléfono, una tableta o un ordenador, elige un tamaño en el panel Diseño mientras la herramienta Marco está activa. Con un marco seleccionado, **Marco** en el panel Diseño lo redimensiona de la misma forma.
- Un marco oculta lo que sobresale de él. Desactiva **Recortar contenido** para mostrarlo.
- Para colocar lo que hay dentro de un marco en filas o columnas, usa el [auto-layout](./auto-layout).

## Agrupar zonas con secciones

Una sección marca una zona de la página, como un flujo o un conjunto de pantallas. Pulsa <Keys mac="⇧ S" other="Shift S" /> y arrastra alrededor de las capas.

Las capas que una sección cubre por completo pasan a estar dentro de ella, también cuando mueves o redimensionas la sección más tarde. Las secciones se quedan en el nivel superior de la página: no pueden ir dentro de un marco. Arrastra el nombre de una sección para moverla.

## Organizar la barra de herramientas

Haz clic derecho en la barra de herramientas y elige **Personalizar barra de herramientas…**. Los mismos ajustes están en **Ajustes → Editor**.

- Desactiva una herramienta para ocultarla. Su atajo sigue funcionando.
- Arrastra una herramienta para moverla. Suéltala dentro de un recuadro para meterla en ese menú, entre recuadros para darle su propio botón, o sobre otra herramienta para juntar ambas en un menú.
- **Restablecer valores predeterminados** lo devuelve todo a su estado original.

Las herramientas añadidas en una versión posterior van a su lugar habitual, también en una barra de herramientas que hayas cambiado.
