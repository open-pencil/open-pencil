---
pageClass: guide
title: Modelli e provider
description: Con quali provider IA funziona la chat, cosa funziona nel browser e nell’app desktop, e cosa fare quando un provider non è raggiungibile.
---

<script setup>
import ModelProviders from '#docs/theme/components/ModelProviders.vue'
</script>

# Modelli e provider

La [chat IA](./ai-chat) usa un modello che colleghi tu: un [agente di programmazione](./coding-agents) che hai già, una chiave API di un provider, il tuo account [OpenPencil Cloud](/cloud/ai) o un tuo server. Con una chiave API o un tuo server, le richieste vanno direttamente dall’app al provider, e un agente di programmazione usa la propria connessione. L’IA di OpenPencil Cloud passa per il servizio di Cloud, che inoltra ogni richiesta al provider del modello che usa.

Aggiungi un modello da **Impostazioni → Modelli**, oppure lascia che lo faccia la configurazione guidata. In una nuova installazione, accedere a OpenPencil Cloud con un piano che include l’IA lo configura da solo; un modello che hai già configurato resta com’è.

La configurazione guidata assegna inoltre a ogni tipo di lavoro il modello che il provider consiglia per quel lavoro, a meno che ciò che hai già assegnato non funzioni ancora: **Agente di design** gestisce la chat, **Revisione** critica i design a partire dagli screenshot, **Attività rapide** svolge lavori veloci come dare un nome alle chat, e **Visione** legge le immagini. La Visione viene configurata solo quando dici di voler lavorare con le immagini. Un provider il cui modello principale non legge immagini, come DeepSeek o Z.ai, rivede i design, e legge le immagini quando lo chiedi, con uno dei suoi modelli che lo fa, se ne ha uno. Puoi cambiarli tutti in **Assegnazioni** in **Impostazioni → Modelli**.

## Provider

<ModelProviders />

**OpenAI-compatible** va bene per la maggior parte degli altri servizi e dei server locali, con un interruttore tra le API Completions e Responses. **Anthropic-compatible** va bene per i servizi che parlano la Messages API di Anthropic. Inserisci l’URL di base, la chiave e l’ID del modello che il tuo server si aspetta.

Con **OpenRouter** puoi anche accedere invece di incollare una chiave.

**ChatGPT** usa il tuo piano ChatGPT invece di una chiave API, e le sue risposte rientrano nei limiti del piano. È disponibile solo nell’app desktop. L’accesso apre il browser e torna all’app su `localhost:1455`, l’unico indirizzo che OpenAI accetta, quindi prima chiudi un eventuale `codex login` in esecuzione. L’accesso si rinnova da solo, e l’elenco dei modelli arriva dal tuo account.

## Nel browser e nell’app desktop

L’app desktop può raggiungere qualsiasi provider e conserva le chiavi nel portachiavi delle credenziali del sistema. Offre anche ciò che il browser non può offrire: gli agenti di programmazione e l’accesso con ChatGPT.

L’app web invia le richieste dal browser, quindi il provider deve consentirlo (CORS). I provider integrati lo fanno; per un tuo server o un altro servizio, verifica prima di farci affidamento.

Quando l’app web mostra **"Impossibile raggiungere questo endpoint dal browser"**, la richiesta non ha mai ricevuto una risposta che il browser accetterebbe. O il provider non consente le richieste dal browser, oppure le consente ma omette l’autorizzazione nelle risposte di errore, così una chiave o un nome di modello sbagliati sembrano la stessa cosa. Prova le stesse impostazioni nell’app desktop: se lì funzionano, il provider blocca il browser. [Testing a Model Provider](/development/testing-model-providers) spiega come verificare un provider da solo.

## Scegliere un modello

La chat funziona chiamando strumenti, quindi un modello deve supportare la **chiamata di strumenti** (tool calling) e trasmetterla in streaming in modo affidabile; i modelli differiscono su questo anche presso lo stesso provider. Aggiungi la **visione** per permettere alla chat di guardare le immagini e controllare il proprio lavoro.

I modelli di ragionamento possono consumare tutto il loro budget di output pensando. Se un modello si ferma senza fare nulla, aumenta i suoi **Token di output massimi**, o abbassa il suo **Livello di ragionamento**.

Ogni passaggio di una risposta invia di nuovo la conversazione e le descrizioni degli strumenti, quindi le risposte lunghe usano molti token di input. **Passaggi massimi per messaggio**, in **Chat** in **Impostazioni → Modelli**, lo limita per l’IA integrata, mentre gli agenti di programmazione impostano i propri limiti; vedi [Mentre l’IA lavora](./ai-chat#mentre-l-ia-lavora).

## Proteggere le chiavi

Nel browser, le chiavi vengono conservate nell’archivio cifrato del browser, così non devi reinserirle; nelle Impostazioni puoi invece conservarle solo per la sessione. L’app desktop usa il portachiavi delle credenziali del sistema. Una chiave conservata nel browser può comunque essere usata dagli script in esecuzione nella pagina, quindi preferisci chiavi con ambito limitato e limiti di spesa, dove il provider li offre.
