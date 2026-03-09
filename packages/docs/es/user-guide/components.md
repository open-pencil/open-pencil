---
title: Componentes
description: Componentes reutilizables, instancias, overrides y sincronización en OpenPencil.
---
# Componentes

Los componentes son elementos de diseño reutilizables. Edita el componente principal y todas sus instancias se actualizan automáticamente.

## Crear un componente

Selecciona un marco o grupo y pulsa <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>). La selección se convierte en un componente reutilizable.

Los componentes muestran una etiqueta morada con icono de diamante.

## Conjuntos de componentes

Selecciona dos o más componentes y pulsa <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd>) para combinarlos en un conjunto de componentes — un contenedor con borde morado punteado. Los conjuntos son útiles para agrupar variantes (ej. estados de botón).

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
