---
title: Edición de objetos vectoriales
description: "Cómo editar la geometría de trazados vectoriales: anclas, manejadores de Bézier, modificadores y acciones de la herramienta pluma en el modo de edición."
---

# Edición de objetos vectoriales

El modo de edición de objetos vectoriales permite modificar la **geometría** de una curva: posición de las anclas, forma de los segmentos y manejadores de Bézier.  
En este modo se edita el trazado en sí, no las transformaciones estándar del objeto.

## Entrar al modo

- Selecciona un objeto vectorial con la herramienta Selección.
- **Haz doble clic en la curva**.

Esto activa la edición de geometría para el vector seleccionado.

## Salir del modo

- Pulsa <kbd>Escape</kbd>.
- O cambia a otro contexto de edición.

## Qué cambia en este modo

- El cuadro de transformación habitual queda desactivado para el objeto.
- Se habilita la edición de anclas, segmentos y manejadores.
- El cursor no cambia a redimensionar/rotar en las esquinas del cuadro delimitador.

## Acciones básicas

### Mover una ancla

- Arrastra un punto de ancla.
- Los segmentos conectados y la forma del trazado se actualizan en tiempo real.

### Editar un manejador de Bézier

- Arrastra un manejador sobre el ancla.
- Por defecto, el comportamiento sigue la composición de manejadores actual del ancla.

## Modificadores al arrastrar manejadores

| Acción | Mac | Windows / Linux |
|--------|-----|-----------------|
| Continuo (Suave / Continuo) | <kbd>Cmd</kbd> + arrastrar | <kbd>Ctrl</kbd> + arrastrar |
| Esquina (manejadores independientes) | <kbd>Option</kbd> + arrastrar | <kbd>Alt</kbd> + arrastrar |
| Bloqueo de dirección (solo longitud) | <kbd>Shift</kbd> + arrastrar | <kbd>Shift</kbd> + arrastrar |

### Continuo: <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + arrastrar

- El manejador activo queda restringido a la misma línea que el manejador opuesto.
- Solo cambia la longitud del manejador activo.
- Úsalo para transiciones suaves sin quiebre de esquina.

### Esquina: <kbd>Option</kbd>/<kbd>Alt</kbd> + arrastrar

- El manejador activo se edita de forma independiente.
- El manejador opuesto permanece en su lugar.
- Úsalo para crear una transición de esquina pronunciada.

### Bloqueo de dirección: <kbd>Shift</kbd> + arrastrar

Para anclas con composición **Continua** o **Simétrica**:

- la dirección del manejador queda bloqueada al valor que tenía **antes de iniciar el arrastre actual**;
- al arrastrar solo cambia la longitud del manejador (o de ambos, según la composición).

## Cambio de curvatura arrastrando un ancla

Al arrastrar un ancla mientras se mantiene <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>, el editor selecciona el manejador de destino según la **dirección de unión al segmento** en esa ancla (no por proximidad al punto vecino más cercano).  
Esto también funciona en anclas de malla vectorial con múltiples ramas: una vez resuelto, el manejador de destino queda bloqueado durante el arrastre actual.

## Usar la herramienta pluma en el modo de edición

Con la herramienta pluma activa:

- **Clic en un segmento** para insertar una nueva ancla (dividir el segmento).
- **Clic en el extremo de un trazado abierto** para retomar el dibujo desde ese punto.
- **Option/Alt + clic en un ancla** para eliminarla (cuando la topología lo permite).

Para el comportamiento de creación y cierre de trazados, consulta [Herramienta pluma](./pen-tool.md).

## Flujo de trabajo práctico

1. Dibuja una forma con la herramienta pluma.
2. Haz doble clic en la curva para entrar al modo de edición de objetos vectoriales.
3. Mueve las anclas para refinar la silueta.
4. Arrastra los manejadores:
   - con <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> para transiciones continuas y suaves,
   - con <kbd>Option</kbd>/<kbd>Alt</kbd> para ediciones independientes,
   - con <kbd>Shift</kbd> para editar solo la longitud.
5. Pulsa <kbd>Escape</kbd> para salir.
