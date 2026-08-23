# OpenPencil e Penpot: architettura e prestazioni

OpenPencil e Penpot sono strumenti di design open source, ma adottano obiettivi e architetture differenti.

::: info Motore WASM di Penpot
Penpot 2.x include il motore Rust/Skia WASM `render-wasm/v1`, attivabile tramite opzioni del server o `?wasm=true`. Il motore SVG rimane quello predefinito. Il confronto considera entrambe le modalità.
:::

## 1. Dimensione del codice

| Metrica | OpenPencil | Penpot |
|---------|------------|--------|
| Righe di codice | **circa 26.000** | **circa 299.000** |
| File sorgente | circa 143 | circa 2.900 |
| Linguaggi | TypeScript, Vue | Clojure, ClojureScript, Rust, JavaScript, SQL, SCSS |
| Motore di rendering | circa 3.200 righe, TypeScript | 22.000 righe, Rust/Skia WASM |
| Interfaccia | circa 4.500 righe | circa 175.000 righe, CLJS e SCSS |
| Server | Nessuno, architettura locale | 32.600 righe e 151 file SQL |
| Rapporto | **1×** | **circa 11×** |

OpenPencil è circa undici volte più piccolo. La differenza dipende soprattutto dall’architettura, non soltanto dal numero di funzioni.

## 2. Architettura

### OpenPencil: un solo processo client

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

Editor, SceneGraph, codec dei file e motore di rendering vengono eseguiti nello stesso processo. Non servono server, database o Docker. SceneGraph è una `Map<string, SceneNode>`. TypeScript chiama direttamente CanvasKit e Yoga WASM calcola la disposizione in modo sincrono.

### Penpot: piattaforma client-server

```text
┌───────────────────────────────────────────────────────┐
│                    Docker Compose                     │
│  ClojureScript frontend │ Clojure/JVM backend        │
│  Rust/Skia WASM         │ PostgreSQL, Valkey, MinIO  │
│  Chromium exporter      │ MCP server                 │
└───────────────────────────────────────────────────────┘
```

Un’installazione completa di Penpot comprende interfaccia, server JVM, PostgreSQL, Valkey, MinIO e un esportatore basato su Chromium senza interfaccia. L’ambiente di sviluppo richiede Docker Compose, JVM, Node e strumenti Rust.

OpenPencil evita latenza di rete, serializzazione tra servizi, orchestrazione dei contenitori e query al database per le normali operazioni. Penpot è pensato come piattaforma multiutente ospitata su server; OpenPencil privilegia l’editing locale a bassa latenza.

## 3. Flusso di rendering

### OpenPencil: TypeScript → CanvasKit WASM

```typescript
renderSceneToCanvas(canvas, graph, pageId) {
  this.fillPaint.setColor(...)
  canvas.drawRRect(rrect, this.fillPaint)
}
```

- Passaggio diretto da TypeScript a WASM.
- SceneGraph rimane nell’heap JavaScript e non viene serializzato prima del rendering.
- Il motore comprende circa 3.200 righe distribuite in moduli specializzati.

### Penpot: ClojureScript → Rust WASM → Skia

```text
ClojureScript → JavaScript
  → scomposizione e codifica binaria nella memoria WASM
  → Rust WASM tramite Emscripten C FFI
  → skia-safe
  → Skia/WebGL
```

Senza WASM, ogni forma viene renderizzata come elemento SVG DOM tramite React/Reagent. Con WASM, UUID, trasformazioni, riempimenti e contorni vengono codificati in strutture binarie. Il motore usa cache a riquadri, aree di interesse, undici superfici e stato globale mutabile tramite `unsafe`.

La cache può conservare fino a 1.024 texture. OpenPencil ridisegna invece l’intera area visibile.

| Aspetto | OpenPencil | Penpot |
|---------|------------|--------|
| JavaScript → WASM | Chiamate dirette con oggetti TypeScript | Strutture binarie |
| Modello | Ridisegno del viewport visibile | Cache a riquadri |
| Superfici | 1 | 11 |
| Cache aggiuntiva | Nessuna | Fino a 1.024 riquadri |
| Dimensione del motore | circa 3.200 righe | 22.000 righe |
| Codice non sicuro | Nessuno | Stato globale tramite `unsafe` |

Il percorso diretto di CanvasKit richiede meno elaborazione intermedia nei documenti piccoli e medi. La cache di Penpot può essere vantaggiosa oltre 100.000 forme quando è visibile solo una piccola area.

## 4. SceneGraph e modello dati

```typescript
nodes: Map<string, SceneNode>
```

OpenPencil offre ricerca per ID in O(1), 29 tipi di oggetto dallo schema Kiwi, circa 390 campi in `NodeChange`, tipi TypeScript rigorosi e GUID nel formato Figma `sessionID:localID`.

Penpot mantiene definizioni proprie in Clojure/ClojureScript e Rust. Moduli separati gestiscono colori, componenti, contenitori, riempimenti, griglia, modificatori, pagine e percorsi. Malli convalida gli schemi durante l’esecuzione e i dati di rendering attraversano il confine CLJS → Rust.

## 5. Motore di disposizione

OpenPencil usa Yoga WASM in modo sincrono:

```typescript
const root = Yoga.Node.create()
root.setFlexDirection(FlexDirection.Row)
root.calculateLayout()
```

Penpot mantiene implementazioni proprie di Flex e Grid sia in ClojureScript sia in Rust WASM. OpenPencil usa Yoga, compresa una variante con supporto Grid; Penpot mantiene migliaia di righe di codice di disposizione in due linguaggi.

## 6. Formati e Figma

OpenPencil usa il formato binario Kiwi di Figma, importa direttamente `.fig`, legge i dati Kiwi dagli appunti ed è compatibile con il protocollo multiplayer di Figma.

Un file `.penpot` è invece un archivio ZIP con manifesti JSON, dati, risorse binarie e miniature. Penpot non importa `.fig` in modo nativo e gestisce diverse generazioni del formato tramite migrazioni.

## 7. Stato e annullamento

OpenPencil usa comandi inversi: le funzioni di applicazione e annullamento conservano solo lo stato necessario e le operazioni possono essere raggruppate.

Penpot usa Potok. `UpdateEvent` cambia lo stato, `WatchEvent` esegue gli effetti tramite RxJS e la cronologia conserva vettori inversi, fino a 50 voci, raggruppando le modifiche rapide in transazioni.

## 8. Sviluppo

| Metrica | OpenPencil | Penpot |
|---------|------------|--------|
| Preparazione | `bun install && bun dev` | Docker Compose, JVM, Node e Rust |
| Aggiornamento rapido | Vite | shadow-cljs |
| Tipi | TypeScript rigoroso | Schemi Malli durante l’esecuzione |
| Desktop | Tauri v2 | Browser |
| Tecnologie principali | TypeScript e Vue | Clojure, ClojureScript, Rust e Docker |

## 9. Prestazioni

| Scenario | OpenPencil | Penpot |
|----------|------------|--------|
| Avvio | meno di 2 s con WASM | oltre 10 s per server, client e WASM |
| Operazione comune | Nello stesso processo | Possibile passaggio di rete |
| Fotogramma | Chiamata diretta a Skia | CLJS → JS → WASM FFI → Skia |
| Memoria di base | circa 50 MB nella scheda | JVM, database, cache e browser |
| Senza rete | Completo | Richiede il server |
| 10.000 forme | Una passata | Renderer a riquadri con 11 superfici |

## 10. Vantaggi di Penpot

1. **Collaborazione tramite server:** account, controllo degli accessi e archiviazione centrale.
2. **Export PDF:** esportatore Chromium dedicato.
3. **Sistema di plugin:** esecuzione isolata e API dei plugin.
4. **Token di design:** supporto integrato.
5. **CSS Grid:** implementazione propria; OpenPencil usa una variante di Yoga con Grid.
6. **Installazione autonoma:** piattaforma di gruppo distribuibile con Docker.
7. **Maturità:** diversi anni di uso in produzione.

## 11. Script ed estensibilità

Il comando [`eval`](/programmable/cli/scripting) fornisce un’API compatibile con i plugin Figma per script senza interfaccia, operazioni in serie e test automatizzati. Chat AI, server MCP e CLI offrono inoltre 90 strumenti per lettura, creazione, modifica, struttura, variabili, tracciati vettoriali, analisi, differenze, operazioni booleane e disposizione.

Penpot offre plugin isolati, ma non un’API equivalente per script senza interfaccia o integrazione MCP.

## Riepilogo

| Area | Vantaggio | Motivo |
|------|-----------|--------|
| Semplicità | OpenPencil | Un processo invece di più servizi |
| Rendering | OpenPencil | Percorso CanvasKit diretto |
| Codice | OpenPencil | Circa 26.000 contro 299.000 righe |
| Compatibilità Figma | OpenPencil | Kiwi e `.fig` nativi |
| Sviluppo | OpenPencil | TypeScript e Vue anziché Clojure, Rust e Docker |
| Applicazione desktop | OpenPencil | Tauri nativo |
| Disposizione | OpenPencil | Yoga anziché due implementazioni proprie |
| Collaborazione | Punti di forza diversi | Penpot: server e accessi; OpenPencil: P2P senza hosting |
| Installazione autonoma | Penpot | Distribuzione Docker |
| Maturità | Penpot | Anni di uso in produzione |

OpenPencil è un editor compatto in un solo processo con CanvasKit e supporto nativo `.fig`. Penpot è una piattaforma client-server completa con Clojure, ClojureScript, Rust, database e servizi Docker. Entrambi supportano la collaborazione con modelli diversi.
