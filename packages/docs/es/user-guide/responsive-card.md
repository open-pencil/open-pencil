---
pageClass: guide
title: Crear una tarjeta adaptable
description: "Un primer proyecto en OpenPencil, paso a paso: una tarjeta de producto cuyo texto se ajusta y cuya altura sigue a su contenido en cualquier ancho."
---

# Crear una tarjeta adaptable

En este proyecto crearás una tarjeta de producto que se adapta: hazla más estrecha o más ancha, y su foto se estira, su texto se ajusta y su altura lo acompaña. Lleva unos diez minutos y usa las herramientas que más vas a utilizar.

<GuidePair>

<GuideImage name="responsive-card/narrow" alt="La tarjeta terminada con 240 de ancho, con la descripción en tres líneas" caption="240 de ancho" />
<GuideImage name="responsive-card/wide" alt="La misma tarjeta con 420 de ancho, con la descripción en dos líneas" caption="420 de ancho" />

</GuidePair>

## 1. Añade las piezas

Empieza con un archivo nuevo: **Archivo → Nuevo diseño**, o <Keys mac="⌘ N" other="Ctrl N" />.

1. Pulsa <Keys mac="R" other="R" /> y arrastra un rectángulo de unos 280 de ancho y 160 de alto. Contendrá la foto.
2. Pulsa <Keys mac="T" other="T" />, haz clic debajo del rectángulo y escribe el nombre: *Taza de cerámica*. Pulsa <Keys mac="Esc" other="Esc" />.
3. Añade debajo dos textos más de la misma forma: una descripción, como *Hecha a mano en pequeñas tandas, mantiene tu café caliente durante más tiempo*, y *Añadir al carrito*.

Mantén las cuatro piezas en una columna, con los bordes izquierdos más o menos alineados.

<GuideImage name="responsive-card/parts" alt="Un rectángulo y tres textos en una columna suelta en el lienzo" />

## 2. Mételas en una tarjeta

1. Pulsa <Keys mac="⌘ A" other="Ctrl A" /> para seleccionar las cuatro piezas.
2. Pulsa <Keys mac="⇧ A" other="Shift A" />. Pasan a un marco nuevo con [auto-layout](./auto-layout), que las coloca una tras otra.
3. En el panel Diseño, en **Flujo**, elige el botón de columna, **Diseño vertical**, si las piezas han quedado en una fila.
4. Pon el espaciado entre las piezas en **12** y el relleno interior en **20**.
5. Haz clic en **+** junto a **Relleno** para dar un fondo a la tarjeta, y pon **Redondeado** en **16**.
6. Haz doble clic en el nombre del marco en la lista de capas y llámalo *Tarjeta*.

## 3. Deja que las piezas se estiren

1. Pon el **W** de la tarjeta en **320**.
2. Selecciona el rectángulo. Abre el menú de su campo **W** y elige **Rellenar**: toma el ancho de la tarjeta, dentro del relleno interior.
3. Haz lo mismo con el nombre y la descripción. La descripción pasa a nuevas líneas en lugar de salirse por el borde de la tarjeta.

La altura de la tarjeta sigue a su contenido por sí sola. Ahora pruébalo: arrastra el borde derecho de la tarjeta o escribe otro **W**. La foto se estira, la descripción se ajusta y la tarjeta crece o se encoge para encajar.

## 4. Crea un botón

1. Selecciona *Añadir al carrito* y pulsa <Keys mac="⇧ A" other="Shift A" />. El texto pasa a un marco propio.
2. Da a ese marco un relleno azul, un relleno interior de **16** a los lados y **10** arriba y abajo, y un **Redondeado** de **10**. Pon el texto en blanco.
3. Pulsa <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" /> para convertir el botón en un [componente](./components) y poder reutilizarlo.

## 5. Añade una foto

1. Selecciona el rectángulo y haz clic en el cuadrado de color bajo **Relleno**.
2. Haz clic en el botón de imagen en la parte superior del selector y luego en **Choose image** para usar una imagen de tu ordenador, o en **Foto de stock** para [buscar una](./photos).

La foto rellena el rectángulo en cualquier ancho.

## 6. Revísala y compártela

- Abre la pestaña **Revisar** para [revisar la tarjeta](./checking-designs) en busca de problemas, como texto difícil de leer.
- [Expórtala](./exporting) como PNG, o haz clic derecho sobre ella y elige **Copiar/Pegar como → Copiar como PNG** para pegarla en un chat.
- Pide a la [IA](./ai-chat) una variante: *«Haz una versión oscura de esta tarjeta.»*

## Siguientes pasos

- [Auto-layout](./auto-layout): filas, cuadrículas, ajuste de línea y las demás formas en que las capas cambian de tamaño.
- [Componentes](./components): variantes, propiedades e instancias.
- [Variables](./variables): colores y tamaños que defines una vez, con modos oscuro y claro.
