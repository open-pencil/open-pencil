---
title: Vue SDK
description: Construye editores con OpenPencil usando composables headless y primitivos de Vue.
---

# Vue SDK

`@open-pencil/vue` existe para que OpenPencil pueda ser más que una aplicación de diseño independiente.

El objetivo es convertir OpenPencil en un toolkit que puedas integrar en otros productos, herramientas internas y editores específicos de flujo de trabajo — no solo una interfaz predeterminada.

La aplicación OpenPencil es una composición de ese toolkit. El SDK es la forma en que construyes una diferente.

Te ofrece:

- contexto de editor inyectado
- renderizado de canvas respaldado por CanvasKit
- composables de selección, comandos, menú, panel de propiedades y variables
- primitivos estructurales headless como `PageListRoot`, `PropertyListRoot` y `ToolbarRoot`
- primitivos de i18n integrados para menús, paneles, diálogos y selectores de idioma personalizados

## Empieza aquí

<SdkCardGroup>
  <SdkCard title="Primeros pasos" to="/programmable/sdk/getting-started" description="Instala el paquete, crea una instancia del editor y monta los primitivos principales." />
  <SdkCard title="Arquitectura" to="/programmable/sdk/architecture" description="Comprende cómo encajan los composables, primitivos y el contexto del editor." />
  <SdkCard title="Guías" to="/programmable/sdk/guides/custom-editor-shell" description="Construye shells personalizados, paneles de propiedades y paneles de navegación." />
  <SdkCard title="Referencia de API" to="/programmable/sdk/api/" description="Explora componentes, composables y APIs públicas avanzadas." />
</SdkCardGroup>

## Por qué existe el SDK

Diferentes productos y equipos necesitan diferentes superficies de edición.

A veces necesitas un editor de diseño completo. A veces necesitas un canvas enfocado dentro de otra aplicación. A veces necesitas una herramienta de flujo de trabajo interna, un editor de plantillas, o una superficie de edición asistida por IA construida alrededor de un caso de uso específico.

El SDK es la capa que hace posibles esos escenarios.

## Principios de diseño

- **Headless primero**: lógica y estructura, no estilos de la app
- **Composable sobre wrapper**: usa composables cuando no hay coordinación estructural significativa
- **API pública intencional**: exportaciones estables desde `packages/vue/src/index.ts`
- **Integración con el framework**: integración de Vue sobre `@open-pencil/core`

## Cómo entender el paquete

El SDK tiene dos capas principales:

1. **Composables** para el estado del editor y las acciones
2. **Primitivos** para la estructura significativa de UI

Si solo necesitas el estado del editor y las acciones, empieza con composables.
Si estás construyendo bloques reutilizables de UI para el editor, empieza con primitivos.

## Secciones de la API

- [Componentes](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [Avanzado](/programmable/sdk/api/advanced/)
