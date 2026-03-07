# Arquitectura

## Vista general del sistema

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Editor (Web)                           │  │
│  │                                                            │  │
│  │  Vue 3 UI                   Skia CanvasKit (WASM, 7MB)    │  │
│  │  - Barra de herramientas    - Renderizado vectorial        │  │
│  │  - Paneles                  - Modelado de texto            │  │
│  │  - Propiedades              - Procesamiento de imágenes    │  │
│  │  - Capas                    - Efectos (desenfoque, sombra) │  │
│  │  - Selector de color        - Exportación (PNG, SVG, PDF)  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              Capa de formato de archivo                │ │  │
│  │  │  .fig import/export ── Kiwi codec ── .svg (previsto) │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  MCP Server (75+ tools, stdio+HTTP) P2P Collab (Trystero + Yjs) │
└──────────────────────────────────────────────────────────────────┘
```

## Diseño del editor

La interfaz sigue el layout UI3 de Figma — barra de herramientas abajo, navegación a la izquierda, propiedades a la derecha:

- **Panel de navegación (izquierda)** — Árbol de capas, panel de páginas, biblioteca de assets (previsto)
- **Canvas (centro)** — Canvas infinito con renderizado CanvasKit, zoom/pan
- **Panel de propiedades (derecha)** — Secciones contextuales: Apariencia, Relleno, Trazo, Tipografía, Layout, Posición
- **Barra de herramientas (abajo)** — Selección de herramienta: Seleccionar, Frame, Sección, Rectángulo, Elipse, Línea, Texto, Pluma, Mano

## Componentes

### Renderizado (CanvasKit WASM)

El mismo motor de renderizado que Figma. CanvasKit proporciona dibujo 2D acelerado por GPU con:
- Formas vectoriales (rectángulo, elipse, ruta, línea, estrella, polígono)
- Modelado de texto vía Paragraph API
- Efectos (sombras, desenfoques, modos de mezcla)
- Exportación (PNG, SVG, PDF)

El binario WASM de 7 MB se carga al inicio y crea una superficie GPU en el canvas HTML.

### Grafo de escena

`Map<string, Node>` plano con cadenas GUID como claves. Estructura de árbol vía referencias `parentIndex`. Proporciona búsqueda O(1), recorrido eficiente, hit testing y consultas de área rectangular para selección por marquesina.

Véase [Referencia del grafo de escena](/reference/scene-graph) para los detalles internos.

### Motor de layout (Yoga WASM)

Yoga de Meta proporciona cálculo de layout CSS flexbox. Un adaptador delgado mapea nombres de propiedades de Figma a equivalentes de Yoga:

| Propiedad Figma | Equivalente Yoga |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Formato de archivo (Kiwi binario)

Reutiliza el probado codec binario Kiwi de Figma con 194 definiciones de mensaje/enum/struct. Pipeline de importación `.fig`: parsear cabecera → descomprimir Zstd → decodificar Kiwi → NodeChange[] → grafo de escena. El pipeline de exportación invierte el proceso: grafo de escena → NodeChange[] → codificar Kiwi → comprimir Zstd → ZIP con miniatura.

Véase [Referencia del formato de archivo](/reference/file-format) para más detalles.

### Deshacer/Rehacer

Patrón de comando inverso. Antes de aplicar cualquier cambio, se captura un snapshot de los campos afectados. El snapshot se convierte en la operación inversa. El batching agrupa cambios rápidos (como arrastre) en entradas de deshacer únicas.

### Portapapeles

Portapapeles bidireccional compatible con Figma. Codifica/decodifica binario Kiwi (mismo formato que archivos .fig) usando eventos nativos de copiar/pegar del navegador (síncronos, no la API asíncrona del Clipboard). El pegado gestiona escalado de rutas vectoriales, población de hijos de instancia, detección de conjuntos de componentes y aplicación de overrides.

### Servidor MCP

`@open-pencil/mcp` expone 75 herramientas core + 3 herramientas de gestión de archivos para herramientas de codificación IA. Dos transportes: stdio para Claude Code/Cursor/Windsurf, HTTP con Hono + Streamable HTTP para scripts y CI. Las herramientas se definen una vez en `packages/core/src/tools/schema.ts` y se adaptan para chat IA (valibot), MCP (zod) y CLI (comando eval).

### Colaboración P2P

Colaboración peer-to-peer en tiempo real vía Trystero (WebRTC) + Yjs CRDT. Sin servidor relay — señalización a través de brokers MQTT públicos, STUN/TURN para traversal NAT. El protocolo de awareness proporciona cursores en vivo, selecciones y presencia. Persistencia local vía y-indexeddb.
