---
pageClass: guide
title: Agenti di programmazione
description: Usa Claude Code, Codex, Cursor o un altro agente di programmazione che hai già come IA nell’app desktop di OpenPencil.
---

# Agenti di programmazione

L’app desktop può usare come IA un agente di programmazione che hai già: Claude Code, Codex, [Antigravity CLI](#antigravity), Gemini CLI, [Cursor](#cursor), [Grok Build](#grok-build) o [Pi](#pi). L’agente gira sul tuo computer con il tuo abbonamento, e OpenPencil gli fornisce gli strumenti per lavorare sulla tela.

Gli agenti di programmazione richiedono l’[app desktop](/it/download): il browser non può avviare programmi sul tuo computer.

## Configurare un agente

1. Installa il connettore dell’agente, come indicato nella sua sezione qui sotto. Claude Code e Codex non richiedono altri programmi.
2. Installa il server MCP di OpenPencil, che fornisce all’agente gli strumenti della tela:

   ```sh
   npm install -g @open-pencil/mcp
   ```

3. Apri **Impostazioni → Modelli → Avvia la configurazione guidata** e scegli l’agente in **Agenti di programmazione su questo computer**.
4. Verifica che l’agente e il server MCP risultino installati. **Installa adattatore** installa il connettore per te.
5. Se l’agente non ha effettuato l’accesso, fai clic su **Accedi**. La configurazione guidata mostra l’account usato dall’agente, come il suo piano e la sua email.

**Strumenti di OpenPencil** indica se l’agente riesce a raggiungere gli strumenti della tela. **Controlla di nuovo** ricontrolla dopo che hai installato qualcosa o effettuato l’accesso.

Se usi già l’agente in un terminale, può configurarsi da solo: fai clic su **Copia il prompt di configurazione** nella sua scheda e incolla il prompt nell’agente.

## Scegliere il modello e la modalità

Un agente è un modello come gli altri in **Impostazioni → Modelli**, quindi può essere l’**Agente di design**, svolgere le **Attività rapide**, scrivere le **Revisioni** o, se legge le immagini, essere il modello di **Visione**. Nelle **Attività rapide**, un agente dà un nome alle conversazioni, ma i riepiloghi li scrive comunque l’Agente di design, e Pi non fa nessuna delle due cose. Puoi aggiungere lo stesso agente due volte con impostazioni diverse.

Nelle impostazioni di un agente:

- **Modello**: **Predefinito dell’agente** lascia la scelta all’agente, oppure scegli uno dei modelli che offre. Se l’elenco non si carica, scegli **Modello personalizzato…** e scrivi l’ID di un modello.
- **Livello di ragionamento**: i livelli propri dell’agente per il modello che hai scelto, come Max di Claude Code o Ultra di Codex.
- **Modalità**: cosa può fare l’agente prima di chiederti il permesso, con i nomi propri dell’agente, come Manual, Accept edits, Plan, Auto e Bypass permissions di Claude Code, o da Read-only a Full access di Codex.
- **Input immagini**: disattivalo quando il modello che hai scelto non sa leggere le immagini.

Il menu accanto al pulsante di invio cambia il modello, il livello di ragionamento e la modalità della chat in cui ti trovi, dal messaggio successivo.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Accedi dalla configurazione guidata, oppure esegui `claude` e scrivi `/login`. Se il browser non riesce a restituire l’accesso, la pagina di accesso mostra un codice da incollare nella configurazione guidata.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Accedi con ChatGPT dalla configurazione guidata, oppure esegui `codex login`.

Un connettore più vecchio, `@zed-industries/codex-acp`, installa un programma con lo stesso nome ma non riesce ad accedere. La configurazione guidata ti chiede di rimuoverlo.

## Antigravity CLI {#antigravity}

Antigravity CLI è l’agente di Google per Gemini. Non richiede un connettore. Installalo dal [sito di Antigravity](https://antigravity.google):

```sh
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Su Windows, esegui invece questo in PowerShell:

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Esegui `agy` una volta e scegli come accedere. La configurazione guidata lo mostra come installato, ma non può mostrarne l’account.

Prima di iniziare, a volte l’agente chiede di elencare la propria cartella, `~/.gemini/antigravity-cli/mcp`. Consentilo: se rifiuti, il suo turno termina.

## Gemini CLI

```sh
npm install -g @google/gemini-cli
```

Non richiede un connettore. Esegui `gemini` una volta e scegli come accedere. Gli account Google personali non possono più accedere a Gemini CLI: con questi usa [Antigravity CLI](#antigravity).

## Cursor

La CLI di Cursor non richiede un connettore. Installala seguendo la [guida all’installazione della CLI](https://cursor.com/docs/cli/installation):

```sh
curl https://cursor.com/install -fsS | bash
```

Su Windows, usa il comando PowerShell indicato in quella pagina. Esegui `cursor-agent login` una volta per accedere. I modelli di Cursor includono il livello di ragionamento nel nome.

## Grok Build

Grok Build non richiede un connettore. Installalo seguendo la [guida di Grok Build](https://docs.x.ai/build/overview):

```sh
curl -fsSL https://x.ai/cli/install.sh | bash
```

Su Windows, usa il comando PowerShell indicato in quella pagina. Esegui `grok login` una volta per accedere.

## Pi

Pi funziona tramite il programma di supporto di OpenPencil, che richiede Node.js 22.15 o successivo, oppure Bun. La configurazione guidata lo installa con un clic, oppure installalo tu:

```sh
npm install -g @open-pencil/harness
```

Pi usa i provider a cui hai effettuato l’accesso in Pi, quindi non c’è nessuna chiave da incollare. Esegui `pi`, accedi con `/login` e scegli un modello predefinito con `/model`. Per usare un altro modello in OpenPencil, scrivilo come `provider/model` nelle impostazioni di Pi in OpenPencil. Con una chiave [AI Gateway](https://vercel.com/ai-gateway), Pi usa invece il gateway.

Pi non sa leggere le immagini. Dopo il riavvio di Pi o di OpenPencil, una conversazione prosegue in una nuova sessione di Pi.

## Risoluzione dei problemi

- **Non trovato dopo l’installazione.** Le app avviate dal Dock o dal menu Start non vedono tutte le cartelle che vede il terminale. OpenPencil cerca nelle cartelle abituali di npm, Bun, Volta, mise e Homebrew. Se la tua è altrove, aggiungila al `PATH` della shell di login e riavvia OpenPencil.
- **Aggiornamento necessario.** Il server MCP o il programma di supporto di Pi non corrisponde alla versione dell’app. Fai clic sul pulsante di aggiornamento, o esegui il comando mostrato dalla configurazione guidata, poi **Controlla di nuovo**.
- **L’agente non raggiunge gli strumenti di OpenPencil** o non riesce a modificare la tela. Verifica che il server MCP risulti installato nella configurazione guidata e sia in esecuzione in **Impostazioni → MCP**. Codex ignora il server di OpenPencil quando il suo `config.toml` contiene un server chiamato `open-pencil`: rimuovi quella voce.
- **L’agente ti chiede di accedere.** Fai clic su **Accedi** nella configurazione guidata, o accedi con il comando proprio dell’agente, poi invia di nuovo il messaggio.

L’agente lavora in una cartella tutta sua nei dati dell’app di OpenPencil, così non prende le impostazioni di progetto dalla tua cartella home. Usa comunque le proprie impostazioni, come i server MCP e le regole in `~/.codex` o `~/.claude`.
