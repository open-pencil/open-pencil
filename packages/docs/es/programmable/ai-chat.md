---
title: Chat con AI
description: Asistente integrado con más de 90 herramientas para crear, modificar y analizar diseños.
---

# Chat con AI

Pulsa <kbd>⌘</kbd><kbd>J</kbd> o <kbd>Ctrl</kbd><kbd>J</kbd>. El asistente puede crear formas, modificar estilos, configurar disposiciones, trabajar con componentes y analizar el documento.

## Configurar modelos

1. Abre el chat.
2. Selecciona el icono de ajustes.
3. Añade un perfil y configura conexión, identificador del modelo, credenciales y capacidades.

Puedes guardar varios perfiles y asignarlos por separado a diseño, revisiones, tareas rápidas y entrada de imágenes. Los perfiles que comparten una conexión reutilizan la misma credencial almacenada de forma segura.

## Proveedores

OpenPencil admite conexiones compatibles con OpenAI y Anthropic, además de OpenRouter, Google, Z.ai y proveedores locales. Los modelos y capacidades disponibles dependen de cada servicio.

OpenPencil no usa un servidor intermediario. Las solicitudes se envían directamente al proveedor; en el navegador se aplican sus políticas CORS. La fiabilidad de las llamadas de herramientas en flujo continuo también puede variar entre despliegues. Consulta [Compatibilidad BYOK](/programmable/byok-provider-compatibility) para ver mediciones y pasos de reproducción.

## Agentes ACP y MCP remoto

La aplicación de escritorio puede ejecutar agentes ACP y conectarlos a servidores remotos de confianza que implementen [Model Context Protocol](https://modelcontextprotocol.io/). En **Ajustes → Conexiones MCP**, añade un extremo HTTP transmisible, un nombre y, si hace falta, un token Bearer.

El token se guarda en el almacén seguro de credenciales, no en los ajustes ordinarios, y solo se recupera al iniciar la sesión ACP.

## Herramientas

Las herramientas cubren lectura, creación, modificación, estructura, variables, vectores, análisis, descripción, generación de código e imágenes de stock. Cada llamada actúa sobre el editor activo y participa en su historial de deshacer cuando corresponde.

## Privacidad y costes

Las solicitudes se envían al proveedor configurado. Revisa sus condiciones, política de datos y precios antes de enviar documentos sensibles. OpenPencil no incluye créditos de modelos.
