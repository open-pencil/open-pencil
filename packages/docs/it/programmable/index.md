---
layout: doc
title: Automazione e API
description: AI, MCP, CLI, JSX e Figma Plugin API per automatizzare i design.
---

# Automazione e API

OpenPencil tratta i file di design come dati strutturati. Le operazioni dell’editor — creare forme, modificare riempimenti, configurare la disposizione automatica o esportare risorse — sono disponibili anche tramite CLI, agenti AI e API.

## Chat con AI

L’assistente integrato esegue oltre 90 strumenti. Un’istruzione può modificare le ombre di più pulsanti, creare un componente con variante scura o esportare tutti i frame di una pagina in scala 2×.

[Chat con AI →](./ai-chat)

## MCP

Claude Code, Cursor, Windsurf e altri client MCP possono usare gli stessi strumenti. Il server supporta stdio e HTTP con sessioni indipendenti.

[Server MCP →](/programmable/mcp-server)

## CLI

La CLI esamina, esporta e analizza file `.fig` senza aprire l’editor. Può elencare pagine e oggetti, cercare contenuti, estrarre variabili di design e generare PNG. `--json` facilita l’integrazione con CI.

La CLI si collega anche all’app desktop in esecuzione tramite RPC, quindi puoi automatizzare l’editor mentre lo usi: aprire, salvare e cambiare documento, annullare, modificare le impostazioni e chiamare qualsiasi strumento MCP ([Controllare l’app](/programmable/cli/app-control)).

[CLI →](./cli/inspecting)

## JSX

Un’interfaccia può essere descritta in modo dichiarativo con JSX. Una chiamata crea un albero completo di frame, testo, disposizioni, riempimenti e contorni.

OpenPencil può anche esportare una selezione come JSX o HTML con classi Tailwind, utile come base per implementazione e revisione del codice.

[Motore JSX →](./jsx-renderer)

## Figma Plugin API

Il comando `eval` esegue JavaScript con un oggetto globale `figma` compatibile. Permette di interrogare e modificare documenti e salvare il risultato.

[Scripting con `eval` →](./cli/scripting)

## Schema URL {#url-scheme}

L’app desktop registra `openpencil://`, quindi una pagina pubblicata (una storia Storybook, una revisione del design, un README) può rimandare direttamente a un livello:

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` è un percorso relativo al repository che termina con `.pen` o `.fig`; percorsi assoluti e segmenti `.` o `..` vengono rifiutati. `node` è facoltativo. L’app cerca `file` tra i percorsi delle schede aperte e, se non ne trova, chiede il file con un selettore.

Con un nome di nodo, l’app seleziona ogni livello con quel nome esatto nella pagina corrente e adatta la vista all’intera selezione. Se la pagina corrente non ne contiene, passa alla prima pagina che ne ha, caricando le pagine se necessario. Un nome sconosciuto mostra un avviso e lascia aperto il documento.

OpenPencil ha licenza MIT e conserva i documenti localmente. I file `.fig` possono essere esaminati, trasformati, elaborati in CI o forniti come contesto a un modello senza dipendere da uno specifico servizio di hosting.
