---
title: Variables
description: Crear variables, colecciones y modos, y vincularlas a propiedades de diseño.
---

# Variables

Las variables almacenan valores reutilizables, como colores y espaciados. Una propiedad vinculada se actualiza cuando cambia la variable.

## Abrir el editor

Sin objetos seleccionados, la pestaña **Diseño** muestra las propiedades de la página. El icono de ajustes de la sección Variables abre el editor.

## Colecciones y modos

Una colección agrupa variables relacionadas. Cada colección puede tener modos, por ejemplo Claro y Oscuro, con un valor distinto por variable.

- Un clic cambia de colección.
- Doble clic en el nombre permite renombrarla.
- Los botones de la cabecera crean colecciones y modos.

## Editar variables

La tabla contiene el nombre, el tipo y una columna por modo. Haz clic en una celda para editarla.

Tipos admitidos:

- color;
- número;
- texto;
- booleano.

Los colores se editan con un campo y un selector. Los números pueden representar dimensiones y espaciados.

## Enlazar rellenos y contornos

Abre el selector de variables desde el control de color y elige una variable compatible. El control muestra el enlace en lugar de copiar el valor. Cambiar el valor manualmente elimina el enlace solo en la primera modificación real, no al enfocar el campo.

## Alias

Una variable puede hacer referencia a otra. OpenPencil resuelve la cadena según el modo activo y detecta referencias circulares.

## Importación y exportación

Las variables se conservan al importar y exportar `.fig`. La CLI también puede listarlas y modificarlas mediante la API compatible con plugins de Figma.
