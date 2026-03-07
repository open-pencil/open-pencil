# Funzionalità

## Perché OpenPencil

Gli strumenti di design sono un problema di catena di fornitura. Quando il tuo strumento è proprietario, il fornitore controlla ciò che è possibile. OpenPencil è un'alternativa open-source: licenza MIT, compatibile con Figma, completamente locale e programmabile.

## Import & export file .fig di Figma

Apri e salva file nativi Figma direttamente. L'import decodifica lo schema Kiwi completo a 194 definizioni inclusi i messaggi NodeChange con ~390 campi. L'export codifica il grafo della scena in binario Kiwi con compressione Zstd e generazione thumbnail. Salva (<kbd>⌘</kbd><kbd>S</kbd>) e Salva con nome (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>) usano dialoghi nativi dell'OS.

## Copia e incolla con Figma

Seleziona nodi in Figma, <kbd>⌘</kbd><kbd>C</kbd>, passa a OpenPencil, <kbd>⌘</kbd><kbd>V</kbd> — appaiono con riempimenti, contorni, auto-layout, testo, raggi degli angoli, effetti e reti vettoriali preservati. Funziona anche al contrario.

L'incolla gestisce scenari complessi: i percorsi vettoriali vengono ridimensionati dalla `normalizedSize` di Figma, i figli delle istanze vengono popolati dal `symbolData` del componente, i set di componenti vengono rilevati e i `symbolOverrides` vengono applicati. I font vengono caricati automaticamente.

## Reti vettoriali

Lo strumento penna usa il modello di rete vettoriale di Figma — non percorsi semplici. Click per punti angolari, click+trascinamento per curve di Bézier. Percorsi aperti e chiusi supportati.

## Strumenti forma

La barra strumenti fornisce tutti gli strumenti forma base di Figma: Rettangolo (<kbd>R</kbd>), Ellisse (<kbd>O</kbd>), Linea (<kbd>L</kbd>), Poligono e Stella. Tutti supportano riempimento, contorno, evidenziazione al passaggio e contorno di selezione.

## Auto-Layout

Yoga WASM fornisce il layout CSS flexbox. I frame supportano: direzione, gap, padding, justify, align e dimensionamento figli. Shift+A attiva/disattiva l'auto-layout.

## Modifica testo inline

Modifica testo nativa nel canvas. Doppio click su un nodo testo per entrare in modalità modifica. **Selettore font** con scroll virtuale, filtro di ricerca e anteprima CSS. In Tauri, i font di sistema sono enumerati via il crate Rust `font-kit`.

## Formattazione testo ricco

Formattazione per carattere: <kbd>⌘</kbd><kbd>B</kbd> grassetto, <kbd>⌘</kbd><kbd>I</kbd> corsivo, <kbd>⌘</kbd><kbd>U</kbd> sottolineato, o pulsanti B/I/U/S. Implementato via modello StyleRun. Preservato nell'import/export .fig.

## Annulla/Ripristina

Ogni operazione è annullabile. Pattern di comando inverso. <kbd>⌘</kbd><kbd>Z</kbd> annulla, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> ripristina.

## Guide di snap

Snap ai bordi e al centro con linee guida rosse. Consapevole della rotazione.

## Righelli canvas

Righelli in alto e a sinistra mostrano scale di coordinate con badge di coordinate alla selezione.

## Selettore colore e tipi di riempimento

Selezione HSV con slider di tonalità, slider alfa, input hex e controllo opacità. Tipi: Solido, Gradiente (Lineare, Radiale, Angolare, Diamante) e Immagine.

## Pannello livelli

Vista ad albero della gerarchia del documento. Pannelli ridimensionabili.

## Pannello proprietà

Interfaccia a tab **Design** | **Codice** | **IA**. Il tab Design mostra sezioni contestuali: Aspetto, Riempimento, Contorno, Effetti, Tipografia, Layout, Posizione, Esportazione e Pagina.

## Raggruppa/Separa

⌘G raggruppa. ⇧⌘G separa. I nodi vengono ordinati per posizione visiva.

## Sezioni

Le sezioni (<kbd>S</kbd>) sono contenitori organizzativi di livello superiore sul canvas con pillole di titolo e inversione automatica del colore del testo.

## Documenti multi-pagina

I documenti supportano più pagine. Ogni pagina mantiene uno stato viewport indipendente.

## Evidenziazione al passaggio

I nodi si evidenziano con un contorno che segue la geometria reale.

## Rendering avanzato (Tier 1)

Il renderer CanvasKit supporta le caratteristiche visive Tier 1 complete: riempimenti gradiente, riempimenti immagine, effetti, proprietà contorno, dati arco, culling viewport, riuso Paint e coalescenza RAF.

## Componenti e istanze

Componenti riutilizzabili (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), set (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), istanze via menu contestuale, stacca (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd>). **Sync in tempo reale** e **supporto override**. Etichette viola con icona diamante.

## Variabili

Token di design con collezioni e modalità. Dialogo TanStack Table. Supporta COLOR con UI completa, FLOAT/STRING/BOOLEAN definiti. Tutte le operazioni sono annullabili.

## Esportazione immagini

PNG, JPG, WEBP con scala 0,5×–4×, anteprima live e <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>.

## Menu contestuale

Click destro per: Appunti, Ordine Z, Raggruppamento, Componenti (voci viola), Visibilità, Sposta a pagina.

## Ordine Z, visibilità e blocco

<kbd>]</kbd> porta in primo piano, <kbd>[</kbd> invia in fondo. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> visibilità. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> blocco.

## App web e desktop

OpenPencil funziona nel browser su [app.openpencil.dev](https://app.openpencil.dev). L'app desktop usa Tauri v2 (~5 MB). Funziona completamente offline.

## Menu app (browser)

Barra dei menu con reka-ui: **File**, **Modifica**, **Visualizza**, **Oggetto**, **Testo**, **Disponi**. Scorciatoie adattate alla piattaforma. Nascosto in Tauri.

## Salvataggio automatico

File salvati 3 secondi dopo l'ultima modifica. Debounce su `sceneVersion`. Disabilitato per documenti nuovi senza titolo.

## Collaborazione P2P

Collaborazione peer-to-peer in tempo reale — nessun server richiesto. Basato su Trystero (WebRTC) + Yjs (CRDT).

- **Zero costi di hosting** — segnalazione via broker MQTT pubblici
- **Traversal NAT** — server Google STUN, Cloudflare STUN e Open Relay TURN
- **Cursori in tempo reale** — frecce colorate stile Figma con pillole di nome
- **Presenza** — avatar colorati
- **Modalità segui** — clicca sull'avatar di un peer per seguire il suo viewport
- **Persistenza locale** — y-indexeddb mantiene la stanza tra i ricaricamenti
- **Stanze sicure** — ID via `crypto.getRandomValues()`

## Schede multi-file

Apri più documenti in schede. <kbd>⌘</kbd><kbd>N</kbd>/<kbd>⌘</kbd><kbd>T</kbd> nuova scheda, <kbd>⌘</kbd><kbd>W</kbd> chiudi, <kbd>⌘</kbd><kbd>O</kbd> apri in nuova scheda. Ogni scheda mantiene il proprio stato documento.

## Rendering effetti

Rendering completo degli effetti Figma: **Ombra portata**, **Ombra interna**, **Sfocatura livello** (Gaussiana), **Sfocatura sfondo** (effetto vetro/satinato), **Sfocatura primo piano**. Cache SkPicture per nodo per le prestazioni.

## Proprietà multi-selezione

Seleziona più nodi e modifica le proprietà condivise. Valori comuni visualizzati normalmente, valori diversi mostrano "Mixed". Capovolgi H/V si applica a tutti i nodi.

## ScrubInput

Tutte le entrate numeriche usano interazione trascina-per-regolare. Supporta suffissi (°, px, %).

## Build CI/CD

GitHub Actions costruisce app Tauri sui tag di versione. macOS firmato e notarizzato. Note di release auto-popolate dal CHANGELOG.md.

## @open-pencil/core e CLI

Il motore è estratto in `packages/core/`. Il CLI fornisce: info, tree, find, export, analyze, node, pages, variables, eval. Tutti supportano `--json`. Il comando `eval` esegue JavaScript con API Plugin Figma. Vedi [Comando Eval](/eval-command).

## Renderer JSX

Creazione programmabile via TreeNode builder. Props shorthand stile Tailwind.

## Chat IA

Assistente IA integrato via <kbd>⌘</kbd><kbd>J</kbd>. **78 strumenti** in `schema.ts` che coprono lettura, creazione, modifica, manipolazione nodi, CRUD variabili, strumenti vettoriali, controllo viewport e `eval`. **Server MCP** espone 78 strumenti totali (75 core + 3 gestione file) per strumenti di codifica IA esterni.

## Export SVG

Esporta i nodi selezionati come PNG, JPG, WEBP o SVG. CLI: `bun open-pencil export --format svg file.fig`.

## Copia come

Il sottomenu **Copia come** del menu contestuale offre: Copia come testo, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), JSX.

## Allineamento contorno e spessori per lato

Allineamento: **Interno**, **Centro** o **Esterno**. Spessori individuali per lato (Alto/Destra/Basso/Sinistra).

## Layout mobile & PWA

Installabile come PWA. Su mobile, i pannelli laterali sono sostituiti da un cassetto inferiore scorrevole con schede.

## Export Tailwind CSS v4

La scheda Codice offre un selettore tra **OpenPencil JSX** e **Tailwind CSS v4** (HTML con classi utility).

## Google Fonts Fallback

Se un font non è disponibile localmente, OpenPencil lo carica automaticamente da Google Fonts API.

## Homebrew Tap

Su macOS: `brew install open-pencil/tap/open-pencil`

## Rinomina inline livelli

Doppio click sul nome di un livello per rinominarlo. Invio o clic altrove conferma, Esc annulla.

## Profiler di rendering

Overlay HUD con metriche di timing. Accessibile dal menu Visualizza.

## Pannello codice

Il tab Codice mostra il JSX della selezione con evidenziazione sintassi Prism.js e copia.

## Qualità del codice

Rilevamento copia-incolla via jscpd — duplicazione ridotta dal 15,6% allo 0,62%. Pipeline di importazione ottimizzato da O(n²) a O(n).
