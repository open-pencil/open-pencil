# Arquitectura

## Vista general del sistema

`mermaid
graph TB
    subgraph Tauri["Tauri v2 Shell"]
        subgraph Editor["Editor (Web)"]
            UI["Vue 3 UI<br/>Toolbar · Panels · Properties<br/>Layers · Color Picker"]
            Skia["Skia CanvasKit (WASM, 7MB)<br/>Vector rendering · Text shaping<br/>Effects · Export"]
            subgraph Core["Core Engine (TS)"]
                SG[SceneGraph] --- Layout[Layout - Yoga]
                SG --- Selection
                Undo[Undo/Redo] --- Constraints
                Constraints --- HitTest[Hit Testing]
            end
            subgraph FileFormat["File Format Layer"]
                FigIO[".fig import/export"] --- Kiwi[Kiwi codec]
                Kiwi --- SVG[SVG export]
            end
        end
        MCP["MCP Server (90 tools, stdio+HTTP)"]
        Collab["P2P Collab (Trystero + Yjs)"]
    end
`

## Diseño del editor

La interfaz sigue el layout UI3 de Figma — barra de herramientas abajo, navegación a la izquierda, propiedades a la derecha:

- **Panel de navegación (izquierda)** — Árbol de capas, panel de páginas
- **Canvas (centro)** — Canvas infinito con renderizado CanvasKit, zoom/pan
- **Panel de propiedades (derecha)** — Secciones contextuales: Apariencia, Relleno, Trazo, Tipografía, Layout, Posición
- **Barra de herramientas (abajo)** — Selección de herramienta: Seleccionar, Frame, Sección, Rectángulo, Elipse, Línea, Texto, Pluma, Mano

## Componentes

### Renderizado (CanvasKit WASM)

El mismo motor de renderizado que Figma. CanvasKit proporciona dibujo 2D acelerado por GPU con formas vectoriales, modelado de texto vía Paragraph API, efectos (sombras, desenfoques, modos de mezcla) y exportación (PNG, SVG). El binario WASM de 7 MB se carga al inicio y crea una superficie GPU en el canvas HTML.

El renderer está dividido en módulos enfocados en `packages/core/src/renderer/`: recorrido de escena, overlays, rellenos, trazos, formas, efectos, reglas, etiquetas y cursores remotos.

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

Reutiliza el códec binario Kiwi de Figma con 194 definiciones de mensaje/enum/struct. Importación: parsear cabecera → descomprimir Zstd → decodificar Kiwi → `NodeChange`[] → grafo de escena. La exportación invierte el proceso con generación de miniatura.

Véase [Referencia del formato de archivo](/reference/file-format) para más detalles.

### IA y herramientas

Las herramientas se definen una vez en `packages/core/src/tools/`, divididas por dominio: read, create, modify, structure, variables, vector, analyze. Cada herramienta tiene parámetros tipados y una función `execute(figma, args)`. Los adaptadores las convierten para:

- **Chat IA** — schemas valibot, conectados a OpenRouter
- **Servidor MCP** — schemas zod, transportes stdio + HTTP
- **CLI** — disponibles vía el comando `eval`

87 herramientas core + 3 herramientas de gestión de archivos MCP = 90 en total.

### Deshacer/Rehacer

Patrón de comando inverso. Antes de aplicar cualquier cambio, se captura un snapshot de los campos afectados. El snapshot se convierte en la operación inversa. El batching agrupa cambios rápidos (como arrastre) en entradas de deshacer únicas.

### Portapapeles

Portapapeles bidireccional compatible con Figma. Codifica/decodifica binario Kiwi (mismo formato que archivos .fig) usando eventos nativos de copiar/pegar del navegador. Gestiona escalado de rutas vectoriales, hijos de instancia, detección de conjuntos de componentes y aplicación de overrides.

### Colaboración P2P

Colaboración peer-to-peer en tiempo real vía Trystero (WebRTC) + Yjs CRDT. Sin servidor relay — señalización a través de brokers MQTT públicos, STUN/TURN para traversal NAT. El protocolo de awareness proporciona cursores en vivo, selecciones y presencia. Persistencia local vía y-indexeddb.

### Puente RPC CLI-a-App

Cuando la app de escritorio está en ejecución, los comandos CLI se conectan a ella vía WebSocket en lugar de requerir un archivo .fig. El servidor de automatización corre en `127.0.0.1:7600` (HTTP) y `127.0.0.1:7601` (WebSocket). Los comandos se ejecutan contra el estado del editor en vivo, permitiendo que scripts de automatización y agentes IA interactúen con la app en ejecución.

## Próximos pasos

### Conjunto completo de herramientas figma-use

El servidor MCP actualmente expone 90 herramientas. La implementación de referencia en [figma-use](https://github.com/dannote/figma-use) tiene 118. Las herramientas restantes cubren restricciones de layout avanzadas, conexiones de prototipos, edición avanzada de propiedades de componentes y operaciones masivas de documentos.

### Herramientas de diseño para CI

El CLI headless ya soporta `analyze colors/typography/spacing/clusters`. Próximo: integración con GitHub Actions para linting de diseño automatizado y regresión visual en PRs.

### Prototipado

Transiciones entre frames, triggers de interacción (clic, hover, arrastre), gestión de overlays y modo de vista previa a pantalla completa.

### Layout CSS Grid

CSS Grid está soportado a través de un [fork de Yoga](https://github.com/open-pencil/yoga/tree/grid) con PRs de grid cherry-picked del upstream. Selecciona un frame, haz clic en el icono de grid para cambiar de flex a grid. Configura tracks de columnas/filas (fr, px fijos, auto), gaps de columna y fila, y padding por lado.

### Firma de código en Windows

Los binarios de macOS están firmados y notarizados desde la v0.6.0. La firma Authenticode de Windows vía Azure Code Signing está planificada para eliminar la advertencia de SmartScreen.
