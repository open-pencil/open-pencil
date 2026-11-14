---
layout: doc
title: Sviluppatori
description: Automatizza i file di design dal terminale, lascia che un agente AI guidi l’editor o crea il tuo editor sul motore di OpenPencil.
---

# Sviluppatori

Tutto ciò che fa l’editor è disponibile anche al di fuori: dal terminale, per gli agenti AI e dal codice. Tutto gira sullo stesso motore dell’app, quindi ciò che puoi fare con un clic puoi farlo anche con uno script. Scegli lo strumento in base a ciò che vuoi costruire.

## Automatizzare i file di design

La CLI `openpencil` legge, controlla, esporta e modifica file `.fig` e `.pen` senza aprire l’app, e produce JSON per script e CI. Mentre l’app desktop è in esecuzione, la stessa CLI la controlla: aprire e salvare documenti, annullare, modificare le impostazioni e chiamare qualsiasi strumento dell’editor.

<SdkCardGroup>
  <SdkCard title="Riferimento comandi" to="/reference/cli" description="Tutti i comandi e le relative opzioni." />
  <SdkCard title="Esaminare file" to="/it/developers/cli/inspecting" description="Pagine, nodi, query XPath e variabili di design." />
  <SdkCard title="Esportare" to="/it/developers/cli/exporting" description="Immagini, JSX, HTML, variabili di design e storie Storybook." />
  <SdkCard title="Scripting" to="/it/developers/cli/scripting" description="La Figma Plugin API e un’API openpencil tramite eval." />
</SdkCardGroup>

## Lascia progettare un agente AI

Il server MCP offre a Claude Code, Cursor, Windsurf o qualsiasi client MCP i 90 strumenti usati dall’assistente integrato, così un agente può leggere, creare e modificare i design. Gli agenti descrivono l’interfaccia in JSX, che crea frame, testo e disposizioni automatiche reali.

<SdkCardGroup>
  <SdkCard title="Server MCP" to="/developers/mcp-server" description="Collega un client tramite stdio o HTTP." />
  <SdkCard title="Motore JSX" to="/it/developers/jsx-renderer" description="Crea alberi di componenti da JSX ed esporta una selezione di nuovo in JSX." />
  <SdkCard title="Riferimento del JSX di design" to="/reference/design-authoring" description="Cosa accetta il JSX di design." />
</SdkCardGroup>

Per usare invece un agente all’interno dell’app, vedi [Chat con AI](../user-guide/ai-chat) e [Agenti di programmazione](/user-guide/coding-agents).

## Crea il tuo editor

`@open-pencil/vue` è il Vue SDK con cui è costruita l’app: contesto dell’editor, canvas, selezione, comandi e pannelli senza stile da personalizzare. Le librerie del motore funzionano anche senza Vue, nel browser o su un server.

<SdkCardGroup>
  <SdkCard title="Vue SDK" to="/it/developers/sdk/" description="Integra l’editor o creane uno specializzato." />
  <SdkCard title="API JavaScript native" to="/developers/native-api" description="Le librerie del motore, senza interfaccia." />
  <SdkCard title="Schema URL" to="/it/developers/url-scheme" description="Collega una pagina direttamente a un livello nell’app." />
</SdkCardGroup>

## Uno sguardo all’interno

<SdkCardGroup>
  <SdkCard title="Riferimento" to="/reference/node-types" description="Tipi di nodo, grafo della scena, corrispondenza DOM/CSS e formato del file." />
  <SdkCard title="Contribuire" to="/development/contributing" description="Compila l’app, esegui i test e invia una modifica." />
</SdkCardGroup>
