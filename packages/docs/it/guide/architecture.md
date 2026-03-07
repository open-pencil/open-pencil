# Architettura

## Panoramica del sistema

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Shell                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Editor (Web)                           │  │
│  │                                                            │  │
│  │  Vue 3 UI                   Skia CanvasKit (WASM, 7MB)    │  │
│  │  - Barra strumenti          - Rendering vettoriale        │  │
│  │  - Pannelli                 - Composizione testo          │  │
│  │  - Proprietà                - Elaborazione immagini       │  │
│  │  - Livelli                  - Effetti (sfocatura, ombra)  │  │
│  │  - Selettore colore         - Esportazione (PNG, SVG, PDF)│  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Core Engine (TS)                     │ │  │
│  │  │  SceneGraph ─── Layout (Yoga) ─── Selection          │ │  │
│  │  │      │                                  │             │ │  │
│  │  │  Undo/Redo ─── Constraints ─── Hit Testing           │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │           Livello formato file                        │ │  │
│  │  │  .fig import/export ── Kiwi codec ── .svg (previsto) │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  MCP Server (75+ tools, stdio+HTTP) P2P Collab (Trystero + Yjs) │
└──────────────────────────────────────────────────────────────────┘
```

## Layout dell'editor

L'interfaccia segue il layout UI3 di Figma — barra strumenti in basso, navigazione a sinistra, proprietà a destra:

- **Pannello di navigazione (sinistra)** — Albero dei livelli, pannello pagine, libreria asset (previsto)
- **Canvas (centro)** — Canvas infinito con rendering CanvasKit, zoom/pan
- **Pannello proprietà (destra)** — Sezioni contestuali: Aspetto, Riempimento, Contorno, Tipografia, Layout, Posizione
- **Barra strumenti (basso)** — Selezione strumento: Seleziona, Frame, Sezione, Rettangolo, Ellisse, Linea, Testo, Penna, Mano

## Componenti

### Rendering (CanvasKit WASM)

Lo stesso motore di rendering di Figma. CanvasKit fornisce disegno 2D accelerato via GPU con:
- Forme vettoriali (rettangolo, ellisse, percorso, linea, stella, poligono)
- Composizione testo via Paragraph API
- Effetti (ombre, sfocature, modalità di fusione)
- Esportazione (PNG, SVG, PDF)

Il binario WASM da 7 MB viene caricato all'avvio e crea una superficie GPU sul canvas HTML.

### Grafo della scena

`Map<string, Node>` piatto indicizzato per stringhe GUID. Struttura ad albero tramite riferimenti `parentIndex`. Fornisce ricerca O(1), attraversamento efficiente, hit testing e query per area rettangolare per la selezione a marquee.

Vedi [Riferimento del grafo della scena](/reference/scene-graph) per i dettagli interni.

### Motore di layout (Yoga WASM)

Yoga di Meta fornisce il calcolo del layout CSS flexbox. Un sottile adattatore mappa i nomi delle proprietà Figma agli equivalenti Yoga:

| Proprietà Figma | Equivalente Yoga |
|---|---|
| `stackMode: HORIZONTAL` | `flexDirection: row` |
| `stackMode: VERTICAL` | `flexDirection: column` |
| `stackSpacing` | `gap` |
| `stackPadding` | `padding` |
| `stackJustify` | `justifyContent` |
| `stackChildPrimaryGrow` | `flexGrow` |

### Formato file (Kiwi binario)

Riutilizza il collaudato codec binario Kiwi di Figma con 194 definizioni di messaggio/enum/struct. Pipeline di importazione `.fig`: analizzare header → decomprimere Zstd → decodificare Kiwi → NodeChange[] → grafo della scena. Il pipeline di esportazione inverte il processo: grafo della scena → NodeChange[] → codificare Kiwi → comprimere Zstd → ZIP con miniatura.

Vedi [Riferimento del formato file](/reference/file-format) per maggiori dettagli.

### Annulla/Ripristina

Pattern di comando inverso. Prima di applicare qualsiasi modifica, i campi interessati vengono catturati in uno snapshot. Lo snapshot diventa l'operazione inversa. Il batching raggruppa le modifiche rapide (come il trascinamento) in singole voci di annullamento.

### Appunti

Appunti bidirezionali compatibili con Figma. Codifica/decodifica binario Kiwi (stesso formato dei file .fig) usando gli eventi nativi copia/incolla del browser (sincroni, non l'API asincrona degli Appunti). L'incolla gestisce il ridimensionamento dei percorsi vettoriali, la popolazione dei figli delle istanze, il rilevamento dei set di componenti e l'applicazione degli override.

### Server MCP

`@open-pencil/mcp` espone 75 strumenti core + 3 strumenti di gestione file per strumenti di codifica IA. Due trasporti: stdio per Claude Code/Cursor/Windsurf, HTTP con Hono + Streamable HTTP per script e CI. Gli strumenti sono definiti una volta in `packages/core/src/tools/schema.ts` e adattati per chat IA (valibot), MCP (zod) e CLI (comando eval).

### Collaborazione P2P

Collaborazione peer-to-peer in tempo reale via Trystero (WebRTC) + Yjs CRDT. Senza server relay — segnalazione tramite broker MQTT pubblici, STUN/TURN per il traversal NAT. Il protocollo awareness fornisce cursori in tempo reale, selezioni e presenza. Persistenza locale tramite y-indexeddb.
