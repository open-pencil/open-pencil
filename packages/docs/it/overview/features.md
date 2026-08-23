# Funzionalità

## File Figma

OpenPencil apre e salva direttamente i file `.fig`. Import ed export usano lo stesso codec binario Kiwi di Figma: 194 definizioni dello schema e circa 390 campi per ogni nodo. Salva con <kbd>⌘</kbd><kbd>S</kbd> e salva con nome con <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Copia e incolla con Figma:** seleziona gli oggetti in Figma, premi <kbd>⌘</kbd><kbd>C</kbd>, passa a OpenPencil e premi <kbd>⌘</kbd><kbd>V</kbd>. Riempimenti, contorni, disposizione automatica, testo, effetti, raggi degli angoli e reti vettoriali vengono conservati in entrambe le direzioni.

## Disegno e modifica

- **Forme:** rettangolo (<kbd>R</kbd>), ellisse (<kbd>O</kbd>), linea (<kbd>L</kbd>), poligono e stella.
- **Penna:** reti vettoriali, curve di Bézier e maniglie tangenti.
- **Testo:** modifica diretta nel canvas e supporto IME.
- **Testo formattato:** grassetto, corsivo, sottolineato e barrato su intervalli di caratteri.
- **Disposizione automatica:** Flexbox e CSS Grid tramite Yoga WASM, con direzione, intervallo, rientri, allineamento, dimensionamento e tracce della griglia.
- **Componenti:** creazione di componenti e set, istanze, override e sincronizzazione automatica.
- **Variabili:** token di design con collezioni, modalità Light/Dark, tipi Color/Float/String/Boolean e collegamenti.
- **Sezioni:** contenitori di primo livello che integrano gli oggetti sovrapposti.

## Pannello Proprietà

Le schede Design, Code e AI cambiano in base alla selezione.

- **Aspetto:** opacità, raggio comune o per angolo e visibilità.
- **Riempimento:** colore solido, gradienti lineare, radiale, angolare e diamante, immagini.
- **Contorno:** colore, spessore, allineamento, spessore per lato, estremità, giunzioni e tratteggio.
- **Effetti:** ombra esterna e interna, sfocatura del livello, dello sfondo e del primo piano.
- **Tipografia:** scelta del font con ricerca e scorrimento virtuale, stile, dimensione, allineamento e formattazione.
- **Layout:** impostazioni della disposizione automatica.
- **Export:** scala, PNG/JPG/WEBP/SVG e anteprima.

## Rendering

OpenPencil usa Skia tramite CanvasKit WASM, lo stesso motore grafico di Figma:

- gradienti lineari, radiali, angolari e a diamante;
- riempimenti immagine con diverse modalità di scala;
- cache degli effetti per oggetto;
- archi, ellissi parziali e anelli;
- esclusione degli oggetti fuori dalla vista e riuso delle vernici;
- guide di aggancio che considerano la rotazione;
- righelli con intervallo della selezione;
- evidenziazione al passaggio sulla geometria reale.

## Annulla e ripristina

È possibile annullare creazione, eliminazione, spostamento, ridimensionamento, modifica delle proprietà e del genitore, disposizione e variabili. Scorciatoie: <kbd>⌘</kbd><kbd>Z</kbd> e <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Più pagine e documenti

Le pagine possono essere create, eliminate e rinominate e conservano posizione e scala proprie. Più documenti possono essere aperti in schede.

## Export

- **Immagini:** PNG, JPG e WEBP da 0,5× a 4×.
- **SVG:** forme, testo con intervalli di stile, gradienti, effetti e metodi di fusione.
- **Tailwind JSX:** HTML con classi Tailwind v4 per React o Vue.
- **Copia come:** testo, SVG, PNG o JSX dal menu contestuale.

```sh
openpencil export design.fig -f jsx --style tailwind
```

## Chat AI

Premi <kbd>⌘</kbd><kbd>J</kbd>. Più di 90 strumenti creano forme, cambiano stili e disposizione, lavorano con componenti e variabili, eseguono operazioni booleane, analizzano token di design ed esportano risorse. Sono supportati Anthropic, OpenAI, Google AI, OpenRouter ed endpoint compatibili.

Le chiamate degli strumenti appaiono in una sequenza comprimibile. Per la verifica visiva, l’assistente renderizza il risultato e lo confronta con la richiesta. Tutte le modifiche AI possono essere annullate.

## Server MCP

Claude Code, Cursor, Windsurf e altri client MCP possono leggere e modificare `.fig` senza interfaccia. Sono disponibili più di 90 strumenti e i trasporti stdio e HTTP.

```sh
npm install -g @open-pencil/mcp
```

## CLI

```sh
openpencil tree design.fig              # Albero degli oggetti
openpencil find design.fig --type TEXT  # Ricerca
openpencil export design.fig -f png     # Esporta
openpencil analyze colors design.fig    # Analisi colori
openpencil analyze clusters design.fig  # Strutture ripetute
openpencil eval design.fig -c "..."     # Figma Plugin API
```

Tutti i comandi supportano `--json`. Installazione: `npm install -g @open-pencil/cli` oppure `bun add -g @open-pencil/cli`.

## Collaborazione in tempo reale

La connessione peer-to-peer WebRTC non richiede un server centrale. Condividi un link e modifica il documento insieme agli altri partecipanti, con cursori, presenza e modalità di seguito.

## Desktop e Web

**Desktop:** Tauri v2, circa 7 MB, per macOS, Windows e Linux, con menu nativi, uso senza rete e salvataggio automatico.

**Web:** [app.openpencil.dev](https://app.openpencil.dev), installabile come PWA e adattato agli schermi touch.

## Caricamento alternativo da Google Fonts

Se un font non è disponibile localmente, OpenPencil lo scarica automaticamente da Google Fonts. Non è necessaria l’installazione manuale.
