# Open Pencil vs Penpot: Confronto architettura e prestazioni

Perché confrontare? OpenPencil esiste perché le piattaforme di design chiuse controllano ciò che è possibile. Comprendere le differenze architetturali mostra cosa un'alternativa aperta e local-first può fare diversamente.

::: info Renderer WASM di Penpot
Penpot 2.x include un renderer Rust/Skia WASM (`render-wasm/v1`) attivabile tramite flag del server o il parametro URL `?wasm=true`. Il renderer SVG rimane il default. Questa pagina copre entrambi.
:::

## 1. Scala e dimensione del codice

| Metrica | Open Pencil | Penpot |
|---------|-------------|--------|
| LOC totali | **~26.000** | **~299.000** |
| File sorgente | ~143 | ~2.900 |
| Linguaggi | TypeScript, Vue | Clojure, ClojureScript, Rust, JS, SQL, SCSS |
| Motore di rendering | ~3.200 LOC (TS, 10 Dateien) | 22.000 LOC (Rust/Skia WASM) |
| Codice UI | ~4.500 LOC | ~175.000 LOC (CLJS + SCSS) |
| Backend | Nessuno (local-first) | 32.600 LOC + 151 file SQL |
| Rapporto LOC | **1×** | **~11×** |

Open Pencil è **~11× più piccolo** — e questo è il punto. Non è una semplificazione; è un'architettura fondamentalmente diversa.

## 2. Architettura

### Open Pencil: Client monolitico

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

**Tutto in un unico processo.** Nessun server, nessun database, nessun Docker.

### Penpot: Client-server distribuito

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

**Minimo 5+ servizi.** PostgreSQL, Redis (Valkey), MinIO, backend JVM, esportatore Node.js (Chromium headless), più il frontend ClojureScript.

### Verdetto: Architettura

L'architettura monoprocesso di Open Pencil elimina: latenza di rete, overhead di serializzazione, complessità di orchestrazione container e overhead di query database.

## 3. Pipeline di rendering

### Open Pencil: TS → CanvasKit WASM (diretto)

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- **1 attraversamento:** TS → WASM (CanvasKit)
- 1.646 LOC di renderer totale

### Penpot: JS (compilato da CLJS) → Rust WASM → Skia

```
ClojureScript (compilato in JS)
  → scomporre in primitive + impacchettare in binario nella memoria lineare WASM
  → Rust WASM (via Emscripten C FFI)
  → skia-safe (binding Rust Skia)
  → Skia (WebGL)
```

Quando disabilitato (default), rendering come albero DOM SVG. Quando abilitato, sistema di rendering a tile con 11 superfici.

### Verdetto: Rendering

| Aspetto | Open Pencil | Penpot |
|---------|-------------|--------|
| Confine JS→WASM | Diretto (oggetti TS) | Impacchettamento binario (104 byte per forma) |
| Modello di rendering | Immediato/ridisegno completo | Cache a tile |
| Gestione superfici | 1 superficie | 11 superfici |
| Overhead memoria | Basso | Alto (1024 voci cache) |
| Complessità codice | 1.646 LOC | 22.000 LOC |
| Codice unsafe | Nessuno | Stato globale `unsafe` |

## 4. Grafo della scena e modello dati

### Open Pencil

```typescript
nodes: Map<string, SceneNode>
// 29 tipi di nodo dallo schema Kiwi di Figma
// ~390 campi per NodeChange (compatibile Figma)
```

### Penpot

- Dati distribuiti in `common/` (49.600 LOC di .cljc)
- Validazione schema a runtime (Malli)

### Verdetto: Modello dati

Open Pencil riutilizza lo schema provato di Figma (194 definizioni Kiwi) direttamente in TypeScript. Penpot mantiene un proprio sistema di tipi attraverso tre linguaggi.

## 5. Motore di layout

### Open Pencil: Yoga WASM (314 LOC)

```typescript
import Yoga from 'yoga-layout'
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
```

314 righe. Sincrono, in-process.

### Penpot: Doppia implementazione

Penpot mantiene **due motori di layout indipendenti** (CLJS e Rust) che devono produrre risultati identici. ~3.000+ LOC duplicati.

## 6. Formato file e compatibilità Figma

### Open Pencil

- **Formato binario Kiwi nativo** — stessa serializzazione di Figma
- Import diretto `.fig`, incolla dagli appunti di Figma
- Compatibile con il protocollo multiplayer di Figma

### Penpot

- **Archivio ZIP** (`.penpot`) con manifesti JSON e asset binari
- Nessun import nativo `.fig`

### Verdetto: Formato file

Open Pencil ha un vantaggio significativo — può leggere file Figma nativamente e incollare dati dagli appunti di Figma.

## 7. Gestione stato e annullamento

### Open Pencil

```typescript
// 110 LOC — pattern di comando inverso
class UndoManager {
  apply(entry) { entry.forward(); this.undoStack.push(entry) }
  undo() { entry.inverse(); this.redoStack.push(entry) }
}
```

### Penpot

Gestione stato via Potok. Undo con vettori di cambiamenti inversi (max 50 voci), auto-scadenza dopo 20 secondi.

## 8. Esperienza sviluppatore

| Metrica | Open Pencil | Penpot |
|---------|-------------|--------|
| Setup dev | `bun install && bun dev` | Docker Compose + JVM + Node + Rust |
| Hot reload | Vite HMR (~50ms) | shadow-cljs (secondi) |
| Type checking | TypeScript (strict) | Runtime (schemi Malli) |
| Tempo build | <5s (Vite) | Minuti (JVM + CLJS + Rust WASM) |
| Barriera prima contribuzione | Bassa (TS/Vue) | Alta (Clojure + Rust + Docker) |
| Desktop | Tauri v2 (~5MB) | N/A (solo browser) |

## 9. Caratteristiche di prestazione

| Scenario | Open Pencil | Penpot |
|----------|-------------|--------|
| Avvio a freddo | <2s (caricamento WASM) | 10s+ (server + client + WASM) |
| Latenza operazione | <1ms (in-process) | 10-50ms (round-trip rete) |
| Frame di render | Chiamata Skia diretta | CLJS→JS→WASM FFI→Skia |
| Memoria base | ~50MB (tab browser) | ~300MB+ (JVM + Postgres + Valkey + browser) |
| Capacità offline | Completa (local-first) | Nessuna (dipende dal server) |

## 10. Cosa fa meglio Penpot

1. **Collaborazione server** — editing multi-utente centralizzato con WebSockets, account e controllo accessi
2. **Export PDF server** — servizio export Chromium headless per PDF (Open Pencil esporta già SVG nativamente)
3. **Sistema plugin** — API completa con esecuzione sandboxed
4. **Token di design** — supporto nativo design token
5. **CSS Grid layout** — implementazione propria (Open Pencil attende Yoga Grid)
6. **Self-hosting** — deployment Docker per team
7. **Maturità** — anni di uso in produzione

## 11. Scripting ed estensibilità

OpenPencil include un [comando `eval`](/programmable/cli/scripting) che fornisce un'API Plugin compatibile Figma per scripting headless. Inoltre, 90 strumenti AI disponibili via chat integrata, server MCP (stdio + HTTP) e CLI. Penpot ha un sistema plugin con esecuzione sandboxed ma senza API di scripting headless né integrazione MCP.

## Riepilogo

| Dimensione | Vincitore | Perché |
|-----------|---------|--------|
| **Semplicità architetturale** | Open Pencil | Un processo vs 5+ servizi |
| **Prestazioni di rendering** | Open Pencil | CanvasKit diretto vs SVG DOM (default) o WASM impacchettato |
| **Manutenibilità codice** | Open Pencil | ~26K LOC in 1 linguaggio vs 299K in 4+ |
| **Compatibilità Figma** | Open Pencil | Codec Kiwi nativo vs nessun supporto .fig |
| **Onboarding sviluppatori** | Open Pencil | TS/Vue vs Clojure/Rust/Docker |
| **Esperienza desktop** | Open Pencil | Tauri nativo vs solo browser |
| **Motore di layout** | Open Pencil | Yoga (provato) vs doppia implementazione |
| **Collaborazione** | Pareggio | Penpot: server con controllo accessi; Open Pencil: P2P via Trystero + Yjs |
| **Self-hosting** | Penpot | Docker-ready vs solo desktop |
| **Maturità ecosistema** | Penpot | Anni di produzione vs stadio iniziale |

Open Pencil è architetturalmente più snello — un renderer CanvasKit monoprocesso in ~26K LOC TypeScript, compatibile Figma per design. Penpot è una piattaforma full-stack con ~299K LOC. Open Pencil ha scripting headless, **90 strumenti AI/MCP**, export SVG e app desktop nativa.
