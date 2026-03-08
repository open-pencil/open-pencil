---
layout: doc
title: IA e Automazione
description: Ogni operazione in OpenPencil è scriptabile — chat IA, CLI, renderer JSX, server MCP, collaborazione in tempo reale.
---

# IA e Automazione

OpenPencil tratta i file di design come dati. Ogni operazione disponibile nell'editor — creare forme, impostare riempimenti, gestire l'auto-layout, esportare risorse — è disponibile anche dal terminale, dagli agenti IA e dal codice. Nessun plugin da installare, nessuna chiave API, nessuna lista d'attesa.

L'interfaccia dell'editor e le interfacce di automazione utilizzano lo stesso motore. Se puoi farlo cliccando, puoi farlo con uno script.

## Chat IA

L'assistente integrato ha accesso a 87 strumenti che coprono l'intera superficie dell'editor. Descrivi ciò che vuoi in linguaggio naturale — "aggiungi un'ombra esterna di 16px a tutti i pulsanti", "crea un componente card con variante dark mode", "esporta ogni frame di questa pagina a 2×".

[Chat IA →](./ai-chat)

## Collaborazione

Editing multiplayer in tempo reale tramite WebRTC peer-to-peer. Nessun server, nessun account. Condividi un link della stanza e modifica insieme con cursori live e modalità di follow. Lo stato del documento si sincronizza tramite CRDT, quindi le modifiche si uniscono automaticamente anche con connessioni instabili.

[Collaborazione →](./collaboration)

## Renderer JSX

Descrivi l'interfaccia come JSX — la stessa sintassi che gli LLM già conoscono da React. Una singola chiamata può creare un intero albero di componenti con frame, testo, auto-layout, riempimenti e bordi. Compatto, dichiarativo e confrontabile con diff.

Nella direzione opposta, esporta qualsiasi selezione in JSX con classi Tailwind — utile per il passaggio allo sviluppo o per fornire i design a un LLM.

[Renderer JSX →](./jsx-renderer)

## CLI

Ispeziona, esporta e analizza file `.fig` senza aprire l'editor. Elenca le pagine, cerca i nodi, estrai i token di design, renderizza in PNG — tutto dal terminale con output JSON leggibile dalle macchine.

La CLI si connette anche all'app desktop in esecuzione tramite RPC, così puoi scriptare l'editor mentre lo stai usando.

[Ispezione dei File](./cli/inspecting) · [Esportazione](./cli/exporting) · [Analisi dei Design](./cli/analyzing) · [Scripting](./cli/scripting)

## Server MCP

Connetti Claude Code, Cursor, Windsurf o qualsiasi client compatibile con MCP a OpenPencil. Il server espone 90 strumenti per leggere, creare e modificare design — gli stessi strumenti che usa la chat IA integrata. Funziona tramite stdio o HTTP con supporto alle sessioni.

[Server MCP →](./mcp-server)

## Perché Open?

Figma è una piattaforma chiusa. Il loro server MCP è in sola lettura. L'accesso CDP via browser è stato eliminato nella versione 126. I file di design risiedono in un formato proprietario sui server di qualcun altro. Lo sviluppo di plugin richiede un runtime personalizzato con API limitate.

OpenPencil è l'alternativa: open source, licenza MIT, ogni operazione scriptabile, dati archiviati localmente. I tuoi file di design sono tuoi — ispezionali, trasformali, inviali alla CI, dalli in pasto a un LLM. Nessun permesso necessario.
