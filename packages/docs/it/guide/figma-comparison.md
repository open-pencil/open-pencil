# Matrice funzionalità Figma

Confronto funzionalità per funzionalità delle capacità di Figma Design con lo stato di implementazione attuale di Open Pencil.

::: tip Legenda stati
✅ Supportato — la funzionalità è completa · 🟡 Parziale — il comportamento di base esiste, mancano alcune sotto-funzionalità · 🔲 Non ancora implementato
:::

**Copertura:** 94 dei 158 elementi Figma affrontati — 76 ✅ completamente supportati, 18 🟡 parziali, 64 🔲 in sospeso. Ultimo aggiornamento: 2026-03-07.

## Interfaccia e navigazione

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Barra strumenti di design | ✅ | Barra inferiore (stile UI3): Selezione, Frame, Sezione, Rettangolo, Ellisse, Linea, Testo, Mano, Penna |
| Pannello livelli (barra laterale sinistra) | ✅ | Vista ad albero con espansione/compressione, riordinamento per trascinamento, toggle visibilità; larghezza ridimensionabile |
| Pannello pagine | ✅ | Aggiungere, eliminare, rinominare pagine; stato viewport per pagina |
| Pannello proprietà (barra laterale destra) | ✅ | Sezioni: Aspetto, Riempimento, Contorno, Effetti, Tipografia, Layout, Posizione; larghezza ridimensionabile |
| Zoom e panoramica | ✅ | <kbd>Ctrl</kbd> + scroll, pinch, <kbd>⌘</kbd><kbd>+</kbd> / <kbd>⌘</kbd><kbd>−</kbd> / <kbd>⌘</kbd><kbd>0</kbd>, spazio+trascinamento, mouse centrale, strumento mano (H) |
| Righelli canvas | ✅ | Righelli superiore/sinistro con bande di selezione e badge di coordinate |
| Colore di sfondo del canvas | ✅ | Sfondo per pagina tramite pannello proprietà |
| Guide del canvas | 🔲 | Figma supporta guide trascinabili dai righelli |
| Menu azioni / palette comandi | 🔲 | Ricerca azioni rapide di Figma |
| Menu contestuale | ✅ | Clic destro con appunti, ordine-z, raggruppamento, componente, visibilità, blocco, sposta-a-pagina |
| Scorciatoie tastiera | 🟡 | Scorciatoie base + componenti + ordine-z + visibilità/blocco implementate; Scala, Freccia, Matita, ribaltamento, formattazione testo non ancora collegati |
| Cerca e sostituisci | 🔲 | Ricerca/sostituzione testo nel documento |
| Vista contorni livelli | 🔲 | Vista wireframe di tutti i livelli |
| Miniature personalizzate | 🔲 | Miniatura generata all'export, ma nessun selettore personalizzato |
| Impostazioni valore nudge | 🔲 | Default 1px/10px; Figma consente valori personalizzati |
| Menu app (modalità browser) | ✅ | Menu File, Modifica, Visualizza, Oggetto, Testo, Disponi; Tauri usa menu nativi |
| Strumenti IA | 🟡 | 90 strumenti via OpenRouter + server MCP; nessuna immagine generata da IA o ricerca IA ancora |

## Livelli e forme

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Strumenti forma (Rettangolo, Ellisse, Linea, Poligono, Stella) | ✅ | Tutti i tipi di forma base; lati poligono e raggio interno stella configurabili |
| Frame | ✅ | Ritaglio contenuto, sistema di coordinate indipendente |
| Gruppi | ✅ | <kbd>⌘</kbd><kbd>G</kbd> per raggruppare, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> per separare |
| Sezioni | ✅ | Pillole titolo, auto-adozione nodi sovrapposti, testo adattivo alla luminanza |
| Strumento arco (archi, semicerchi, anelli) | ✅ | arcData con angolo inizio/fine e raggio interno |
| Strumento matita (mano libera) | 🔲 | Strumento di disegno a mano libera di Figma |
| Maschere | 🔲 | Maschere di forma per ritagliare livelli |
| Tipi di livello e gerarchia | ✅ | 17 tipi di nodo, Map piatta + albero genitore-figlio |
| Selezionare livelli | ✅ | Clic, shift-clic, selezione a marquee |
| Allineamento e posizione | ✅ | Posizione, rotazione, dimensioni nel pannello |
| Copiare e incollare oggetti | ✅ | Appunti standard + formato binario Kiwi di Figma |
| Scalare livelli proporzionalmente | 🟡 | Shift-ridimensiona mantiene proporzioni; nessuno strumento Scale dedicato (K) |
| Bloccare e sbloccare livelli | ✅ | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> alterna blocco |
| Toggle visibilità livello | ✅ | Icona occhio nel pannello + scorciatoia <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> |
| Rinominare livelli | ✅ | Doppio clic per rinomina inline; Invio/Esc/clic per confermare |
| Porta in primo piano / Invia in fondo | ✅ | Scorciatoie ] e [; anche nel menu contestuale |
| Sposta a pagina | ✅ | Spostare nodi tra pagine tramite menu contestuale |
| Vincoli (ridimensionamento responsivo) | 🔲 | Fissare bordi/centro per comportamento resize genitore |
| Selezione intelligente (distribuire/allineare) | 🔲 | Spaziare e allineare uniformemente |
| Guide di layout (colonne, righe, griglia) | 🔲 | Guide colonna/riga/griglia sui frame |
| Misurare distanze tra livelli | 🔲 | Alt-hover per mostrare distanze |
| Modificare oggetti in blocco | ✅ | Pannello multi-selezione: valori condivisi normali, valori diversi mostrano "Mixed" |
| Identificare oggetti corrispondenti | 🔲 | Trovare livelli simili |
| Copiare/incollare proprietà | 🔲 | Copiare riempimento/contorno/effetti tra livelli |
| Relazioni genitore-figlio | ✅ | Gerarchia completa con parentIndex, ri-parentamento per trascinamento |

## Strumenti vettoriali

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Reti vettoriali | ✅ | Modello compatibile Figma, non percorsi semplici |
| Strumento penna | ✅ | Punti angolari, curve di Bézier, percorsi aperti/chiusi |
| Modificare livelli vettoriali | 🟡 | Creazione funziona; modifica avanzata vertici limitata |
| Operazioni booleane (Unione, Sottrazione, Intersezione, Esclusione) | 🔲 | Combinare forme con operazioni booleane |
| Appiattire livelli | 🔲 | Unire percorsi vettoriali |
| Convertire contorni in percorsi | 🔲 | Comando Outline Stroke |
| Convertire testo in percorsi | 🔲 | Appiattire testo in contorni vettoriali |
| Strumento shape builder | 🔲 | Strumento booleano interattivo |
| Offset percorso | 🔲 | Inset/outset di un percorso vettoriale |
| Semplificare percorso | 🔲 | Ridurre numero punti vettoriali |

## Testo e tipografia

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Strumento testo e modifica inline | ✅ | Modifica nativa sul canvas, textarea phantom, style run (<kbd>⌘</kbd><kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd>, pulsante S) |
| Rendering testo (Paragraph API) | ✅ | CanvasKit Paragraph per shaping, interruzione riga, metriche |
| Caricamento font (font di sistema) | ✅ | Inter default, font-kit in Tauri con cache OnceLock, queryLocalFonts nel browser |
| Famiglia e peso font | ✅ | FontPicker con scroll virtuale, ricerca, anteprima CSS |
| Dimensione font e altezza riga | ✅ | Modificabile nella sezione tipografia |
| Allineamento testo | 🟡 | Allineamento base; Figma ha allineamento verticale e modi auto-larghezza/altezza |
| Stili di testo | 🟡 | Grassetto/corsivo/sottolineato/barrato per selezione; nessun preset riutilizzabile ancora |
| Modi ridimensionamento testo | 🔲 | Modi auto-larghezza, auto-altezza, dimensione-fissa di Figma |
| Liste puntate e numerate | 🔲 | Formattazione liste nel testo |
| Link nel testo | 🔲 | Iperlink nel contenuto testo |
| Emoji e simboli intelligenti | 🔲 | Rendering emoji e caratteri speciali |
| Funzionalità OpenType | 🔲 | Legature, alternative stilistiche, cifre tabulari |
| Font variabili | 🔲 | Assi font regolabili (peso, larghezza, inclinazione) |
| Supporto testo CJK | 🔲 | Rendering testo cinese, giapponese, coreano |
| Supporto testo RTL | 🔲 | Layout testo da destra a sinistra |
| Font icone | 🔲 | Gestione speciale per glifi font icone |

## Colore, gradienti e immagini

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Selettore colore (HSV) | ✅ | Quadrato HSV, slider tonalità, slider alfa, input hex |
| Riempimenti solidi | ✅ | Colore hex con opacità |
| Gradiente lineare | ✅ | Stop gradiente, maniglie di trasformazione |
| Gradiente radiale | ✅ | Rendering via shader CanvasKit |
| Gradiente angolare | ✅ | Supporto gradiente sweep/conico |
| Gradiente diamante | ✅ | Gradiente diamante a quattro punti |
| Riempimenti immagine | ✅ | Decodificati da dati blob con modi scala (fill, fit, crop, tile) |
| Riempimenti pattern | 🔲 | Riempimenti immagine/pattern ripetitivi |
| Modi fusione | 🔲 | Modi fusione livello e riempimento (multiply, screen, overlay, ecc.) |
| Aggiungere immagini e video | 🟡 | Riempimenti immagine renderizzati; nessun import drag-and-drop né supporto video |
| Regolazione proprietà immagine | 🔲 | Esposizione, contrasto, saturazione, ecc. |
| Ritagliare un'immagine | 🔲 | Ritaglio interattivo immagini |
| Strumento contagocce | 🔲 | Campionare colori dal canvas |
| Modifica colore in selezione mista | 🔲 | Regolare colori in selezione eterogenea |
| Modelli colore (RGB, HSL, HSB, Hex) | 🟡 | HSV + Hex nel selettore; nessun toggle modo HSL o RGB |

## Effetti e proprietà

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Ombra portata | ✅ | Offset, raggio sfocatura, colore via filtri CanvasKit |
| Ombra interna | ✅ | Effetto ombra inset |
| Sfocatura livello | ✅ | Sfocatura gaussiana sul livello |
| Sfocatura sfondo | ✅ | Sfocare contenuto dietro il livello |
| Sfocatura primo piano | ✅ | Sfocatura in primo piano |
| Spessore contorno | ✅ | Configurabile nel pannello proprietà |
| Estremità contorno (round, square, arrow) | ✅ | `NONE`, `ROUND`, `SQUARE`, `ARROW_LINES`, `ARROW_EQUILATERAL` |
| Giunzione contorno (miter, bevel, round) | ✅ | Tutti e tre i tipi di giunzione |
| Pattern tratteggio | ✅ | Pattern contorno dash-on/dash-off |
| Raggio angolo | ✅ | Raggio uniforme e per angolo con toggle indipendente |
| Smussatura angolo (stile iOS) | 🔲 | Arrotondamento continuo degli angoli di Figma |
| Riempimenti/contorni multipli per livello | 🔲 | Figma consente di impilare riempimenti e contorni |

## Auto Layout

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Flusso orizzontale e verticale | ✅ | Motore flexbox Yoga WASM |
| Toggle auto layout (<kbd>⇧</kbd><kbd>A</kbd>) | ✅ | Toggle su frame o avvolgi selezione |
| Gap (spaziatura tra figli) | ✅ | Configurabile nel pannello proprietà |
| Padding (uniforme e per lato) | ✅ | Tutti e quattro i lati indipendentemente |
| Justify content | ✅ | Start, center, end, space-between |
| Align items | ✅ | Start, center, end, stretch |
| Dimensionamento figli (fisso, riempimento, adatta) | ✅ | Modi dimensionamento per figlio |
| Wrap | ✅ | Flex wrap per layout multi-riga |
| Flusso auto layout griglia | ✅ | CSS Grid tramite fork Yoga — track colonne/righe, gap, span |
| Flussi combinati (annidati) | ✅ | Frame auto-layout annidati con direzioni diverse |
| Riordinare trascinando in auto layout | ✅ | Indicatore visivo di inserimento |
| Larghezza/altezza min e max | 🔲 | Figma supporta vincoli min/max |

## Componenti e sistemi di design

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Creare componenti | 🟡 | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> crea da frame/gruppo; nessuna UI proprietà componente ancora |
| Set di componenti | 🟡 | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> combina componenti; bordo tratteggiato viola; nessuna modifica proprietà variante |
| Istanze di componenti | 🟡 | Creare istanza dal menu contestuale; sync in tempo reale; nessuna UI modifica override |
| Varianti | 🔲 | Cambio variante e selezione per proprietà |
| Proprietà componente | 🔲 | Proprietà booleane, testo, scambio istanza |
| Propagazione override | ✅ | Modifiche al componente principale propagate; override preservati |
| Variabili (colore, numero, stringa, booleano) | 🟡 | `COLOR` con UI completa; `FLOAT`/STRING/BOOLEAN definiti senza UI di modifica |
| Collezioni e modi variabili | 🟡 | Collezioni, modi, cambio activeMode funzionano; nessuna UI tematizzazione |
| Stili (colore, testo, effetto, layout) | 🔲 | Preset stile riutilizzabili nominati |
| Librerie (pubblicare, condividere, aggiornare) | 🔲 | Librerie condivise componenti/stili |
| Staccare istanza | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> converte istanza in frame |
| Vai al componente principale | ✅ | Navigare al componente sorgente, cross-page |

## Prototipazione

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Connessioni prototipo | 🔲 | Pianificato per Fase 6 |
| Trigger (clic, hover, trascinamento, ecc.) | 🔲 | Pianificato per Fase 6 |
| Azioni (navigare, overlay, scroll, ecc.) | 🔲 | Pianificato per Fase 6 |
| Animazioni e transizioni | 🔲 | Pianificato per Fase 6 |
| Smart animate | 🔲 | Auto-animare livelli corrispondenti |
| Overlay | 🔲 | Prototipazione modale/popover |
| Comportamento scroll e overflow | 🔲 | Frame scrollabili nei prototipi |
| Flussi prototipo | 🔲 | Punti di partenza nominati |
| Variabili nei prototipi | 🔲 | Logica condizionale con variabili |
| Easing e animazioni spring | 🔲 | Curve di animazione personalizzate |
| Presentare e riprodurre prototipi | 🔲 | Visualizzatore prototipo a schermo intero |

## Import e export

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Import file .fig | ✅ | Codec Kiwi completo: 194 definizioni, ~390 campi per `NodeChange` |
| Export file .fig | ✅ | Codifica Kiwi + compressione Zstd + generazione miniatura |
| Salva / Salva con nome | ✅ | <kbd>⌘</kbd><kbd>S</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>; dialoghi nativi (Tauri), File System Access API (Chrome/Edge), download fallback (Safari) |
| Appunti Figma (incolla) | ✅ | Decodificare binario Kiwi dagli appunti Figma |
| Appunti Figma (copia) | ✅ | Codificare binario Kiwi leggibile da Figma |
| Import file Sketch | 🔲 | Parsing file .sketch |
| Export immagine/SVG | 🟡 | PNG/JPG/WEBP con selettore scala e anteprima; WEBP/SVG export ✅; PDF export 🔲 |
| Cronologia versioni | 🔲 | Sfogliare e ripristinare versioni precedenti |
| Copiare asset tra strumenti | 🟡 | Appunti Figma funzionano; Copia come testo/SVG/PNG/JSX |

## API plugin e scripting

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Comando eval con Figma Plugin API | ✅ | Esecuzione headless JavaScript con oggetto globale figma compatibile |

## Collaborazione e modalità sviluppatore

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Commenti (fissare, thread, risolvere) | 🔲 | Pianificato per Fase 6 |
| Multiplayer in tempo reale | ✅ | P2P via Trystero + Yjs CRDT, cursori, modalità segui; senza server |
| Chat al cursore | 🔲 | Bolle chat inline al cursore |
| Branching e merging | 🔲 | Branch di versione per file di design |
| Modalità sviluppatore (ispezione) | 🟡 | <kbd>Tab</kbd> Codice mostra JSX; nessuna proprietà CSS né spec di handoff |
| Code Connect | 🔲 | Collegare componenti design al codice |
| Frammenti di codice | 🟡 | Export JSX con evidenziazione e copia; nessun frammento CSS/Swift/Kotlin |
| Figma for VS Code | 🔲 | Integrazione plugin editor |
| Server MCP | ✅ | @open-pencil/mcp con trasporti stdio + HTTP; 87 strumenti core + 3 gestione file = 90 total |
| Strumenti CLI | ✅ | CLI headless: info, tree, find, export, analyze, node, pages, variables, eval; server MCP |

## Figma Draw

| Funzionalità | Stato | Note |
|-------------|-------|------|
| Strumenti illustrazione | 🔲 | Strumenti di disegno specializzati di Figma Draw |
| Trasformazioni pattern | 🔲 | Creare pattern ripetitivi con trasformazioni |
