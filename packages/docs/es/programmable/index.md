---
layout: doc
title: Automatización y API
description: AI, MCP, CLI, JSX y API de plugins de Figma para automatizar diseños.
---

# Automatización y API

OpenPencil trata los archivos de diseño como datos estructurados. Las operaciones del editor —crear formas, modificar rellenos, configurar la disposición automática o exportar recursos— también están disponibles mediante CLI, agentes de AI y API.

## Chat con AI

El asistente integrado puede ejecutar más de 90 herramientas. Una instrucción puede cambiar las sombras de varios botones, crear un componente con variante oscura o exportar todos los marcos de una página a escala 2×.

[Chat con AI →](./ai-chat)

## MCP

Claude Code, Cursor, Windsurf y otros clientes MCP pueden usar las mismas herramientas. El servidor admite stdio y HTTP y mantiene sesiones independientes.

[Servidor MCP →](/programmable/mcp-server)

## CLI

La CLI examina, exporta y analiza archivos `.fig` sin abrir el editor. Puede listar páginas y objetos, buscar contenido, extraer variables de diseño y generar PNG. `--json` facilita la integración con CI y otros programas.

[CLI →](./cli/inspecting)

## JSX

Una interfaz puede describirse de forma declarativa con JSX. Una llamada crea un árbol completo con marcos, texto, disposición automática, rellenos y contornos.

En sentido inverso, OpenPencil exporta una selección como JSX o HTML con clases Tailwind, útil como base para implementar, revisar código o continuar el trabajo con AI.

[Renderizador JSX →](./jsx-renderer)

## API de plugins de Figma

El comando `eval` ejecuta JavaScript con un objeto global `figma` compatible. Permite consultar y modificar documentos, crear componentes y variables y guardar el resultado.

[Scripting con `eval` →](./cli/scripting)

OpenPencil tiene licencia MIT y guarda los documentos localmente. Los archivos `.fig` se pueden examinar, transformar, procesar en CI o proporcionar como contexto a un modelo sin depender de un proveedor de alojamiento concreto.
