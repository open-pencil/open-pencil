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

[CLI →](./cli/inspecting)

## JSX

Un’interfaccia può essere descritta in modo dichiarativo con JSX. Una chiamata crea un albero completo di frame, testo, disposizioni, riempimenti e contorni.

OpenPencil può anche esportare una selezione come JSX o HTML con classi Tailwind, utile come base per implementazione e revisione del codice.

[Motore JSX →](./jsx-renderer)

## Figma Plugin API

Il comando `eval` esegue JavaScript con un oggetto globale `figma` compatibile. Permette di interrogare e modificare documenti e salvare il risultato.

[Scripting con `eval` →](./cli/scripting)

OpenPencil ha licenza MIT e conserva i documenti localmente. I file `.fig` possono essere esaminati, trasformati, elaborati in CI o forniti come contesto a un modello senza dipendere da uno specifico servizio di hosting.
