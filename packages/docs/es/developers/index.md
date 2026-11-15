---
layout: doc
title: Desarrolladores
description: Automatiza archivos de diseño desde la terminal, deja que un agente de AI controle el editor o crea tu propio editor sobre el motor de OpenPencil.
---

# Desarrolladores

Todo lo que hace el editor está disponible también fuera de él: desde la terminal, para agentes de AI y desde código. Todo funciona sobre el mismo motor que la aplicación, así que lo que puedes hacer con clics también puedes hacerlo con un script. Elige la herramienta según lo que quieras construir.

## Automatizar archivos de diseño

La CLI `openpencil` lee, revisa, exporta y edita archivos `.fig` y `.pen` sin abrir la aplicación, y genera JSON para scripts y CI. Mientras la aplicación de escritorio está en ejecución, la misma CLI la controla: abrir y guardar documentos, deshacer, cambiar ajustes y llamar a cualquier herramienta del editor.

<SdkCardGroup>
  <SdkCard title="Referencia de comandos" to="/reference/cli" description="Todos los comandos y sus opciones." />
  <SdkCard title="Examinar archivos" to="/es/developers/cli/inspecting" description="Páginas, nodos, consultas XPath y variables de diseño." />
  <SdkCard title="Exportar" to="/es/developers/cli/exporting" description="Imágenes, JSX, HTML, variables de diseño e historias de Storybook." />
  <SdkCard title="Scripting" to="/es/developers/cli/scripting" description="La API de plugins de Figma y una API openpencil mediante eval." />
</SdkCardGroup>

## Deja que un agente de AI diseñe

El servidor MCP ofrece a Claude Code, Cursor, Windsurf o cualquier cliente MCP las 90 herramientas que usa el asistente integrado, para que un agente pueda leer, crear y modificar diseños. Los agentes describen la interfaz en JSX, que crea marcos, texto y disposición automática reales.

<SdkCardGroup>
  <SdkCard title="Servidor MCP" to="/developers/mcp-server" description="Conecta un cliente mediante stdio o HTTP." />
  <SdkCard title="Renderizador JSX" to="/es/developers/jsx-renderer" description="Crea árboles de componentes a partir de JSX y exporta una selección de vuelta a JSX." />
  <SdkCard title="Referencia de JSX de diseño" to="/reference/design-authoring" description="Qué acepta el JSX de diseño." />
</SdkCardGroup>

Si prefieres usar un agente dentro de la aplicación, consulta [Chat con AI](../user-guide/ai-chat) y [Agentes de programación](/user-guide/coding-agents).

## Crea tu propio editor

`@open-pencil/vue` es el Vue SDK con el que está construida la aplicación: contexto del editor, lienzo, selección, comandos y paneles sin estilos que diseñas tú. Las bibliotecas del motor funcionan sin Vue, en el navegador o en un servidor.

<SdkCardGroup>
  <SdkCard title="Vue SDK" to="/es/developers/sdk/" description="Integra el editor o crea uno especializado." />
  <SdkCard title="API nativas de JavaScript" to="/developers/native-api" description="Las bibliotecas del motor, sin la interfaz." />
  <SdkCard title="Esquema de URL" to="/es/developers/url-scheme" description="Enlaza una página directamente a una capa en la aplicación." />
</SdkCardGroup>

## Por dentro

<SdkCardGroup>
  <SdkCard title="Referencia" to="/reference/node-types" description="Tipos de nodos, el grafo de escena, la correspondencia DOM/CSS y el formato de archivo." />
  <SdkCard title="Contribuir" to="/development/contributing" description="Compila la aplicación, ejecuta las pruebas y envía un cambio." />
</SdkCardGroup>
