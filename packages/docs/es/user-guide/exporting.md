---
title: Exportar
description: Exportar imágenes (PNG, JPG, WEBP, SVG) y gestionar archivos .fig en OpenPencil.
---
# Exportar

## Exportación de imágenes

Selecciona un nodo y usa la sección Export en el panel de propiedades.

### Configuración de exportación

- **Escala** — 0,5×, 0,75×, 1×, 1,5×, 2×, 3× o 4× (oculta para SVG — los vectores son independientes de la resolución)
- **Formato** — PNG (fondo transparente), JPG (fondo blanco), WEBP (fondo transparente), SVG (vector)

### Métodos de exportación

| Método | Mac | Windows / Linux |
|--------|-----|-----------------|
| Atajo de teclado | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Menú contextual | Clic derecho <kbd>→</kbd> Exportar… | Clic derecho <kbd>→</kbd> Exportar… |
| Panel de propiedades | Botón "Exportar" | Botón "Exportar" |

## Copiar como

El menú contextual **Copiar como** ofrece formatos adicionales:

| Acción | Mac | Windows / Linux |
|--------|-----|-----------------|
| Copiar como texto | — | — |
| Copiar como SVG | — | — |
| Copiar como PNG | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>C</kbd> |
| Copiar como JSX | — | — |

## Operaciones de archivo .fig

| Acción | Mac | Windows / Linux |
|--------|-----|-----------------|
| Abrir | <kbd>⌘</kbd><kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>O</kbd> |
| Guardar | <kbd>⌘</kbd><kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> |
| Guardar como | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>S</kbd> |

Los archivos guardados se comprimen e incluyen una imagen en miniatura para vista previa.

### Compatibilidad de ida y vuelta

Los archivos exportados desde OpenPencil se pueden abrir en Figma, y viceversa. El formato .fig preserva todos los tipos de nodos, propiedades, rellenos, trazos, efectos, datos vectoriales y configuración de layout.

## Consejos

- Usa escala 2× o 3× para pantallas de alta resolución.
- JPG siempre usa fondo blanco — usa PNG o WEBP si necesitas transparencia.
- Usa SVG para edición vectorial posterior en editores de código o Illustrator.
