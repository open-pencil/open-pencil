---
title: Colaboración
description: Edición P2P en tiempo real mediante WebRTC y Yjs, sin servidor central.
---

# Colaboración

OpenPencil permite editar un documento entre varias personas en tiempo real. La conexión es P2P: los cambios viajan directamente entre participantes mediante WebRTC.

## Iniciar una sesión

Abre el menú de colaboración, crea una sala y comparte el enlace. El identificador se genera con aleatoriedad criptográfica y no contiene datos del documento.

Quien abre el enlace entra en la misma sala. El documento inicial se sincroniza automáticamente.

## Datos compartidos

- **Documento:** cambios en formas, texto, propiedades y disposición;
- **Presencia:** nombre, color, selección y página activa;
- **Cursores:** posición de cada participante;
- **Vista:** posibilidad de seguir el encuadre de otra persona.

## Arquitectura

Yjs mantiene el estado compartido mediante CRDT. Trystero descubre participantes y establece las conexiones WebRTC. Un servidor de señalización ayuda a iniciar la conexión, pero no retransmite el documento.

No es necesario crear una cuenta ni desplegar una infraestructura propia. La calidad de conexión depende de la red y de la posibilidad de establecer WebRTC entre los participantes.

## Privacidad

El contenido no se almacena en un servidor de OpenPencil. Cada participante conserva una copia local. Comparte el enlace solo con personas de confianza: quien conoce la sala puede intentar unirse mientras esté activa.

## Finalizar

Al cerrar la sesión se eliminan los participantes remotos y sus cursores. Los cambios ya sincronizados permanecen en el documento local.
