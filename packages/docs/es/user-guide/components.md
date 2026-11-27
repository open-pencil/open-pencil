---
pageClass: guide
title: Componentes
description: Crea componentes reutilizables, coloca instancias, añade variantes y propiedades, y convierte componentes en controles que funcionan.
---

# Componentes

Un componente es una pieza de diseño que usas una y otra vez, como un botón o una tarjeta. Sus copias se llaman instancias. Cambia el componente y todas las instancias cambiarán con él.

<GuideLegend>

<GuideImage name="components/overview" alt="Un componente Button con dos variantes en un recuadro discontinuo, y una instancia Publish a su lado" />

1. Un **conjunto de componentes** contiene las variantes de un componente. Tiene un borde morado discontinuo.
2. Cada **variante** es un componente por sí misma. Su nombre, como **Variant=Primary**, aparece encima de ella.
3. Una **instancia** es una copia que colocas en tu diseño. Conserva su propio texto, aquí **Publish**.

</GuideLegend>

## Crear un componente

1. Selecciona un marco, o las capas que quieres reutilizar.
2. Pulsa <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />.

Un marco o un grupo se convierte en el componente. Las demás capas se envuelven en un componente nuevo a su alrededor. Los componentes muestran su nombre en morado encima de ellos en el lienzo.

## Colocar una instancia

Abre **Recursos** en la parte superior del panel izquierdo. Muestra los componentes de tu archivo, por página, y los de las bibliotecas que hayas activado.

<GuideLegend>

<GuideImage name="components/assets" alt="El panel Recursos con los componentes Button y Switch" />

- Haz clic en un componente para colocarlo, o arrástralo al lienzo.
- Escribe en el campo de búsqueda para encontrar uno por su nombre.
- Los botones junto a la búsqueda cambian entre cuadrícula y lista, y abren las [bibliotecas](./component-libraries).

</GuideLegend>

También puedes hacer clic derecho en un componente en el lienzo y elegir **Crear instancia**, o pulsar <Keys mac="⌘ D" other="Ctrl D" /> sobre él.

## Cambiar todas las instancias

Edita el componente: su tamaño, sus colores, su texto, su diseño o las capas que contiene. Todas las instancias lo siguen, salvo en lo que hayas cambiado tú mismo en esa instancia.

Para encontrar el componente del que procede una instancia, haz clic derecho en la instancia y elige **Ir al componente principal**. OpenPencil abre su página y lo selecciona.

## Cambiar una sola instancia

Selecciona una instancia y cámbiala como cualquier otra capa: edita su texto, cambia un color u oculta una capa que contenga. Estos cambios se mantienen cuando cambia el componente, y todo lo demás sigue al componente.

Algunas cosas siempre vienen del componente: dónde está cada capa dentro de la instancia, su rotación y sus restricciones.

Para separar una instancia de su componente, pulsa <Keys mac="⌥ ⌘ B" other="Ctrl Alt B" />. Se convierte en un marco normal con el mismo aspecto.

## Crear variantes

Las variantes son versiones de un mismo componente, como un botón principal y uno secundario, o un interruptor encendido y apagado.

1. Selecciona un componente.
2. Haz clic en **Agregar variante** en la parte superior del panel Diseño. El componente se convierte en un conjunto, con una copia debajo.
3. Cambia la copia y ponle un nombre en **Variantes**.

Para combinar componentes que ya tienes, selecciónalos y pulsa <Keys mac="⇧ ⌘ K" other="Ctrl Shift K" />.

Una variante puede tener varias propiedades, como **Size=Small, State=Hover**. El conjunto no necesita todas las combinaciones. Cuando una instancia pide una que el conjunto no tiene, usa la variante de arriba a la izquierda.

## Elegir una variante en una instancia

<GuideLegend>

<GuideImage name="components/instance" alt="Propiedades del componente de una instancia: Label con el valor Publish y Variant con el valor Primary" />

Selecciona una instancia. **Propiedades del componente**, en la parte superior del panel Diseño, muestra lo que puedes definir: elige una variante, escribe una etiqueta, o muestra u oculta una capa.

</GuideLegend>

## Añadir propiedades

Las propiedades son los ajustes que ofrece una instancia. Las propiedades de variante de un conjunto de componentes ya están ahí.

1. Selecciona el componente.
2. Haz clic en **+** junto a **Propiedades** y elige un tipo:
   - **Texto** define las palabras de una etiqueta.
   - **Booleano** muestra u oculta una capa, como un icono.
   - **Intercambio de instancia** sustituye una instancia anidada, como el propio icono.
   - **Variante** añade otro conjunto de variantes.
3. Vincula una capa a ella. Selecciona la capa en el componente y haz clic en **Aplicar variable/propiedad** junto a su ajuste: en **Tipografía** para el texto, en **Apariencia** para mostrar y ocultar, o en la parte superior del panel para una instancia anidada.

<GuideLegend>

<GuideImage name="components/property" alt="La propiedad Label abierta, con su nombre, su valor predeterminado y la capa que controla" />

Haz clic en una propiedad para cambiarle el nombre, cambiar su valor predeterminado, ver las capas que controla o eliminarla. Arrastra las propiedades para reordenarlas.

</GuideLegend>

Para mostrar las propias propiedades de una instancia anidada en las instancias de tu componente, elige **+ → Instancias anidadas** y márcala.

## Añadir slots

Un slot es un marco de un componente cuyo contenido rellena cada instancia, como el cuerpo de una tarjeta o los elementos de una lista.

1. Selecciona un marco dentro del componente, o las capas que quieres envolver en uno.
2. Haz clic en **Crear slot** en el panel Diseño, o elige **Objeto → Crear slot**.

Los ajustes del slot admiten una descripción, los componentes que prefiere y cuántos elementos contiene; una instancia fuera de esos límites muestra una advertencia. En una instancia, añade, reordena y quita los elementos de un slot, o restablécelo al contenido del componente.

## Hacer que un componente funcione como un control

Un comportamiento convierte un componente en un botón, un interruptor, un control deslizante, una pestaña o un campo de texto que funcionan cuando previsualizas tu diseño. Los controles proceden de [Reka UI](https://reka-ui.com).

1. Selecciona el componente o el conjunto de componentes.
2. Haz clic en **+** junto a **Comportamiento** y elige un control.
3. Rellena las filas que muestra.

<GuideLegend>

<GuideImage name="components/behaviour" alt="La sección Comportamiento de un Switch, marcada como Lista, con Marcado, Encendido, Apagado, Control, Estados y Transición" />

- Las primeras filas indican qué propiedad contiene el valor, como **Marcado** en un interruptor, y qué slot dibuja cada parte, como su **Control**.
- **Estados** es la propiedad de variante que define el aspecto del control en reposo, bajo el puntero, pulsado, con el foco, desactivado y no válido. **Añadir variantes de estado** las crea por ti.
- **Transición** suaviza el paso del control entre estados. Su duración y su aceleración pueden seguir [variables de tiempo y aceleración](./variables#variables-de-aceleracion-y-tiempo).

</GuideLegend>

**Listo** aparece cuando el control funciona. Hasta entonces, una línea bajo su nombre indica lo que falta: haz clic en ella para ir allí.

Para probar tus controles, pulsa <Keys mac="⌥ ⌘ ↩" other="Ctrl Alt Enter" /> o haz clic en ▶ junto a **Compartir**. Los interruptores cambian, los controles deslizantes se arrastran, las pestañas se abren y los campos de texto aceptan escritura. La vista previa no cambia tu archivo. **Restablecer** devuelve todos los controles a su estado inicial, y <Keys mac="Esc" other="Esc" /> vuelve a la edición.

Los comportamientos se guardan en los archivos `.fig`, y los componentes exportados de Vue, React y Storybook los conservan, con cada transición escrita como CSS.

## Compartir componentes entre archivos

Para usar los mismos componentes en varios archivos, publícalos como una [biblioteca de componentes](./component-libraries).
