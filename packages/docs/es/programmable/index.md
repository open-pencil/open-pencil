---
layout: doc
title: IA y Automatización
description: Cada operación en OpenPencil es scriptable — chat con IA, CLI, renderizador JSX, servidor MCP, colaboración en tiempo real.
---

# IA y Automatización

OpenPencil trata los archivos de diseño como datos. Cada operación disponible en el editor — crear formas, establecer rellenos, gestionar auto-layout, exportar recursos — también está disponible desde la terminal, desde agentes de IA y desde código. Sin plugins que instalar, sin claves de API, sin lista de espera.

La interfaz del editor y las interfaces de automatización usan el mismo motor. Si puedes hacerlo con un clic, puedes hacerlo con un script.

## Chat con IA

El asistente integrado tiene acceso a 87 herramientas que cubren toda la superficie del editor. Describe lo que quieres en lenguaje natural — "añade una sombra de 16px a todos los botones", "crea un componente de tarjeta con variante para modo oscuro", "exporta cada frame de esta página a 2×".

[Chat con IA →](./ai-chat)

## Colaboración

Edición multijugador en tiempo real mediante WebRTC peer-to-peer. Sin servidor, sin cuenta. Comparte un enlace de sala y edita junto con cursores en vivo y modo de seguimiento. El estado del documento se sincroniza mediante CRDT, así que las ediciones se fusionan automáticamente incluso con conexiones inestables.

[Colaboración →](./collaboration)

## Renderizador JSX

Describe la interfaz como JSX — la misma sintaxis que los LLMs ya conocen de React. Una sola llamada puede crear un árbol completo de componentes con frames, texto, auto-layout, rellenos y bordes. Compacto, declarativo y diferenciable.

En la dirección opuesta, exporta cualquier selección de vuelta a JSX con clases Tailwind — útil para entregar a desarrollo o alimentar diseños de vuelta a un LLM.

[Renderizador JSX →](./jsx-renderer)

## CLI

Inspecciona, exporta y analiza archivos `.fig` sin abrir el editor. Lista páginas, busca nodos, extrae tokens de diseño, renderiza a PNG — todo desde la terminal con salida JSON legible por máquinas.

El CLI también se conecta a la aplicación de escritorio en ejecución vía RPC, para que puedas crear scripts del editor mientras lo usas.

[Inspeccionar Archivos](./cli/inspecting) · [Exportar](./cli/exporting) · [Analizar Diseños](./cli/analyzing) · [Scripting](./cli/scripting)

## Servidor MCP

Conecta Claude Code, Cursor, Windsurf o cualquier cliente compatible con MCP a OpenPencil. El servidor expone 90 herramientas para leer, crear y modificar diseños — las mismas herramientas que usa el chat con IA integrado. Funciona sobre stdio o HTTP con soporte de sesiones.

[Servidor MCP →](./mcp-server)

## ¿Por Qué Abierto?

Figma es una plataforma cerrada. Su servidor MCP es de solo lectura. El acceso CDP por navegador fue eliminado en la versión 126. Los archivos de diseño viven en un formato propietario en los servidores de otra empresa. El desarrollo de plugins requiere un runtime personalizado con APIs limitadas.

OpenPencil es la alternativa: código abierto, licencia MIT, cada operación scriptable, datos almacenados localmente. Tus archivos de diseño son tuyos — inspecciónalos, transfórmalos, envíalos a CI, aliméntalos a un LLM. Sin necesidad de permiso.
