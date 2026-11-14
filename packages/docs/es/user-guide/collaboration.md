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
- **Vista:** posibilidad de seguir el encuadre de otra persona;
- **Agentes:** el chat con AI integrado, los chats de ACP y Pi harness y cada cliente MCP conectado aparecen como cursores sobre las capas que leen o editan, con una etiqueta con contorno que muestra una chispa y un nombre en clave como *Fern*. Mientras el chat transmite JSX, su cursor recorre los elementos a medida que aparecen y los contornea. El cursor y el contorno tienen el color de la persona que ejecuta el agente, para que se sepa de quién es. Solo se comparten su nombre, tipo, modelo, estado, página, posición y capas editadas, nunca los prompts ni las respuestas.

## Modo seguimiento

Haz clic en el avatar de un participante en la barra superior para seguir su vista. Tu lienzo se desplaza y amplía para coincidir con la suya, y un marco de su color con una barra «Siguiendo a …» indica a quién sigues. Para dejar de seguir, vuelve a hacer clic en el avatar, pulsa <kbd>Esc</kbd>, o haz clic, desplázate, haz zoom o cambia de página por tu cuenta.

Tus propios agentes, el chat de IA y clientes MCP como Claude Code o Cursor, se siguen automáticamente mientras trabajan, para mantener a la vista lo que editan. Desactívalo con el botón de la mira en la parte superior del panel de IA. Si dejas de seguir a un agente mientras trabaja, no se vuelve a seguir hasta que termine; en su siguiente ejecución se sigue de nuevo.

Un avatar cuenta los agentes que ejecuta esa persona. Pasa el cursor por encima para ver cada agente, qué hace y en qué página, y haz clic en **Seguir** junto a un agente para mantener a la vista la página y las capas que edita; el seguimiento continúa entre sus respuestas y termina cuando se va. El botón situado después de los avatares enumera a todos los presentes en la sala con sus agentes y funciona con el teclado. Tu propio avatar enumera tus agentes —haz clic en uno para cambiarle el nombre— y ofrece **Salir de la sala**.

El panel para compartir enumera a todos los presentes en la sala con los agentes que ejecutan, qué hace cada uno y en qué página. Sigue a un agente del mismo modo para mantener a la vista la página y las capas que edita; el seguimiento continúa entre sus respuestas y termina cuando se va. Haz doble clic en uno de tus agentes para cambiarle el nombre.

## Arquitectura

Yjs mantiene el estado compartido mediante CRDT. Trystero descubre participantes y establece las conexiones WebRTC. Un servidor de señalización ayuda a iniciar la conexión, pero no retransmite el documento.

No es necesario crear una cuenta ni desplegar una infraestructura propia. La calidad de conexión depende de la red y de la posibilidad de establecer WebRTC entre los participantes.

## Privacidad

El contenido no se almacena en un servidor de OpenPencil. Cada participante conserva una copia local. Comparte el enlace solo con personas de confianza: quien conoce la sala puede intentar unirse mientras esté activa.

## Finalizar

Al cerrar la sesión se eliminan los participantes remotos y sus cursores. Los cambios ya sincronizados permanecen en el documento local.
