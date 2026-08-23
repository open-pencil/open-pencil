---
title: Vue SDK
description: Crea editores basados en OpenPencil con componentes sin estilos y composables para Vue.
---

# Vue SDK

`@open-pencil/vue` permite utilizar OpenPencil más allá de la aplicación de diseño independiente.

Puedes integrar OpenPencil en otros productos, herramientas internas o editores especializados sin depender de la interfaz predeterminada de la aplicación.

La aplicación OpenPencil es solo una de las interfaces creadas con este conjunto de herramientas. El SDK te permite construir la tuya.

El SDK proporciona:

- el contexto del editor mediante dependency injection de Vue;
- renderizado del lienzo con CanvasKit;
- composables para la selección, los comandos, los menús, los paneles de propiedades y las variables;
- componentes estructurales sin estilos como `PageListRoot`, `PropertyListRoot` y `ToolbarRoot`;
- localización para menús, paneles y diálogos, además de componentes para seleccionar el idioma.

## Por dónde empezar

<SdkCardGroup>
  <SdkCard title="Primeros pasos" to="/programmable/sdk/getting-started" description="Instala el paquete, crea una instancia del editor y conecta los componentes principales." />
  <SdkCard title="Arquitectura" to="/programmable/sdk/architecture" description="Descubre cómo se relacionan los composables, los componentes y el contexto del editor." />
  <SdkCard title="Guías" to="/programmable/sdk/guides/custom-editor-shell" description="Crea interfaces de editor, paneles de propiedades y paneles de navegación personalizados." />
  <SdkCard title="Referencia de la API" to="/programmable/sdk/api/" description="Consulta los componentes, los composables y las API de bajo nivel." />
</SdkCardGroup>

## Para qué sirve el SDK

Cada producto y cada equipo necesita una experiencia de edición diferente.

Puede tratarse de un editor de diseño completo, un lienzo integrado en otra aplicación, una herramienta interna, un editor de plantillas o una interfaz especializada con funciones de IA.

## Principios de diseño

- **Sin estilos por diseño:** el SDK proporciona lógica y estructura, pero no impone el aspecto de la aplicación.
- **Composable en lugar de un wrapper innecesario:** si no hay que coordinar la estructura de la interfaz, basta con un composable.
- **API pública deliberada:** las funciones estables se exportan desde `packages/vue/src/index.ts`.
- **Integración estrecha con Vue:** el SDK conecta Vue con las funciones de `@open-pencil/core`.

## Dos niveles de API

El SDK consta de dos niveles principales:

1. Los **composables** proporcionan el estado del editor y las operaciones relacionadas.
2. Los **componentes** definen una estructura de interfaz significativa.

Si solo necesitas el estado y las operaciones del editor, empieza por los composables. Si estás creando partes reutilizables de la interfaz, empieza por los componentes.

## Secciones de la API

- [Componentes](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [API de bajo nivel](/programmable/sdk/api/advanced/)
