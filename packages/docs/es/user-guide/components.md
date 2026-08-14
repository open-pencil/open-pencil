---
title: Componentes
description: Componentes reutilizables, instancias, overrides y sincronización en OpenPencil.
---
# Componentes

Los componentes son elementos de diseño reutilizables. Edita el componente principal y todas sus instancias se actualizan automáticamente.

## Explorar componentes

Abre la pestaña **Assets** del panel izquierdo para explorar componentes locales y bibliotecas habilitadas. Busca por nombre, cambia entre cuadrícula y lista, e inserta un componente con un clic, <kbd>Enter</kbd> o arrastrándolo al lienzo. Las revisiones descargadas siguen disponibles sin conexión.

## Crear un componente

Selecciona un marco o grupo y pulsa <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>). La selección se convierte en un componente reutilizable.

Los componentes muestran una etiqueta morada con icono de diamante.

## Conjuntos de componentes y variantes

Selecciona dos o más componentes y pulsa <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd>) para combinarlos en un conjunto de componentes — un contenedor con borde morado punteado.

Las variantes admiten varias dimensiones, como `Tamaño=Pequeño`, `Estado=Hover` y `Tema=Oscuro`, sin exigir todas las combinaciones. La variante superior izquierda es la predeterminada y sirve como alternativa cuando una actualización ya no incluye una coincidencia exacta. El panel de propiedades permite añadir, renombrar, ordenar y eliminar dimensiones y valores; las combinaciones duplicadas se rechazan.

## Propiedades de componente

Los componentes admiten propiedades de texto, visibilidad booleana e intercambio de instancia. Vincula una propiedad a un campo descendiente y edita su valor en una instancia sin desenlazarla. Las definiciones y asignaciones se conservan en archivos `.fig`.

## Bibliotecas de componentes

Una biblioteca publica componentes como una revisión inmutable. Abre **Assets → Administrar bibliotecas → Publicar biblioteca**, define un ID estable y un nombre en la primera publicación, selecciona los cambios y publica. Los cambios no seleccionados quedan pendientes para una publicación posterior.

Habilita bibliotecas desde **Administrar bibliotecas**. Sus recursos aparecen junto a los componentes locales. Las definiciones publicadas son de solo lectura en el documento consumidor, mientras que las instancias vinculadas y sus overrides siguen siendo editables.

En **Actualizaciones**, compara la instancia actual y la nueva lado a lado. Puedes actualizar una instancia, todas las instancias de un recurso, la página actual o todas las páginas. Las propiedades compatibles se conservan y las variantes ausentes muestran la alternativa antes de aceptar. Las actualizaciones se pueden deshacer y rehacer.

Las bibliotecas pueden usar el catálogo local o un proveedor de almacenamiento configurado. Las revisiones descargadas se guardan en caché. Los enlaces habilitados y las definiciones materializadas se guardan en `.fig`, por lo que el documento puede abrirse aunque la biblioteca remota no esté disponible.

## Crear instancias

Clic derecho → **Crear instancia**. La instancia aparece a la derecha del componente original.

## Desenlazar una instancia

Selecciona una instancia y pulsa <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd>). La instancia se convierte en un marco regular sin enlace al componente original.

## Sincronización en vivo

Editar un componente actualiza todas sus instancias automáticamente. Propiedades sincronizadas:

- Ancho y alto
- Rellenos, trazos y efectos
- Opacidad y radios de esquinas
- Propiedades de layout

## Overrides

Las instancias pueden sobreescribir propiedades específicas sin romper el enlace de sincronización. Cuando se sobreescribe una propiedad en una instancia, esa propiedad se omite durante la sincronización — las demás propiedades continúan actualizándose desde el componente principal.

## Selección

Clic selecciona el componente. **Doble clic** para entrar y seleccionar hijos.

## Tratamiento visual

| Elemento | Apariencia |
|----------|------------|
| Etiqueta de componente | Morada con icono de diamante, siempre visible |
| Etiqueta de instancia | Morada con icono de diamante, siempre visible |
| Borde de conjunto | Contorno morado punteado |

## Atajos de teclado

| Acción | Mac | Windows / Linux |
|--------|-----|-----------------|
| Crear componente | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd> |
| Crear conjunto | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Desenlazar instancia | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> |
