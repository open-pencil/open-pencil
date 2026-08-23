---
title: Exportar
description: Exportar la selección como PNG, JPG, WEBP o SVG y guardar archivos `.fig`.
---

# Exportar

## Exportación de imágenes

Selecciona un objeto y abre **Exportar** en el panel de propiedades. Cada ajuste define:

- formato: PNG, JPG, WEBP o SVG;
- escala o anchura explícita;
- sufijo del nombre;
- calidad para JPG y WEBP.

Un objeto puede tener varios ajustes. La vista previa aparece sobre un fondo de tablero que permite comprobar la transparencia.

También puedes abrir **Exportar…** desde el menú contextual.

## Copiar como

El menú contextual copia la selección al portapapeles como texto, SVG, PNG o JSX.

## Guardar documentos

**Guardar** actualiza el archivo actual. **Guardar como…** permite elegir una ubicación nueva. En Tauri se usan diálogos nativos; Chrome y Edge pueden usar File System Access API; otros navegadores descargan el archivo.

Los archivos `.fig` exportados incluyen datos Kiwi, compresión Zstandard y miniatura. Los componentes y conjuntos se conservan para poder volver a abrir el archivo en Figma.

## Elegir formato

- PNG conserva transparencia y resulta apropiado para interfaces.
- JPG reduce el tamaño de fotografías.
- WEBP ofrece buena compresión para la web.
- SVG mantiene vectores editables y es adecuado para iconos y código.
