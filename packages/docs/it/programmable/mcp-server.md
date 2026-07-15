---
title: MCP Server
description: Connetti strumenti di IA a OpenPencil per ispezione e modifica dei design tramite Model Context Protocol.
---

# MCP Server

OpenPencil include un server MCP (Model Context Protocol) che permette agli strumenti di IA — Claude Code, Cursor, Windsurf, ecc. — di leggere e modificare i design nell'app in esecuzione. Due binari:

- **`openpencil-mcp`** — trasporto stdio per client MCP
- **`openpencil-mcp-http`** — server HTTP + WebSocket per browser, script e il bridge interno dell'app

## Prerequisiti

Prima di collegare qualsiasi client:

1. L'app desktop OpenPencil deve essere in esecuzione **con un documento aperto**. Il server MCP è un bridge, non un renderer — non funziona senza l'app.
2. La versione del pacchetto MCP deve corrispondere alla versione dell'app. L'endpoint `/health` riporta le versioni così che i client possano rilevare versioni non compatibili.

Il server MCP si avvia automaticamente all'apertura dell'app desktop (i build Tauri lanciano `openpencil-mcp-http`; in dev usa un plugin Vite). Puoi anche eseguirlo autonomamente.

## Architettura

```text
  Client MCP          Server MCP              App OpenPencil
  (Claude Code,       (openpencil-mcp-http)   (desktop / browser)
   Cursor, etc.)
                      ┌──────────────┐
  stdio ◄───────────► │  /rpc (HTTP) │ ◄──── JSON-RPC ─────► Stdio bridge
                      │              │
                      │  /    (WS)   │ ◄──── WebSocket ────► Scheda browser
  (openpencil-mcp)    │              │
                      │  /mcp (HTTP) │ ◄──── Streamable HTTP ─────► Strumenti esterni
                      │              │
                      │  /health     │
                      └──────┬───────┘
                             │
                    socket o TCP (127.0.0.1)
```

Il bridge stdio (`openpencil-mcp`) si connette al server HTTP via socket Unix (su macOS/Linux) o TCP (su Windows, dove i socket Unix non sono supportati). Non parla MCP direttamente con l'app — invia le chiamate MCP tramite HTTP al server, che le inoltra all'app via WebSocket.

## Come si collega

Il server scrive un **file di discovery** all'avvio. Il bridge stdio legge questo file per trovare il server. Nessuna configurazione manuale necessaria.

### Posizione del file di discovery

| Piattaforma | Percorso |
|-------------|----------|
| macOS | `~/Library/Application Support/OpenPencil/mcp.json` |
| Linux | `$XDG_RUNTIME_DIR/openpencil/mcp.json` (fallback: `~/.openpencil/mcp.json`) |
| Windows | `%LOCALAPPDATA%\OpenPencil\mcp.json` |

`OPENPENCIL_MCP_SOCKET` (solo macOS/Linux) sovrascrive solo il percorso del socket — il file di discovery rimane nel percorso della piattaforma sopra indicato a meno che non sia impostato `OPENPENCIL_MCP_DISCOVERY_PATH`.

### Contenuto del file di discovery

```json
{
  "pid": 12345,
  "socketPath": "~/Library/Application Support/OpenPencil/mcp.sock",
  "httpPort": 7600,
  "authRequired": true,
  "authToken": "<redacted-auth-token>",
  "version": "0.13.2",
  "startedAt": "2026-06-01T12:00:00.000Z"
}
```

Il file viene scritto con permessi `0o600` (solo lettura/scrittura del proprietario). Questo impedisce ad altri utenti del SO di leggere il token di autenticazione, ma qualsiasi processo eseguito come **il tuo utente** può leggerlo.

### Selezione del trasporto

| Piattaforma | Primario | Fallback |
|-------------|----------|----------|
| macOS / Linux | Socket Unix | TCP su `127.0.0.1:7600` |
| Windows | TCP su `127.0.0.1:7600` | — |

Su macOS/Linux, il bridge stdio preferisce il socket Unix. Se il server è stato avviato solo con TCP, il bridge usa `httpPort` dal file di discovery. Su Windows, il bridge usa esclusivamente TCP poiché Windows non supporta i socket Unix.

## Installare

```sh
npm install -g @open-pencil/mcp
```

## Stdio (Claude Code, Cursor, ecc.)

Il bridge stdio scopre automaticamente il server MCP tramite il file di discovery. Non serve configurare percorso socket o porta — assicurati solo che l'app sia aperta.

### Claude Code

```sh
npm install -g @open-pencil/mcp
claude mcp add --scope user open-pencil -- openpencil-mcp
```

Verifica:

```sh
claude mcp list
```

Claude Code chiede prima di usare ogni strumento MCP. Per auto-approvare gli strumenti OpenPencil, aggiungi a `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__open-pencil__*"]
  }
}
```

Esempio di prompt:

```text
Usa il server MCP open-pencil per ispezionare la pagina corrente e creare una piccola sezione hero sul canvas.
```

### Altri client MCP

Aggiungi alla tua configurazione MCP (es. `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Esegui dal sorgente senza installare:

::: code-group

```json [Bun]
{
  "mcpServers": {
    "open-pencil": {
      "command": "bun",
      "args": ["/percorso/a/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
```json [Node.js]
{
  "mcpServers": {
    "open-pencil": {
      "command": "npx",
      "args": ["tsx", "/percorso/a/open-pencil/packages/mcp/src/stdio.ts"]
    }
  }
}
```
:::

## HTTP

Per estensioni browser, script, CI, o qualsiasi client HTTP:

```sh
openpencil-mcp-http
```

O dal sorgente: `bun packages/mcp/src/index.ts` / `npx tsx packages/mcp/src/index.ts`

### Endpoint

| Endpoint | Metodo | Auth | Descrizione |
|----------|--------|------|-------------|
| `/health` | GET | No | Stato server, versione, comando installazione |
| `/rpc` | POST | Bearer token | Bridge JSON-RPC all'app in esecuzione |
| `/mcp` | POST, DELETE | Bearer token o `x-mcp-token` | MCP Streamable HTTP. Sessioni via header `mcp-session-id`. DELETE chiude una sessione |

Nota: L'endpoint `/mcp` utilizza solo il trasporto Streamable HTTP. Il vecchio trasporto SSE non è supportato.

### Autenticazione

Un token di autenticazione viene **generato automaticamente all'avvio** (32-hex casuale da `crypto.randomBytes`). I client devono inviarlo come `Authorization: Bearer <token>` per `/rpc`, o come `Authorization: Bearer <token>` o header `x-mcp-token` per `/mcp`. Il confronto usa tempo costante (`crypto.timingSafeEqual`) per prevenire attacchi timing.

| Scenario | Da dove viene il token |
|----------|----------------------|
| Bridge stdio (`openpencil-mcp`) | Legge `authToken` dal file di discovery automaticamente |
| Interno (Tauri/browser) | Calcola il percorso del file di discovery localmente |
| Client HTTP personalizzato | Imposta `OPENPENCIL_MCP_AUTH_TOKEN` su server e client, o leggi il file di discovery |

Per **disabilitare** l'autenticazione (es. sviluppo locale dietro firewall), imposta `OPENPENCIL_MCP_AUTH_TOKEN=""` prima di avviare il server:

```sh
OPENPENCIL_MCP_AUTH_TOKEN="" openpencil-mcp-http
```

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `PORT` | `7600` | Porta TCP. `0` per disabilitare TCP. ⚠️ Su Windows, `PORT=0` disabilita l'unico trasporto disponibile, rendendo il server irraggiungibile. |
| `OPENPENCIL_MCP_SOCKET` | Per piattaforma | Sovrascrivi percorso socket (solo macOS/Linux — Windows non supporta i socket Unix) |
| `OPENPENCIL_MCP_DISCOVERY_PATH` | Per piattaforma | Sovrascrivi posizione del file di discovery (`mcp.json`) (solo server/test; l'app desktop calcola il proprio percorso predefinito della piattaforma) |
| `OPENPENCIL_MCP_TCP` | Deprecato | Nessun effetto — TCP è controllato da `PORT` (>0 = attivo, 0 = disattivato) |
| `OPENPENCIL_MCP_AUTH_TOKEN` | Auto-generato | Token auth del server. Se non impostato, viene generato automaticamente; se impostato a stringa vuota (`""`), l'autenticazione viene disabilitata. |
| `OPENPENCIL_MCP_ROOT` | `cwd()` | Directory scope per `open_file`, `new_document` e export con scrittura. `save_file` è sempre disponibile; il percorso viene validato contro questa directory quando impostato |
| `OPENPENCIL_MCP_EVAL` | Disabilitato | `1` per abilitare `eval` (solo stdio, mai HTTP) |
| `OPENPENCIL_MCP_CORS_ORIGIN` | Disabilitato | Origine CORS consentita per accesso browser |

### Sicurezza predefinita

- Bind su `127.0.0.1` — non esposto alla rete
- Strumento `eval` disabilitato di default; disponibile solo via stdio, mai HTTP
- Operazioni file limitate a `OPENPENCIL_MCP_ROOT` — symlink risolti per prevenire path traversal
- CORS disabilitato di default
- Permessi socket `0o600` su Unix — restringe l'accesso al tuo utente
- Permessi file di discovery `0o600` — stessa restrizione

**Limitazione nota:** Su Unix, c'è una breve finestra tra `listen()` e `chmod(0o600)` dove il socket ha permessi predefiniti. Il token di autenticazione mitiga questo — anche se un altro processo si connette durante la finestra, ha bisogno del token. Nessuna mitigazione quando l'autenticazione è disabilitata (`OPENPENCIL_MCP_AUTH_TOKEN=""`) su macchine condivise.

## Risoluzione problemi

### "OpenPencil app is not connected"

Il server MCP è in esecuzione ma nessuna scheda browser è connessa. **Apri l'app desktop OpenPencil** (o naviga all'URL dell'app in un browser) e assicurati che un documento sia caricato. L'app si connette al server via WebSocket all'apertura.

### "Port 7600 already in use"

Un'altra istanza di OpenPencil (o un altro processo) sta usando la porta 7600. Soluzioni:

- Chiudi l'altra istanza
- Imposta `PORT=7601` (o qualsiasi porta libera) prima di avviare
- Su macOS/Linux: imposta `PORT=0` per disabilitare TCP e usare solo socket Unix (su Windows, `PORT=0` disabilita l'unico trasporto disponibile — scegli un'altra porta libera)

### Errori "stale socket" su macOS/Linux

Se l'app si chiude senza pulizia, il file socket può rimanere. Il server pulisce socket stale all'avvio (verifica se il socket è attivo prima di rimuoverlo). Se la pulizia fallisce:

```sh
rm ~/Library/Application\ Support/OpenPencil/mcp.sock
```

### Versione incompatibile

L'endpoint `/health` restituisce la `version` del server. L'app verifica alla connessione e avvisa se le versioni non corrispondono. Aggiorna il pacchetto globale:

```sh
npm install -g @open-pencil/mcp@latest
```

### Il bridge stdio non trova il server

Il bridge legge il file di discovery per localizzare il server. Se manca o è stale (PID non più attivo):

1. Controlla che il file di discovery esista nel percorso della tua piattaforma
2. Se TCP è abilitato (`PORT` non è `0`), verifica che il server sia in esecuzione: `curl http://127.0.0.1:${PORT:-7600}/health`
3. Su Windows (trasporto solo TCP), verifica che `httpPort` del server sia raggiungibile

## Flusso di lavoro

1. **Aprire** — `open_file` per caricare un `.fig` esistente, o `new_document` per canvas vuoto
2. **Leggere** — `get_page_tree`, `find_nodes`, `get_node`, `list_pages`
3. **Creare** — `create_shape`, `render` (JSX)
4. **Modificare** — `set_fill`, `set_stroke`, `set_layout`, `update_node`, `set_effects`
5. **Struttura** — `reparent_node`, `group_nodes`, `clone_node`, `delete_node`
6. **Salvare** — `save_file` per scrivere su `.fig`

## AI Agent Skill

Insegna al tuo agente IA a usare gli strumenti OpenPencil:

```sh
npx skills add open-pencil/skills@open-pencil
```

Funziona con Claude Code, Cursor, Windsurf, Codex e qualsiasi agente che supporti [skills](https://skills.sh). Lo skill copre il CLI, strumenti MCP, rendering JSX, eval e il bridge di automazione dell'app.

## Strumenti (91)

### Documento

| Strumento | Descrizione |
|-----------|-------------|
| `open_file` | Apri un file `.fig` per modifica |
| `save_file` | Salva il documento corrente su un file `.fig` |
| `new_document` | Crea un nuovo documento vuoto |
| `list_documents` | Elenca i documenti/le schede aperti dell'app e le relative pagine |

Nota: `open_file`, `new_document` e gli strumenti di esportazione che scrivono file sono sempre disponibili — i loro percorsi sono limitati a `OPENPENCIL_MCP_ROOT`, che per impostazione predefinita corrisponde alla directory di lavoro corrente (`cwd()`) quando non impostato. `save_file` è sempre disponibile; il suo percorso viene validato contro `OPENPENCIL_MCP_ROOT` solo quando la radice è configurata.

### Lettura

| Strumento | Descrizione |
|-----------|-------------|
| `get_selection` | Ottieni nodi attualmente selezionati |
| `get_page_tree` | Ottieni l'albero completo dei nodi della pagina corrente |
| `get_current_page` | Ottieni nome e ID della pagina corrente |
| `get_node` | Ottieni proprietà dettagliate di un nodo per ID |
| `find_nodes` | Cerca nodi per pattern nome e/o tipo |
| `get_components` | Elenca tutti i componenti nel documento |
| `list_pages` | Elenca tutte le pagine |
| `list_variables` | Elenca variabili di design |
| `list_collections` | Elenca collezioni di variabili |
| `list_fonts` | Elenca font usate nella pagina corrente |
| `page_bounds` | Ottieni bounding box di tutti gli oggetti nella pagina |
| `node_bounds` | Ottieni bounding box di un nodo |
| `node_ancestors` | Ottieni catena di antenati di un nodo |
| `node_children` | Ottieni figli diretti di un nodo |
| `node_tree` | Ottieni sottoalbero di un nodo |
| `node_bindings` | Ottieni binding di variabili su un nodo |

### Creazione

| Strumento | Descrizione |
|-----------|-------------|
| `create_shape` | Crea una forma (`FRAME`, `RECTANGLE`, `ELLIPSE`, `TEXT`, `LINE`, `STAR`, `POLYGON`, `SECTION`) |
| `create_vector` | Crea un nodo vettoriale da una stringa path |
| `create_slice` | Crea uno slice di esportazione |
| `create_page` | Crea una nuova pagina |
| `render` | Renderizza JSX in nodi di design — crea alberi di componenti in una chiamata |
| `create_component` | Converti un frame/group in componente |
| `create_instance` | Crea un'istanza di un componente |
| `node_to_component` | Converti un nodo esistente in componente in-place |

### Modifica

| Strumento | Descrizione |
|-----------|-------------|
| `set_fill` | Imposta colore riempimento (hex) |
| `set_stroke` | Imposta colore, peso e allineamento bordo |
| `set_effects` | Aggiungi ombre o effetti sfocatura |
| `update_node` | Aggiorna posizione, dimensione, opacità, raggio angolo, testo, font |
| `set_layout` | Imposta auto-layout (flexbox) — direzione, spaziatura, padding, allineamento |
| `set_constraints` | Imposta vincoli di ridimensionamento |
| `set_rotation` | Imposta angolo di rotazione in gradi |
| `set_opacity` | Imposta opacità (0–1) |
| `set_radius` | Imposta raggio angolo (uniforme o per angolo) |
| `set_minmax` | Imposta vincoli min/max larghezza e altezza |
| `set_text` | Imposta contenuto testo di un nodo `TEXT` |
| `set_font` | Imposta famiglia e peso font |
| `set_font_range` | Imposta proprietà font su un range di caratteri |
| `set_text_resize` | Imposta modalità auto-ridimensionamento testo |
| `set_visible` | Mostra o nascondi un nodo |
| `set_blend` | Imposta modalità blend |
| `set_locked` | Blocca o sblocca un nodo |
| `set_stroke_align` | Imposta allineamento bordo (interno/centro/esterno) |
| `set_text_properties` | Imposta layout testo: allineamento, auto-ridimensionamento, decorazione, troncamento |
| `set_layout_child` | Configura figlio auto-layout: sizing, grow, allineamento, posizionamento assoluto |
| `node_move` | Sposta un nodo in una nuova posizione |
| `node_resize` | Ridimensiona un nodo |
| `node_replace_with` | Sostituisci un nodo con un altro |
| `arrange` | Allinea o distribuisci nodi selezionati |

### Struttura

| Strumento | Descrizione |
|-----------|-------------|
| `delete_node` | Elimina un nodo |
| `clone_node` | Duplica un nodo |
| `rename_node` | Rinomina un nodo |
| `reparent_node` | Sposta un nodo in un altro padre |
| `select_nodes` | Seleziona nodi per ID |
| `group_nodes` | Raggruppa nodi |
| `ungroup_node` | Separa un gruppo |
| `flatten_nodes` | Appiattisci nodi in un singolo vettore |
| `boolean_union` | Unione booleana di due o più nodi |
| `boolean_subtract` | Sottrazione booleana |
| `boolean_intersect` | Intersezione booleana |
| `boolean_exclude` | Esclusione booleana |

### Percorso vettoriale

| Strumento | Descrizione |
|-----------|-------------|
| `path_get` | Ottieni dati percorso di un nodo vettoriale |
| `path_set` | Imposta dati percorso su un nodo vettoriale |
| `path_scale` | Scala un percorso vettoriale |
| `path_flip` | Capovolgi un percorso orizzontalmente o verticalmente |
| `path_move` | Trasla un percorso vettoriale |

### Esportazione

| Strumento | Descrizione |
|-----------|-------------|
| `export_image` | Esporta nodi come PNG, JPG o WEBP. Restituisce dati immagine in base64 |
| `export_svg` | Esporta nodi come markup SVG |

### Viewport

| Strumento | Descrizione |
|-----------|-------------|
| `viewport_get` | Ottieni posizione e zoom correnti del viewport |
| `viewport_set` | Imposta posizione e zoom del viewport |
| `viewport_zoom_to_fit` | Adatta zoom per mostrare i nodi specificati |

### Variabili

| Strumento | Descrizione |
|-----------|-------------|
| `get_variable` | Ottieni una variabile per ID o nome |
| `find_variables` | Cerca variabili per pattern nome o tipo |
| `create_variable` | Crea una nuova variabile in una collezione |
| `set_variable` | Imposta valore variabile in una modalità |
| `delete_variable` | Elimina una variabile |
| `bind_variable` | Lega variabile a proprietà di un nodo |
| `get_collection` | Ottieni collezione variabili per ID o nome |
| `create_collection` | Crea una nuova collezione variabili |
| `delete_collection` | Elimina una collezione variabili |

### Analisi

| Strumento | Descrizione |
|-----------|-------------|
| `analyze_colors` | Analizza palette colori del documento |
| `analyze_typography` | Analizza distribuzione font/dimensioni/pesi |
| `analyze_spacing` | Analizza valori gap e padding |
| `analyze_clusters` | Rileva pattern ripetuti (potenziali componenti) |

### Diff

| Strumento | Descrizione |
|-----------|-------------|
| `diff_create` | Crea snapshot dello stato corrente del documento |
| `diff_show` | Mostra differenze tra lo stato corrente e uno snapshot |

### Navigazione

| Strumento | Descrizione |
|-----------|-------------|
| `switch_page` | Passa a una pagina per nome o ID |

### Escape Hatch

| Strumento | Descrizione |
|-----------|-------------|
| `eval` | Esegui JavaScript con accesso completo alla Figma Plugin API |

Nota: `eval` è disponibile via stdio, ma disabilitato in modalità HTTP per sicurezza.
