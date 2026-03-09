# Funzionalità

## File .fig di Figma

Apri e salva file nativi di Figma direttamente. La pipeline di importazione/esportazione utilizza lo stesso codec binario Kiwi di Figma — 194 definizioni di schema, ~390 campi per nodo. Salva con <kbd>⌘</kbd><kbd>S</kbd>, Salva con nome con <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Copia e incolla con Figma** — seleziona i nodi in Figma, <kbd>⌘</kbd><kbd>C</kbd>, passa a OpenPencil, <kbd>⌘</kbd><kbd>V</kbd>. Riempimenti, bordi, auto-layout, testo, effetti, raggi degli angoli e reti vettoriali vengono preservati. Funziona in entrambe le direzioni.

## Disegno e Modifica

- **Forme** — Rettangolo (<kbd>R</kbd>), Ellisse (<kbd>O</kbd>), Linea (<kbd>L</kbd>), Poligono, Stella
- **Strumento penna** — reti vettoriali (non semplici tracciati), curve di Bézier con maniglie tangenti
- **Testo** — modifica nativa sul canvas con supporto IME, doppio clic per entrare in modalità di modifica
- **Testo ricco** — grassetto per carattere (<kbd>⌘</kbd><kbd>B</kbd>), corsivo (<kbd>⌘</kbd><kbd>I</kbd>), sottolineato (<kbd>⌘</kbd><kbd>U</kbd>), barrato
- **Auto-layout** — flexbox tramite Yoga WASM: direzione, gap, padding, giustificazione, allineamento, dimensionamento figli. <kbd>⇧</kbd><kbd>A</kbd> per attivare/disattivare
- **Componenti** — crea (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), set di componenti (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), istanze con supporto override, sincronizzazione live
- **Variabili** — token di design con collezioni, modalità (Light/Dark), tipi colore/float/stringa/booleano, binding di variabili
- **Sezioni** — contenitori organizzativi con adozione automatica dei figli e etichette titolo

## Pannello Proprietà

Schede Design | Code | AI sensibili al contesto:

- **Aspetto** — opacità, raggio degli angoli (uniforme o per angolo), visibilità
- **Riempimento** — solido, gradiente (lineare/radiale/angolare/diamante), immagine
- **Bordo** — colore, spessore, allineamento (interno/centro/esterno), spessori per lato, terminazione, giunzione, tratteggio
- **Effetti** — ombra esterna, ombra interna, sfocatura livello, sfocatura sfondo, sfocatura primo piano
- **Tipografia** — selettore font con scroll virtuale e ricerca, peso, dimensione, allineamento, pulsanti stile
- **Layout** — controlli auto-layout quando attivo
- **Esportazione** — scala, formato (PNG/JPG/WEBP/SVG), anteprima live

## Rendering

Skia (CanvasKit WASM) — lo stesso motore di rendering di Figma:

- Riempimenti gradiente (lineare, radiale, angolare, diamante)
- Riempimenti immagine con modalità di scala
- Effetti con cache per nodo
- Dati arco (ellissi parziali, ciambelle)
- Culling del viewport e riutilizzo paint
- Guide di snap con allineamento sensibile alla rotazione
- Righelli sul canvas con badge di selezione
- Evidenziazione hover che segue la geometria reale

## Annulla/Ripristina

Ogni operazione è annullabile — creazione, eliminazione, spostamenti, ridimensionamenti, modifiche proprietà, riparentamento, modifiche layout, operazioni su variabili. Usa un pattern a comandi inversi. <kbd>⌘</kbd><kbd>Z</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Documenti Multi-Pagina

Aggiungi, elimina, rinomina pagine. Ogni pagina ha uno stato viewport indipendente. Doppio clic per rinominare inline.

## Schede Multi-File

Apri più documenti in schede. <kbd>⌘</kbd><kbd>T</kbd> nuova scheda, <kbd>⌘</kbd><kbd>W</kbd> chiudi, <kbd>⌘</kbd><kbd>O</kbd> apri file.

## Esportazione

- **Immagine** — PNG, JPG, WEBP a scala configurabile (0.5×–4×). Tramite pannello, menu contestuale o <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>
- **SVG** — forme, testo con stili per segmento, gradienti, effetti, modalità di fusione
- **Tailwind JSX** — HTML con classi utility Tailwind v4, pronto per React o Vue
- **Copia come** — testo, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), o JSX tramite menu contestuale

CLI: `open-pencil export design.fig -f jsx --style tailwind`

## Chat AI

Premi <kbd>⌘</kbd><kbd>J</kbd> per aprire l'assistente AI. 87 strumenti che possono creare forme, impostare stili, gestire layout, lavorare con componenti e variabili, eseguire operazioni booleane, analizzare token di design ed esportare risorse. Porta la tua chiave API OpenRouter.

Le chiamate agli strumenti vengono mostrate come voci di timeline comprimibili. Selettore modello con Claude, Gemini, GPT, DeepSeek e altri.

## Server MCP

Connetti Claude Code, Cursor, Windsurf o qualsiasi client MCP per leggere e scrivere file `.fig` in modalità headless. 90 strumenti (87 core + 3 gestione file). Due trasporti: stdio e HTTP.

```sh
bun add -g @open-pencil/mcp
```

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Consulta il [riferimento strumenti MCP](/programmable/mcp-server) per l'elenco completo degli strumenti.

## CLI

Ispeziona, esporta e analizza file `.fig` dal terminale:

```sh
open-pencil tree design.fig          # Albero dei nodi
open-pencil find design.fig --type TEXT  # Ricerca
open-pencil export design.fig -f png     # Render
open-pencil analyze colors design.fig    # Audit colori
open-pencil analyze clusters design.fig  # Pattern ripetuti
open-pencil eval design.fig -c "..."     # Figma Plugin API
```

Quando l'app desktop è in esecuzione, ometti il file per controllare l'editor live tramite RPC:

```sh
open-pencil tree                     # Documento live
open-pencil export -f png            # Screenshot del canvas
```

Tutti i comandi supportano `--json`. Installazione: `bun add -g @open-pencil/cli`

## Collaborazione in Tempo Reale

P2P tramite WebRTC — nessun server necessario. Condividi un link e modifica insieme.

- Cursori live con frecce colorate e etichette nome
- Avatar di presenza
- Modalità segui — clicca su un partecipante per seguire il suo viewport
- Persistenza locale tramite IndexedDB
- ID stanza sicuri tramite `crypto.getRandomValues()`

## Desktop e Web

**Desktop** — Tauri v2, ~7 MB. macOS (firmato e autenticato), Windows, Linux. Menu nativi, offline, salvataggio automatico.

**Web** — disponibile su [app.openpencil.dev](https://app.openpencil.dev), installabile come PWA su mobile con interfaccia ottimizzata per il touch.

**Homebrew:**

```sh
brew install open-pencil/tap/open-pencil
```

## Fallback Google Fonts

Quando un font non è disponibile localmente, OpenPencil lo scarica automaticamente da Google Fonts. Nessuna installazione manuale necessaria quando si aprono file .fig con font non familiari.
