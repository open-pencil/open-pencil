---
pageClass: guide
title: Chat IA
description: Chiedi all’IA di creare e modificare design, annulla ciò che ha fatto, ricevi revisioni e insegnale con le skill.
---

# Chat IA

Descrivi ciò che vuoi, e l’IA lo crea sulla tela: una schermata, un componente, una modifica a ogni pulsante della pagina. Premi <Keys mac="⌘ J" other="Ctrl J" /> per aprire la chat, o fai clic sulla scheda **AI** accanto a **Design**.

## Configurare l’IA

La prima volta, la configurazione guidata ti chiede in cosa vorresti che l’IA ti aiutasse e cosa usi già:

- un [agente di programmazione](./coding-agents) che hai, come Claude Code o Codex, nell’app desktop;
- un account presso un provider IA, come OpenRouter, Anthropic, OpenAI o Google, o il tuo piano ChatGPT;
- un modello in esecuzione sul tuo computer o sul server della tua azienda;
- il tuo account [OpenPencil Cloud](/cloud/ai).

[Modelli e provider](./models-and-providers) elenca cosa serve per ciascuno. Per ripetere la configurazione, apri **Impostazioni → Modelli → Avvia la configurazione guidata**.

L’IA usa un modello per ogni tipo di lavoro, che puoi cambiare nel menu dei modelli sotto il campo del messaggio, in **Gestisci modelli e ruoli…**:

| Ruolo | Cosa fa |
| ----- | ------- |
| **Agente di design** | La chat stessa. |
| **Visione** | Legge le immagini che alleghi. |
| **Revisione** | Scrive le [revisioni del design](#chiedere-una-revisione). Usa l’Agente di design, a meno che tu non ne scelga un altro. |
| **Attività rapide** | Dà un nome alle conversazioni e, quando è un modello via API, scrive i riepiloghi di quelle lunghe; altrimenti li scrive l’Agente di design. Pi non dà nomi alle conversazioni. Senza un modello che lo faccia, una conversazione prende come nome il suo primo messaggio. |

## Chiedere un design

Scrivi ciò che vuoi e premi <Keys mac="Enter" other="Enter" />. L’IA vede quali livelli sono selezionati, quindi seleziona ciò a cui ti riferisci prima di chiedere di modificarlo.

<GuideImage name="ai-chat/reply" alt="La chat IA accanto alla tela: una richiesta per una scheda di viaggio, la modifica fatta dall’IA, la sua risposta e la nuova scheda sulla tela" />

- Scrivi **@** per citare un livello, una pagina o una skill. I livelli citati compaiono come etichette; fai clic su una per trovare il livello sulla tela. Il pulsante del puntatore cita i livelli selezionati.
- Allega immagini, come uno schizzo o un sito che ti piace, con il pulsante delle immagini. Serve un modello di Visione.
- Ogni modifica fatta dall’IA compare nella sua risposta. Fai clic su una per vedere cosa ha fatto.

Alcune cose da provare:

- "Crea una scheda con un titolo, una descrizione e un pulsante blu."
- "Fai in modo che tutti i pulsanti di questa pagina usino lo stesso raggio degli angoli."
- "Trasforma lo sfondo di questa cornice in una sfumatura dal blu al viola."
- "Trasforma questo componente in un interruttore che posso provare in anteprima."

Con un modello che legge le immagini, l’IA controlla il proprio lavoro guardando un’immagine di ciò che ha creato, così può correggere ciò che ha sbagliato.

## Mentre l’IA lavora

- Continua a lavorare: l’IA resta sulla pagina in cui è iniziato il messaggio. La chat indica dove sta lavorando, con **Vai alla pagina** per tornarci.
- Per osservarla, attiva **Segui gli agenti mentre lavorano**, il pulsante a forma di bersaglio in cima alla chat. La tua vista segue l’IA, anche su un’altra pagina. Un clic, uno scorrimento o <Keys mac="Esc" other="Esc" /> smettono di seguirla.
- Scrivi un altro messaggio e premi <Keys mac="Enter" other="Enter" /> per inviarlo appena il passaggio in corso è terminato, così l’IA può cambiare direzione. <Keys mac="⌥ Enter" other="Alt Enter" /> aspetta che abbia finito tutto. I messaggi in attesa compaiono attenuati sotto la risposta.
- **Interrompi generazione** termina la risposta. Una modifica già in corso viene completata; il messaggio successivo dice all’IA cosa è cambiato.

**Passaggi massimi per messaggio**, in **Chat** in **Impostazioni → Modelli**, limita quanto a lungo può lavorare una singola risposta dell’IA integrata: 50 passaggi, se non lo cambi. Gli agenti di programmazione impostano i propri limiti. Quando una risposta raggiunge il limite, **Continua** va avanti.

## Annullare ciò che ha fatto l’IA

Ogni modifica fatta dall’IA è un passaggio di <Keys mac="⌘ Z" other="Ctrl Z" />, e la chat segnala le modifiche annullate.

- **Annulla le modifiche** sotto una risposta annulla tutte le sue modifiche, e **Ripristina modifiche** le riporta.
- **Annulla e rigenera** le annulla e chiede di nuovo.

Il tuo messaggio successivo dice all’IA cosa hai annullato, così non costruisce su modifiche che non ci sono più.

## Chiedere una revisione

Scrivi **/review** perché il modello di Revisione esamini la selezione, o la pagina quando non è selezionato nulla, come farebbe un art director: allineamento, spaziatura, contrasto, gerarchia e qualsiasi cosa sembri non funzionare.

- Aggiungi cosa guardare, come `/review typography`.
- Allega immagini con cui confrontare, come uno screenshot di un sito che ammiri. Serve un modello che legga le immagini.
- Sotto una modifica fatta dall’IA, **Rivedi questa modifica** chiede se ha migliorato il design.

La revisione compare come una scheda, e ogni osservazione rimanda al suo livello. **Correggi** invia le osservazioni all’IA come tuo messaggio.

## Insegnare all’IA con le skill

Una skill è un insieme di istruzioni per un tipo di lavoro, come le regole del marchio del tuo team, nel formato [Agent Skills](https://agentskills.io/specification): una cartella con un `SKILL.md` e gli eventuali file a cui fa riferimento. L’IA legge una skill quando una richiesta ne ha bisogno. Per usarne una tu stesso, scrivi **/** e sceglila.

Aggiungi le skill in **Impostazioni → Skill**:

- **Carica competenza** carica uno ZIP della cartella di una skill, o un singolo `SKILL.md`.
- Nell’app desktop vengono trovate anche le skill nelle cartelle `.agents/skills` e `.claude/skills` accanto al file aperto. Restano disattivate finché non scegli **Fidati della cartella**, perché una skill dà istruzioni all’IA.
- Le skill installate da altri agenti di programmazione, in `~/.agents/skills` e `~/.claude/skills`, sono elencate come disattivate. Attiva quelle che aiutano nel design.

Gli agenti di programmazione come Claude Code caricano le proprie skill.

## Conversazioni lunghe

L’IA legge solo una certa quantità di una conversazione alla volta. L’indicatore in cima alla chat mostra quanto è pieno questo spazio; fai clic per i dettagli.

Quando la conversazione è quasi piena, l’IA la compatta: scrive un riepilogo che sostituisce i messaggi più vecchi, che puoi comunque ancora leggere. **Compatta automaticamente**, in **Chat** in **Impostazioni → Modelli**, lo fa quando serve. Scrivi **/compact** per farlo subito, indicando cosa conservare, come `/compact keep the color decisions`.

**Cronologia chat**, in alto a sinistra nella chat, apre le conversazioni precedenti, salvate su questo computer. **Nuova chat** ricomincia da capo.

## Scegliere cosa può fare l’IA

**Impostazioni → Accesso agli strumenti** elenca gli strumenti che l’IA può usare, come modificare livelli, esportare o eseguire script. Disattiva singoli strumenti o interi gruppi per impedire all’IA di usarli. La modifica vale dal messaggio successivo. Uno strumento di script può comunque fare ciò che fanno gli strumenti disattivati, quindi questi interruttori non sono una sandbox.

La scheda **Local MCP** imposta gli strumenti per gli [agenti di programmazione e gli altri client MCP](/developers/mcp-server).

## Cambiare le istruzioni dell’IA

::: v-pre

**Impostazioni → Prompt** contiene ciò che OpenPencil dice all’IA:

- **Agente di design**: le tue istruzioni per la chat, aggiunte dopo quelle di OpenPencil. **Sostituisci quelle di OpenPencil** usa le tue al loro posto; senza quelle di OpenPencil, l’IA potrebbe usare male i suoi strumenti.
- **Revisione**, **Titoli delle chat** e **Riepiloghi di compattazione**: i prompt per queste attività. Sono modelli [Knap](https://knap.md), in cui `{{ focus }}` inserisce un valore. L’editor segnala gli errori e mostra un’anteprima del risultato.

:::

**Ripristina predefiniti** riporta quelle di OpenPencil.

## Collegare altri strumenti {#external-mcp-connections}

Nell’app desktop, gli agenti di programmazione possono usare anche altri server [MCP](https://modelcontextprotocol.io/), come il tuo sistema di gestione delle issue. In **Impostazioni → MCP**, in **Connessioni MCP**, aggiungi l’indirizzo del server e, se ne richiede uno, il suo token, e attiva la connessione: gli agenti non ricevono le connessioni disattivate. Aggiungi solo server di cui ti fidi: i loro strumenti agiscono con l’accesso che concedi loro.

## Ricevere notifiche

Quando l’IA chiede un’autorizzazione e non rispondi entro pochi secondi, OpenPencil invia una notifica, così nel frattempo puoi lavorare in un’altra app. **Impostazioni → Notifiche** può avvisarti anche quando una risposta è terminata. Nel browser, fai prima clic su **Consenti notifiche** lì.
