# Stack tecnológico

## Tecnologías principales

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| **Renderizado** | Skia CanvasKit WASM | Mismo motor que Figma — rendimiento probado, acelerado por GPU, píxel-perfecto |
| **Framework UI** | Vue 3 + VueUse | API de composición reactiva, excelente soporte TypeScript |
| **Componentes** | Reka UI | Primitivas UI headless y accesibles (tree, slider, etc.) |
| **Estilado** | Tailwind CSS 4 | Utility-first, iteración rápida, tema oscuro |
| **Layout** | Yoga WASM | Motor CSS flexbox de Meta, probado en React Native |
| **Formato de archivo** | Kiwi binario + Zstd | Formato propio de Figma — compacto, parseo rápido, compatible con .fig |
| **Colaboración** | Trystero + Yjs | P2P WebRTC vía señalización MQTT, sync CRDT, persistencia y-indexeddb |
| **Color** | culori | Conversiones de espacio de color (HSV, RGB, hex) |
| **IA/MCP** | MCP SDK + Hono | 75 herramientas para codificación IA, transportes stdio + HTTP |
| **Desktop** | Tauri v2 | ~5 MB app nativa (vs ~100 MB de Electron), backend Rust |
| **Build** | Vite 7 | HMR rápido, módulos ES nativos |
| **Testing** | Playwright + bun:test | Regresión visual (E2E) + tests unitarios rápidos |
| **Linting** | oxlint | Basado en Rust, órdenes de magnitud más rápido que ESLint |
| **Formateo** | oxfmt | Formateador basado en Rust |
| **Verificación de tipos** | typescript-go (tsgo) | Implementación nativa en Go del verificador de tipos TypeScript |

## Dependencias principales

```json
{
  "canvaskit-wasm": "^0.40.0",
  "vue": "^3.5.29",
  "yoga-layout": "^3.2.1",
  "reka-ui": "^2.8.2",
  "tailwindcss": "^4.2.1",
  "culori": "^4.0.2",
  "fzstd": "^0.1.1",
  "fflate": "^0.8.2",
  "trystero": "^0.20.0",
  "yjs": "^13.6.24",
  "y-indexeddb": "^9.0.12"
}
```

## ¿Por qué no...

### ¿Por qué no renderizado SVG?

SVG es lento para documentos complejos. Cada nodo es un elemento DOM — 10.000 nodos significan 10.000 elementos DOM con overhead de layout, pintado y composición. CanvasKit dibuja todo en una única superficie GPU.

### ¿Por qué no Electron (como Figma desktop)?

Tauri v2 usa el webview del sistema (~5 MB) en lugar de empaquetar Chromium (~100 MB). El backend Rust proporciona rendimiento nativo para E/S de archivos e integración con el sistema.

### ¿Por qué no React?

El proyecto migró de React a Vue 3 tempranamente. El sistema de reactividad de Vue y los composables de VueUse resultaron más ergonómicos.

### ¿Por qué no un motor de layout propio?

Yoga es mantenido por Meta, probado en miles de millones de dispositivos React Native e implementa la especificación CSS flexbox.

## Tecnologías planificadas

| Tecnología | Propósito | Fase |
|-----------|---------|-------|
| CSS Grid en Yoga | Auto layout basado en grid | Bloqueado por upstream (facebook/yoga#1893) |
