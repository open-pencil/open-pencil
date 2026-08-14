# Open Pencil vs Penpot: Comparación de arquitectura y rendimiento

¿Por qué comparar? OpenPencil existe porque las plataformas de diseño cerradas controlan lo que es posible. Entender las diferencias arquitectónicas muestra lo que una alternativa abierta y local-first puede hacer diferente.

::: info Renderer WASM de Penpot
Penpot 2.x incluye un renderer Rust/Skia WASM (`render-wasm/v1`) activable vía flags del servidor o el parámetro URL `?wasm=true`. El renderer SVG antiguo sigue siendo el predeterminado. Esta página cubre ambos.
:::

## 1. Escala y tamaño del código

| Métrica | Open Pencil | Penpot |
|---------|-------------|--------|
| LOC total | **~26.000** | **~299.000** |
| Archivos fuente | ~143 | ~2.900 |
| Lenguajes | TypeScript, Vue | Clojure, ClojureScript, Rust, JS, SQL, SCSS |
| Motor de renderizado | ~3.200 LOC (TS, 10 Dateien) | 22.000 LOC (Rust/Skia WASM) |
| Código UI | ~4.500 LOC | ~175.000 LOC (CLJS + SCSS) |
| Backend | Ninguno (local-first) | 32.600 LOC + 151 archivos SQL |
| Ratio LOC | **1×** | **~11×** |

Open Pencil es **~11× más pequeño** — y ese es el punto. No es una simplificación; es una arquitectura fundamentalmente diferente.

## 2. Arquitectura

### Open Pencil: cliente monolítico

```
┌─────────────────────────────────┐
│         Tauri (shell nativo)    │
│  ┌───────────────────────────┐  │
│  │  Vue 3 + TypeScript       │  │
│  │  ┌─────────┐ ┌──────────┐│  │
│  │  │  Editor  │ │  Kiwi    ││  │
│  │  │  Store   │ │  Codec   ││  │
│  │  └────┬─────┘ └──────────┘│  │
│  │       │                    │  │
│  │  ┌────▼────────────────┐  │  │
│  │  │  Scene Graph (TS)    │  │  │
│  │  │  Map<string, Node>   │  │  │
│  │  └────┬────────────────┘  │  │
│  │       │                    │  │
│  │  ┌────▼────┐ ┌──────────┐│  │
│  │  │  Skia   │ │  Yoga    ││  │
│  │  │CanvasKit│ │  Layout  ││  │
│  │  │  (WASM) │ │  (WASM)  ││  │
│  │  └─────────┘ └──────────┘│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Todo en un proceso.** Sin servidor, sin base de datos, sin Docker. El grafo de escena es un `Map<string, SceneNode>` plano en TypeScript. El renderizado llama a Skia CanvasKit directamente desde TS. El layout es Yoga WASM llamado síncronamente.

### Penpot: cliente-servidor distribuido

```
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                      │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │   Frontend    │  │   Backend   │  │   Exporter   │ │
│  │  ClojureScript│  │   Clojure   │  │  (Chromium)  │ │
│  │  shadow-cljs  │  │   JVM       │  │              │ │
│  │  ┌─────────┐ │  │  ┌────────┐ │  └──────────────┘ │
│  │  │render-  │ │  │  │Postgres│ │                    │
│  │  │wasm     │ │  │  │Valkey  │ │  ┌──────────────┐ │
│  │  │(Rust→   │ │  │  │ MinIO  │ │  │   MCP        │ │
│  │  │ Skia    │ │  │  └────────┘ │  │   Server     │ │
│  │  │ WASM)   │ │  │             │  └──────────────┘ │
│  │  └─────────┘ │  │             │                    │
│  └──────────────┘  └─────────────┘                    │
└───────────────────────────────────────────────────────┘
```

**Mínimo 5+ servicios.** PostgreSQL para persistencia, Redis (Valkey) para pub/sub y caché, MinIO para almacenamiento de assets, un backend JVM, un exportador Node.js (Chromium headless), más el frontend ClojureScript.

### Veredicto: Arquitectura

La arquitectura de proceso único de Open Pencil elimina: latencia de red entre frontend y backend, overhead de serialización/deserialización en los límites de servicios, complejidad de orquestación de contenedores y overhead de consultas de base de datos.

## 3. Pipeline de renderizado

### Open Pencil: TS → CanvasKit WASM (directo)

```typescript
// renderer.ts — llamadas directas a CanvasKit desde TypeScript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- **1 cruce de límite:** TS → WASM (CanvasKit)
- El grafo de escena vive en el heap JS — sin serialización para renderizar
- 1.646 LOC de renderer total

### Penpot: JS (compilado de CLJS) → Rust WASM → Skia

```
ClojureScript (compilado a JS)
  → descomponer a primitivas + empaquetar en binario en memoria lineal WASM
  → Rust WASM (vía Emscripten C FFI)
  → skia-safe (bindings Rust de Skia)
  → Skia (WebGL)
```

Cuando está deshabilitado (predeterminado), las formas se renderizan como un árbol DOM SVG. Cuando está habilitado, usa un sistema de renderizado basado en tiles con 11 superficies separadas y caché de hasta 1024 entradas.

### Veredicto: Renderizado

| Aspecto | Open Pencil | Penpot |
|---------|-------------|--------|
| Límite JS→WASM | Directo (objetos TS) | Empaquetado binario (104 bytes por forma) |
| Modelo de renderizado | Inmediato/redibujado completo | Caché por tiles |
| Gestión de superficies | 1 superficie | 11 superficies |
| Overhead de memoria | Bajo (sin caché de tiles) | Alto (1024 entradas caché) |
| Complejidad de código | 1.646 LOC | 22.000 LOC |
| Código inseguro | Ninguno | Estado global `unsafe` |

## 4. Grafo de escena y modelo de datos

### Open Pencil

```typescript
// Mapa plano, búsqueda O(1)
nodes: Map<string, SceneNode>
// 29 tipos de nodo del esquema Kiwi de Figma
// ~390 campos por NodeChange (compatible con Figma)
```

- Interfaces TypeScript con tipos estrictos
- GUIDs coinciden con el formato `sessionID:localID` de Figma
- Acceso directo a propiedades — sin capas de indirección

### Penpot

- Datos distribuidos en `common/` (49.600 LOC de .cljc)
- Módulos de geometría separados para flex layout, grid layout, constraints, bounds, esquinas, efectos
- Validación de esquema en runtime (Malli)
- Los datos deben cruzar el límite CLJS→Rust para renderizado

### Veredicto: Modelo de datos

Open Pencil reutiliza el esquema probado de Figma (194 definiciones Kiwi) directamente en TypeScript — cero traducción. Penpot mantiene su propio sistema de tipos a través de Clojure/ClojureScript/Rust, requiriendo sincronización manual entre los tres.

## 5. Motor de layout

### Open Pencil: Yoga WASM (314 LOC)

```typescript
import Yoga from 'yoga-layout'
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
applyYogaLayout(graph, frame, yogaRoot)
```

314 líneas total. Síncrono, en proceso.

### Penpot: Implementación dual

1. **ClojureScript** (common): `flex_layout/` (6 archivos), `grid_layout/` (5+ archivos)
2. **Rust WASM**: `flex_layout.rs` (741 LOC), `grid_layout.rs` (843 LOC)

Penpot mantiene **dos motores de layout independientes** que deben producir resultados idénticos.

### Veredicto: Layout

Open Pencil delega en una librería probada (Yoga, usada por React Native en miles de millones de dispositivos) en 314 líneas. Penpot mantiene ~3.000+ LOC de código de layout personalizado duplicado.

## 6. Formato de archivo y compatibilidad con Figma

### Open Pencil

- **Formato binario Kiwi nativo** — misma serialización que usa Figma internamente
- Import directo de archivos `.fig` vía codec Kiwi extraído (2.178 LOC esquema + 551 LOC codec)
- Soporte de pegado desde el portapapeles de Figma
- Compatible con el protocolo multiplayer de Figma

### Penpot

- **Archivo ZIP** (`.penpot`) con manifiestos JSON y assets binarios
- Sin import nativo de `.fig`
- Tres versiones de formato con sistema de migración

### Veredicto: Formato de archivo

Open Pencil tiene una ventaja significativa — puede leer archivos Figma nativamente y pegar datos del portapapeles de Figma.

## 7. Gestión de estado y deshacer

### Open Pencil

```typescript
// 110 LOC — patrón de comando inverso
class UndoManager {
  apply(entry: UndoEntry) { entry.forward(); this.undoStack.push(entry) }
  undo() { entry.inverse(); this.redoStack.push(entry) }
}
```

110 líneas. Closures forward/inverse que capturan estado mínimo.

### Penpot

Gestión de estado usa Potok (librería tipo Redux para átomos ClojureScript). Undo almacena vectores de cambios inversos (máximo 50 entradas), con transacciones y auto-expiración tras 20 segundos.

### Veredicto: Estado

El enfoque de Open Pencil es más simple y con menos overhead.

## 8. Experiencia de desarrollo

| Métrica | Open Pencil | Penpot |
|---------|-------------|--------|
| Setup de dev | `bun install && bun dev` | Docker Compose + JVM + Node + Rust toolchain |
| Recarga en caliente | Vite HMR (~50ms) | shadow-cljs (segundos) |
| Verificación de tipos | TypeScript (estricto) | Runtime (esquemas Malli) |
| Tiempo de build | <5s (Vite) | Minutos (JVM startup + CLJS compile + Rust WASM) |
| Barrera primera contribución | Baja (TS/Vue) | Alta (Clojure + Rust + Docker) |
| Desktop | Tauri v2 (~5MB) | N/A (solo navegador) |
| Pool de contratación | Masivo (devs TS/Vue) | Pequeño (ClojureScript + Rust) |

## 9. Características de rendimiento

| Escenario | Open Pencil | Penpot |
|-----------|-------------|--------|
| Arranque en frío | <2s (carga WASM) | 10s+ (servidor + cliente + WASM) |
| Latencia de operación | <1ms (en proceso) | 10-50ms (round-trip red) |
| Frame de render | Llamada Skia directa | CLJS→JS→WASM FFI→Skia |
| Memoria base | ~50MB (pestaña navegador) | ~300MB+ (JVM + Postgres + Valkey + navegador) |
| Capacidad offline | Completa (local-first) | Ninguna (depende del servidor) |
| Render 10K formas | Una pasada, sin caché | Basado en tiles con 11 superficies |

## 10. Lo que Penpot hace mejor

1. **Colaboración servidor** — edición multiusuario centralizada con WebSockets, cuentas y control de acceso
2. **Exportación PDF en servidor** — servicio de export Chromium headless para PDF (Open Pencil ya exporta SVG nativamente)
3. **Sistema de plugins** — API completa con ejecución sandboxed
4. **Tokens de diseño** — soporte nativo de design tokens
5. **CSS Grid layout** — implementación propia (Open Pencil espera Yoga Grid)
6. **Self-hosting** — despliegue Docker para equipos
7. **Madurez** — años de uso en producción, probado a escala

## 11. Scripting y extensibilidad

OpenPencil incluye un [comando `eval`](/programmable/cli/scripting) que proporciona una API de Plugin compatible con Figma para scripting headless. Además, 90 herramientas AI disponibles vía chat integrado, servidor MCP (stdio + HTTP) y CLI. Penpot tiene sistema de plugins con ejecución sandboxed pero sin API de scripting headless ni integración MCP.

## Resumen

| Dimensión | Ganador | Por qué |
|-----------|---------|---------|
| **Simplicidad arquitectónica** | Open Pencil | Un proceso vs 5+ servicios |
| **Rendimiento de renderizado** | Open Pencil | CanvasKit directo vs SVG DOM (default) o WASM empaquetado |
| **Mantenibilidad del código** | Open Pencil | ~26K LOC en 1 lenguaje vs 299K en 4+ |
| **Compatibilidad Figma** | Open Pencil | Codec Kiwi nativo vs sin soporte .fig |
| **Onboarding de desarrolladores** | Open Pencil | TS/Vue vs Clojure/Rust/Docker |
| **Experiencia desktop** | Open Pencil | Tauri nativo vs solo navegador |
| **Motor de layout** | Open Pencil | Yoga (probado) vs implementación dual personalizada |
| **Colaboración** | Empate | Penpot: servidor con control de acceso; Open Pencil: P2P vía Trystero + Yjs, zero hosting |
| **Self-hosting** | Penpot | Listo para Docker vs solo desktop |
| **Madurez del ecosistema** | Penpot | Años de producción vs etapa temprana |

Open Pencil es arquitectónicamente más ligero — un renderer CanvasKit de proceso único en ~26K LOC de TypeScript, compatible con Figma por diseño. Penpot es una plataforma full-stack con ~299K LOC. Ambos ofrecen colaboración en tiempo real (P2P vs servidor). Penpot tiene ecosistema de plugins y exportación PDF en servidor; Open Pencil tiene scripting headless compatible con Figma, **90 herramientas AI/MCP**, exportación SVG y app desktop nativa.
