# OpenPencil y Penpot: arquitectura y rendimiento

OpenPencil y Penpot son herramientas de diseño de código abierto con objetivos y arquitecturas distintos.

::: info Renderizador WASM de Penpot
Penpot 2.x incluye el renderizador Rust/Skia WASM `render-wasm/v1`, que se activa mediante opciones del servidor o `?wasm=true`. El renderizador SVG sigue siendo el predeterminado. La comparación tiene en cuenta ambas opciones.
:::

## 1. Tamaño del código

| Métrica | OpenPencil | Penpot |
|---------|------------|--------|
| Lines of code | **unas 26.000** | **unas 299.000** |
| Archivos fuente | unos 143 | unos 2.900 |
| Lenguajes | TypeScript, Vue | Clojure, ClojureScript, Rust, JavaScript, SQL, SCSS |
| Renderizador | unas 3.200 líneas, TypeScript | 22.000 líneas, Rust/Skia WASM |
| Interfaz | unas 4.500 líneas | unas 175.000 líneas, CLJS y SCSS |
| Servidor | Ninguno, arquitectura local | 32.600 líneas y 151 archivos SQL |
| Proporción | **1×** | **unas 11×** |

OpenPencil es unas once veces más pequeño. La diferencia se debe sobre todo a la arquitectura, no únicamente al número de funciones.

## 2. Arquitectura

### OpenPencil: un solo proceso cliente

```text
┌─────────────────────────────────┐
│         Tauri native shell      │
│  ┌───────────────────────────┐  │
│  │  Vue 3 + TypeScript       │  │
│  │  Editor + Kiwi codec      │  │
│  │  SceneGraph in TypeScript │  │
│  │  CanvasKit + Yoga WASM    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

Editor, SceneGraph, códec de archivos y renderizador se ejecutan en el mismo proceso. No se necesita servidor, base de datos ni Docker. SceneGraph se almacena como `Map<string, SceneNode>`. TypeScript llama directamente a CanvasKit y Yoga WASM calcula la disposición de forma síncrona.

### Penpot: plataforma Client-Server

```text
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                     │
│  ClojureScript frontend │ Clojure/JVM backend        │
│  Rust/Skia WASM         │ PostgreSQL, Valkey, MinIO  │
│  Chromium exporter      │ MCP server                 │
└───────────────────────────────────────────────────────┘
```

Un despliegue completo de Penpot incluye interfaz, servidor JVM, PostgreSQL, Valkey, MinIO y un exportador basado en Chromium sin interfaz. El entorno de desarrollo requiere Docker Compose, JVM, Node y las herramientas de Rust.

OpenPencil evita latencia de red, serialización entre servicios, coordinación de contenedores y consultas de base de datos en las operaciones habituales. Penpot está pensado como plataforma multiusuario alojada en un servidor; OpenPencil prioriza la edición local con baja latencia.

## 3. Proceso de renderizado

### OpenPencil: TypeScript → CanvasKit WASM

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- Paso directo de TypeScript a WASM.
- SceneGraph permanece en el JavaScript heap y no se serializa antes del Rendering.
- El renderizador contiene unas 3.200 líneas distribuidas en módulos especializados.

### Penpot: ClojureScript → Rust WASM → Skia

Con el renderizador WASM activado:

```text
ClojureScript → JavaScript
  → descomposición y Binary packing en WASM linear memory
  → Rust WASM mediante Emscripten C FFI
  → skia-safe
  → Skia/WebGL
```

Sin WASM, cada Shape se renderiza como SVG DOM element mediante React/Reagent.

En modo WASM, cada UUID se divide en cuatro `u32`, cada transformación en seis `f32`, los rellenos y contornos se codifican en binario y las propiedades básicas de una forma ocupan una estructura de 104 bytes. El renderizador usa caché de teselas, áreas de interés, once superficies y estado global mutable mediante `unsafe { STATE.as_mut() }`.

El Tile system prepara zonas próximas al Viewport y almacena hasta 1.024 Textures. OpenPencil vuelve a renderizar toda la zona visible.

| Aspecto | OpenPencil | Penpot |
|---------|------------|--------|
| JavaScript → WASM | Calls directos con objetos TypeScript | Structures codificadas en Binary |
| Modelo | Render completo del Viewport visible | Tile cache |
| Surfaces | 1 | 11 |
| Caché adicional | Sin Tile cache | Hasta 1.024 Tiles |
| Tamaño del renderizador | unas 3.200 líneas | 22.000 líneas |
| Código no seguro | Ninguno | Estado global mediante `unsafe` |

El Path directo de CanvasKit necesita menos procesamiento intermedio en documentos pequeños y medianos. El Tile system de Penpot puede resultar ventajoso en documentos con más de 100.000 Shapes cuando solo se muestra una zona reducida.

## 4. SceneGraph y modelo de datos

```typescript
nodes: Map<string, SceneNode>
```

OpenPencil ofrece:

- búsqueda por identificador en O(1);
- 29 tipos de objeto del esquema Kiwi de Figma;
- unos 390 campos en `NodeChange`;
- tipos estrictos de TypeScript;
- GUID con formato `sessionID:localID` de Figma.

Penpot mantiene definiciones de tipos propias en Clojure/ClojureScript y Rust. Módulos distintos gestionan colores, componentes, contenedores, rellenos, Grid, modificadores, páginas y rutas. Malli valida esquemas en tiempo de ejecución y los datos de renderizado cruzan el límite CLJS → Rust.

OpenPencil utiliza directamente el esquema Kiwi. Penpot debe mantener sincronizado su modelo entre varios lenguajes.

## 5. Motor de disposición

OpenPencil usa Yoga WASM de forma síncrona:

```typescript
import Yoga from 'yoga-layout'
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
applyYogaLayout(graph, frame, yogaRoot)
```

Penpot mantiene implementaciones propias de Flex y Grid en ClojureScript y Rust WASM. Ambos motores deben producir el mismo resultado.

OpenPencil utiliza Yoga, incluida una variante con Grid. Penpot mantiene varios miles de líneas de código propio de disposición en dos lenguajes.

## 6. Formatos y Figma

### OpenPencil

- Formato Binary Kiwi nativo de Figma.
- Import directo de `.fig`.
- Paste de Kiwi binary data desde Figma Clipboard.
- Wire compatibility con Figma Multiplayer protocol.

### Penpot

- `.penpot` es un ZIP con JSON manifests, Document data, Binary assets y Thumbnails.
- SVG renderer y Export predeterminados; WASM renderer opcional.
- Sin Import nativo de `.fig`.
- Varias Generations del formato con Migration system.

OpenPencil lee `.fig` y Figma Clipboard directamente. Penpot necesita una vía de Import o Export separada.

## 7. Estado y deshacer

OpenPencil usa comandos inversos. Las funciones de avance y retroceso guardan solo el estado necesario; los lotes agrupan varias operaciones.

Penpot usa Potok. `UpdateEvent` modifica el estado y `WatchEvent` ejecuta efectos secundarios mediante RxJS. Deshacer almacena vectores de cambios inversos, limita el historial a 50 entradas y agrupa cambios rápidos en transacciones.

Los cambios serializables encajan con la colaboración basada en servidor, pero aumentan la complejidad. El enfoque de OpenPencil es más directo para un editor de un solo proceso.

## 8. Desarrollo

| Métrica | OpenPencil | Penpot |
|---------|------------|--------|
| Setup | `bun install && bun dev` | Docker Compose, JVM, Node y Rust |
| HMR | Vite | shadow-cljs |
| Types | Strict TypeScript | Malli runtime schemas |
| Desktop | Tauri v2 | Browser |
| Tecnologías principales | TypeScript y Vue | Clojure, ClojureScript, Rust y Docker |

## 9. Rendimiento

| Escenario | OpenPencil | Penpot |
|-----------|------------|--------|
| Arranque en frío | menos de 2 s con WASM | más de 10 s para servidor, cliente y WASM |
| Operación habitual | Dentro de un proceso | Posible recorrido de red |
| Fotograma | Llamada directa a Skia | CLJS → JS → WASM FFI → Skia |
| Memoria base | unos 50 MB en la pestaña del navegador | JVM, base de datos, caché y navegador |
| Sin conexión | Funcionamiento local completo | Requiere servidor |
| 10.000 formas | Una pasada | Renderizador por teselas con once superficies |

## 10. Ventajas de Penpot

1. **Colaboración mediante servidor:** cuentas, control de acceso y almacenamiento central a través de WebSockets.
2. **Exportación PDF:** exportador independiente basado en Chromium.
3. **Sistema de plugins:** ejecución aislada y API de plugins.
4. **Variables de diseño:** compatibilidad integrada.
5. **CSS Grid:** implementación propia; OpenPencil usa una variante de Yoga con Grid.
6. **Alojamiento propio:** despliegue de una plataforma de equipo mediante Docker.
7. **Madurez:** varios años de uso en producción.

## 11. Scripts y extensibilidad

El comando [`eval`](/programmable/cli/scripting) proporciona una API compatible con plugins de Figma para scripts sin interfaz, operaciones por lotes y pruebas automatizadas. Además, el chat con AI, el servidor MCP y la CLI ofrecen 90 herramientas para leer, crear, modificar, estructurar, gestionar variables, editar rutas vectoriales, analizar, comparar, ejecutar operaciones booleanas y ordenar.

Penpot ofrece plugins aislados, pero no una API equivalente para scripting sin interfaz ni integración MCP.

## Resumen

| Área | Ventaja | Motivo |
|------|---------|--------|
| Simplicidad | OpenPencil | Un proceso en lugar de varios servicios |
| Renderizado | OpenPencil | Ruta directa a CanvasKit |
| Código | OpenPencil | Unas 26.000 frente a 299.000 líneas |
| Compatibilidad con Figma | OpenPencil | Kiwi y `.fig` nativos |
| Desarrollo | OpenPencil | TypeScript y Vue frente a Clojure, Rust y Docker |
| Aplicación de escritorio | OpenPencil | Tauri nativo |
| Disposición | OpenPencil | Yoga frente a dos implementaciones propias |
| Colaboración | Ventajas distintas | Penpot: servidor y control de acceso; OpenPencil: P2P sin alojamiento |
| Alojamiento propio | Penpot | Despliegue con Docker |
| Madurez del ecosistema | Penpot | Años de uso en producción |

OpenPencil es un editor compacto de un solo proceso con renderizador CanvasKit y compatibilidad nativa con `.fig`. Penpot es una plataforma cliente-servidor completa con Clojure, ClojureScript, Rust, bases de datos y servicios Docker. Ambos ofrecen colaboración con modelos diferentes. Penpot tiene un ecosistema de plugins y exportación PDF; OpenPencil ofrece scripting sin interfaz compatible con Figma, 90 herramientas AI/MCP, exportación SVG y una aplicación de escritorio.
