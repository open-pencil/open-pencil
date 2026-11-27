---
pageClass: guide
title: Iconos
description: Busca en conjuntos de iconos de código abierto y en SF Symbols, inserta iconos, y cámbialos, recoloréalos o cambia su estilo en OpenPencil.
---

# Iconos

OpenPencil busca en los conjuntos de iconos de código abierto publicados a través de [Iconify](https://iconify.design), como Lucide, Material Symbols, Tabler y Phosphor, y, en la app para Mac, en los SF Symbols de Apple. Un icono colocado recuerda qué icono es, así que más adelante puedes cambiarlo por otro o cambiar su color, y las exportaciones lo escriben como ese icono.

Para buscar y colocar iconos se necesita conexión de red con la API de Iconify.

## Insertar un icono

Abre el selector de iconos de cualquiera de estas formas:

- Haz clic en **Insertar icono** al final de la barra de herramientas.
- Elige **Objeto → Insertar icono…**.
- Busca **Insertar icono** en la paleta de comandos, <Keys mac="⌘ K" other="Ctrl K" />.

Antes de que escribas, el selector muestra los iconos que ya están colocados en este archivo y los que has elegido últimamente. Escribe lo que buscas, como `arrow` o `heart`, para buscar en todos los conjuntos. Pasa el puntero sobre un icono para ver su nombre y su conjunto.

Elige uno para colocarlo, con un tamaño de 24 × 24, en el centro de la vista, dentro del marco que estés editando si has entrado en uno. El icono nuevo queda seleccionado, y <Keys mac="⌘ Z" other="Ctrl Z" /> lo quita en un solo paso.

<GuideImage name="icons/picker" alt="El selector de iconos buscando heart, con resultados de varios conjuntos de iconos" />

## Elegir un conjunto de iconos

El botón de conjunto al final del campo de búsqueda (al principio, **Todos los conjuntos**) limita el selector a un solo conjunto. Los conjuntos se agrupan por tipo, como Material o Logos; escribe para encontrar uno por su nombre, como `tabler`. Cada conjunto muestra cuántos iconos tiene.

Con un conjunto elegido, el selector muestra el conjunto completo, cargando más a medida que te desplazas, y una búsqueda solo mira en ese conjunto. Pasa el puntero sobre un icono, o llega a él con las teclas de flecha, para ver su nombre, su conjunto y su licencia debajo de la cuadrícula. El selector recuerda el último conjunto que elegiste, y **Cambiar icono** se abre en el conjunto del icono que estás cambiando.

## Cambiar un icono o su color

Al seleccionar un icono colocado se añade una sección **Icono** al panel Diseño.

- **Cambiar icono** abre el selector y dibuja el icono elegido en lugar del actual. El icono conserva su tamaño, su posición y su color.
- **Color del icono** cambia el color de los trazados propios del icono. Los iconos dibujados en varios colores fijos, como los logotipos de marcas, conservan esos colores y no muestran este campo.

- Aparecen **opciones** para los iconos de Material Symbols y de SF Symbols, que OpenPencil dibuja por sí mismo; consulta más abajo. Al cambiar una, el icono se vuelve a dibujar.

Cada cambio de icono, de color o de opción es un paso de deshacer; arrastrar en el selector de color se deshace como un solo cambio.

Un icono es un marco de trazados vectoriales, con el nombre del icono, como `cat`, y marcado con una carita sonriente en el árbol de capas. A diferencia de otros marcos de la página, no tiene título en el lienzo, y al redimensionarlo se escalan sus trazados. Sus capas, restricciones, efectos y el resto del panel Diseño funcionan como en cualquier marco.

## Ajustar los Material Symbols

Material Symbols Outlined, Rounded y Sharp se dibujan a partir de las fuentes variables de Google, así que sus opciones en la sección Icono son los propios ejes de las fuentes:

- **Weight**, de 100 a 700.
- **Fill**, 0 para contorno o 1 para relleno.
- **Grade**, de −50 a 200, que engrosa ligeramente los trazos sin cambiar el tamaño del icono, por ejemplo para equilibrar iconos claros sobre un fondo oscuro.
- **Optical size**, de 20 a 48. Un icono colocado empieza con el tamaño óptico de su tamaño, como recomienda Google, así que un icono de 24 × 24 usa 24; ajústalo tú mismo para dibujar un icono pequeño con el detalle de uno grande, o al revés.

## Usar SF Symbols {#sf-symbols}

Los SF Symbols son los iconos de Apple. Apple solo concede licencia para usarlos en sus propias plataformas, así que OpenPencil nunca los incluye: los dibuja macOS, y solo están disponibles en la [app de OpenPencil para Mac](/es/download) en **macOS 14 Sonoma o posterior**. En el navegador, en Windows y Linux, y en versiones anteriores de macOS, el selector de iconos muestra SF Symbols bajo Apple e indica lo que necesitan en lugar de mostrarlos.

Para usarlos:

1. [Descarga OpenPencil](/es/download) para macOS y ábrelo. Si tu Mac tiene una versión anterior de macOS, actualízala primero en **Ajustes del Sistema → General → Actualización de software**.
2. Abre el selector de iconos, elige **SF Symbols** en el menú de conjuntos y busca por nombre o palabra clave, como `heart` o `weather`.

La sección Icono ofrece entonces:

- **Weight**, de Ultralight a Black, y **Scale**, pequeña, mediana o grande, como en las apps de Apple.
- **Rendering**: **Monochrome**, en el color del icono; **Hierarchical**, el color del icono con varias opacidades; **Palette**, el color del icono más un **Secondary color** y un **Tertiary color** para las demás capas del símbolo; o **Multicolor**, los colores propios del símbolo, donde las partes que siguen al primer plano toman el color del icono.
- **Variable value**, de 0 a 1, para los símbolos que se rellenan por pasos, como `wifi` o `speaker.wave.3`; los demás símbolos no cambian.

Un documento conserva los contornos de sus SF Symbols, así que se dibujan en cualquier lugar donde se abra. Para cambiar uno o sustituirlo por otro se vuelve a necesitar la app para Mac; en otros sitios, la sección Icono lo indica en lugar de mostrar sus opciones.

## Editar los trazados de un icono

Puedes editar los trazados de un icono como cualquier vector. En cuanto cambian sus puntos, sus trazados o sus propios colores, la sección Icono indica **Modificado**:

- El icono se exporta como los trazados que dibuja ahora en lugar de por su nombre, así que la edición se conserva.
- **Restablecer** (la flecha circular) vuelve a dibujar el icono original, con el mismo tamaño y color.
- Al cambiar el icono se te pregunta antes, ya que un cambio dibuja un icono nuevo y descarta la edición.

Redimensionar el icono o cambiar su color no cuenta como edición.

**Desvincular icono**, en la sección Icono, en el menú del lienzo o en **Objeto → Desvincular icono**, convierte un icono en una ilustración normal: conserva sus trazados, pero ya no se puede cambiar ni recolorear ni se exporta como icono. Como todos los comandos de iconos, es un solo paso de deshacer.

## Iconos en las exportaciones

- **Design JSX** escribe un icono colocado como `<Icon name="lucide:heart" size={24} color="#…" />`. Los Material Symbols y los SF Symbols se exportan como los trazados que dibujan, ya que su nombre por sí solo no indica cómo se dibujaron; para colocar uno por su nombre, dale a `<Icon>` sus `options`, como <code v-pre>options={{ wght: 600, FILL: 1 }}</code>.
- **HTML** lo escribe como SVG en línea marcado con `data-icon`, con sus trazados pintados en `currentColor` y el color del icono definido en el `<svg>`, de modo que cambiar ese único `color` lo recolorea.
- **SVG e imágenes** lo dibujan como cualquier otro vector.

## Iconos en HTML importado

Al importar HTML, los iconos que dibuja una página se conservan como iconos, con los trazados y el color propios de la página:

- Un SVG en línea marcado con `data-icon`, como lo escribe la exportación HTML de OpenPencil, se convierte en ese icono.
- Cualquier otro SVG en línea se convierte en el icono de un conjunto popular de Iconify que dibuja, cuando lo dibuja con suficiente parecido: se compara con los iconos cuyas formas más se le acercan, dibujados de la misma manera.
- Todo lo demás se queda como ilustración.

La comparación descarga un índice de los conjuntos populares, de unos 2 MB, y pide a Iconify por su nombre los iconos con los que compara; el propio SVG nunca se envía. Sin conexión, un SVG en línea sin `data-icon` se queda como ilustración. Desactívalo con **Nombrar iconos en HTML importado** en **Ajustes → Editor**, o con `--no-icon-names` en `openpencil import`.

Los iconos colocados por agentes de IA, clientes MCP y Design JSX son iconos de la misma forma, así que la sección Icono también funciona con ellos.
