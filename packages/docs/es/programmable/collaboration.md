---
title: Colaboración
description: Edición colaborativa en tiempo real vía P2P WebRTC — sin servidor, sin cuenta.
---

# Colaboración

Edita diseños juntos en tiempo real. Los pares se conectan directamente — ningún servidor retransmite tus datos, no se requiere cuenta.

## Compartir una Sala

1. Haz clic en el botón de compartir en la esquina superior derecha
2. Copia el enlace generado (`app.openpencil.dev/share/<room-id>`)
3. Envíalo a tus colaboradores

Cualquiera con el enlace puede unirse. La sala permanece activa mientras al menos un participante tenga la página abierta.

## Qué se Sincroniza

- **Cambios en el documento** — cada edición (formas, texto, propiedades, layout) se sincroniza instantáneamente
- **Cursores** — ve dónde apunta cada colaborador, con su nombre y color
- **Selecciones** — las selecciones resaltadas son visibles para todos

## Modo de Seguimiento

Haz clic en el avatar de un colaborador en la barra superior para seguir su vista. Tu lienzo se desplaza y hace zoom para coincidir con su vista. Haz clic de nuevo para dejar de seguir.

## Cómo Funciona

Los pares se conectan directamente vía WebRTC — tus datos de diseño van directamente de navegador a navegador, nunca a través de un servidor central. El estado del documento usa un CRDT (tipo de datos replicado libre de conflictos), así que las ediciones concurrentes se fusionan automáticamente sin conflictos.

La sala persiste localmente — si refrescas la página, te reconectas con el mismo estado.

## Consejos

- Funciona en el navegador y en la aplicación de escritorio
- Los IDs de sala son criptográficamente aleatorios — solo las personas con el enlace pueden unirse
- Los cursores inactivos se limpian automáticamente cuando alguien se desconecta
