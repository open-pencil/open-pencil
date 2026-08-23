---
title: Chat con AI
description: Assistente integrato con oltre 90 strumenti per creare, modificare e analizzare design.
---

# Chat con AI

Premi <kbd>⌘</kbd><kbd>J</kbd> o <kbd>Ctrl</kbd><kbd>J</kbd>. L’assistente può creare forme, modificare stili, configurare disposizioni, lavorare con componenti e analizzare il documento.

## Configurare i modelli

1. Apri la chat.
2. Seleziona l’icona delle impostazioni.
3. Aggiungi un profilo e configura connessione, identificatore del modello, credenziali e capacità.

Puoi salvare più profili e assegnarli separatamente a design, revisioni, attività rapide e immagini. I profili che condividono una connessione riutilizzano la stessa credenziale, archiviata in modo sicuro.

## Provider

OpenPencil supporta connessioni compatibili con OpenAI e Anthropic, oltre a OpenRouter, Google, Z.ai e provider locali.

Non usa un server intermedio. Le richieste vengono inviate direttamente al provider; nel browser si applicano le sue regole CORS. L’affidabilità delle chiamate agli strumenti in streaming può variare tra i deployment. Consulta la [compatibilità BYOK](/programmable/byok-provider-compatibility).

## Agenti ACP e MCP remoto

L’app desktop può avviare agenti ACP e collegarli a server remoti attendibili compatibili con [Model Context Protocol](https://modelcontextprotocol.io/). In **Impostazioni → Connessioni MCP**, aggiungi un endpoint HTTP trasmissibile, un nome e, se necessario, un token Bearer.

Il token è conservato nell’archivio sicuro delle credenziali, non nelle normali impostazioni, e viene recuperato solo all’avvio della sessione ACP.

## Strumenti

Gli strumenti coprono lettura, creazione, modifica, struttura, variabili, vettori, analisi, descrizione, generazione di codice e immagini stock. Ogni chiamata agisce sull’editor attivo e partecipa alla cronologia quando applicabile.

## Privacy e costi

Le richieste vanno al provider configurato. Verifica condizioni, politica dei dati e prezzi prima di inviare documenti sensibili. OpenPencil non include crediti per i modelli.
