---
pageClass: guide
title: Edición vectorial
description: Mueve los puntos y las curvas de un trazado, añade y elimina puntos, y combina formas para crear otras nuevas.
---

# Edición vectorial

Un trazado está formado por puntos unidos por líneas rectas o curvas. Para cambiar su forma, edita los propios puntos.

## Editar un trazado

Haz doble clic en un trazado, o selecciónalo y pulsa <Keys mac="Enter" other="Enter" />. Aparecen sus puntos y desaparecen los tiradores que rodean la capa.

<GuideImage name="vector-edit/points" alt="Un trazado curvo en modo de edición, con un punto seleccionado y sus dos tiradores" />

- Arrastra un punto para moverlo.
- Arrastra el tirador de un punto para cambiar la curva.
- Haz clic en una línea entre dos puntos para seleccionarla, y arrástrala para mover sus dos puntos.
- Arrastra desde un punto vacío para seleccionar los puntos que quedan dentro del recuadro.
- Dentro de una forma con relleno, la zona bajo el puntero aparece rayada. Haz clic para seleccionarla con todos sus puntos, y arrastra para moverla.
- Mantén pulsada <Keys mac="⇧" other="Shift" /> y haz clic para añadir a la selección.

Para dejar de editar, pulsa <Keys mac="Esc" other="Esc" /> o <Keys mac="Enter" other="Enter" />, o haz clic en una zona vacía del lienzo.

## Dar forma a una curva

Mantén pulsada una tecla mientras arrastras un tirador:

| Mantén pulsada | Qué hace |
| -------------- | -------- |
| <Keys mac="⌘" other="Ctrl" /> | Mantiene ambos tiradores en una sola línea, para una curva suave. Solo cambia la longitud de este tirador. |
| <Keys mac="⌥" other="Alt" /> | Mueve solo este tirador, para una esquina marcada. |
| <Keys mac="⇧" other="Shift" /> | Mantiene la dirección del tirador y solo cambia su longitud. |

Mantén pulsada <Keys mac="⌘" other="Ctrl" /> y arrastra un punto para sacar sus tiradores y curvar las líneas contiguas.

## Añadir y eliminar puntos

Pulsa <Keys mac="P" other="P" /> mientras editas para usar la pluma:

- Haz clic en una línea para añadir un punto en ella.
- Haz clic en el extremo de un trazado abierto para seguir dibujando desde ahí.
- Mantén pulsada <Keys mac="⌥" other="Alt" /> y haz clic en un punto para eliminarlo.

Para eliminar lo seleccionado, pulsa <Keys mac="⌫" other="Delete" />. Un punto eliminado se lleva sus líneas consigo. Una línea eliminada deja sus puntos, salvo que nada más los sostenga, así que al eliminar una línea del medio el trazado se divide en dos. Para dividir un trazado en un punto, selecciona el punto y pulsa <Keys mac="⌥ ⌫" other="Alt Delete" />.

## Combinar formas

Selecciona dos o más formas y elige cómo combinarlas en **Objeto**:

<GuideImage name="vector-edit/combine" alt="Un cuadrado y un círculo superpuestos, y las cuatro formas de combinarlos: unión, sustracción, intersección y exclusión" />

- **Selección de unión** las une en una sola forma.
- **Selección de sustracción** recorta las formas de encima de la de abajo.
- **Selección de intersección** conserva solo la zona donde se superponen.
- **Selección de exclusión** lo conserva todo salvo la zona donde se superponen.

El resultado sigue siendo editable: cada forma conserva sus propios puntos dentro de él. **Aplanar** convierte la selección en un único trazado simple, y **Contornear trazo** convierte un trazo en una forma con relleno. Los rectángulos, las elipses y las estrellas se convierten, una vez aplanados, en trazados que puedes editar punto a punto.
