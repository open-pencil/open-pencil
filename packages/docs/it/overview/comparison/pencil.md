---
title: OpenPencil e Pencil a confronto
description: Le differenze tra OpenPencil, un editor di design open source, e Pencil (pen.dev), uno strumento di design AI proprietario, nella licenza, nei formati di file, nell’AI, nella collaborazione e nel prezzo.
---

# OpenPencil e Pencil a confronto

[Pencil](https://pen.dev) è uno strumento commerciale di design con AI che conserva i design in file `.pen` e lavora accanto agli agenti di programmazione. OpenPencil è un editor di design open source che apre quei file `.pen` oltre ai file `.fig` di Figma. I due sono progetti separati di team diversi. Questa pagina li confronta alle versioni Pencil desktop 1.2 e OpenPencil 0.17.

## In sintesi

|                          | OpenPencil                                                                                          | Pencil                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Licenza                  | Open source: MIT (editor), Apache 2.0 (server Cloud)                                                | Proprietaria                                                                      |
| Prezzo                   | Gratuito; i piani Cloud aggiungono spazio di archiviazione, editor e crediti AI                     | Piano gratuito con AI limitata; piani Pro e Ultra per utente                      |
| Dove funziona            | App desktop per macOS, Windows e Linux, e browser                                                   | App desktop, estensione per editor di codice e browser                            |
| Formato nativo           | Figma `.fig`                                                                                        | `.pen`                                                                            |
| Apre file `.pen`         | Sì                                                                                                  | Sì                                                                                |
| Apre file `.fig`         | Li apre e li salva                                                                                  | Li importa                                                                        |
| AI integrata             | Assistente in chat con oltre 100 strumenti di design; le chiavi dei tuoi provider o i crediti Cloud | Agenti sul canvas; chiavi proprie, un abbonamento ChatGPT o Claude, oppure piani  |
| Agenti di programmazione | Server MCP, più Claude Code, Codex, Cursor e altri eseguiti dentro l’editor                         | Server MCP per Claude Code, Codex, Cursor e altri                                 |
| Scripting                | CLI headless e scripting compatibile con la Figma Plugin API                                        | CLI                                                                               |
| Export del codice        | Design JSX, HTML, Vue e React con CSS o Tailwind                                                    | HTML con CSS o Tailwind                                                           |
| Collaborazione           | Modifica in tempo reale in stanze peer-to-peer, o su OpenPencil Cloud con commenti e cronologia     | Link di condivisione, condivisioni dal vivo, commenti e versioni                  |
| Self-hosting             | Server di OpenPencil Cloud                                                                          | —                                                                                 |

## Licenza e file

Pencil è concesso in licenza, non venduto: i suoi termini vietano di modificare o ridistribuire l’app. L’editor di OpenPencil ha licenza MIT e il suo server Cloud Apache 2.0, quindi puoi leggerlo, modificarlo e ospitarlo tutto.

OpenPencil salva nel formato `.fig` di Figma, che aprono anche Figma e altri strumenti. Apre i documenti `.pen`, quindi un progetto Pencil può essere importato e salvato come `.fig`; consulta [Esportazione](/user-guide/exporting) per l’apertura dei file.

## AI

Entrambi gli editor sono pensati per lavorare con l’AI. Pencil esegue più agenti contemporaneamente sul canvas, genera immagini e SVG e conteggia l’uso dell’AI nei limiti del piano, a meno che tu non porti la tua chiave o il tuo abbonamento.

L’[assistente AI](/it/user-guide/ai-chat) di OpenPencil funziona con la tua chiave per Anthropic, OpenAI, Google AI, OpenRouter e altri provider, senza limiti di utilizzo da parte nostra, oppure con i crediti inclusi in un piano Cloud. Gli stessi oltre 100 strumenti sono aperti agli agenti di programmazione tramite il [server MCP](/developers/mcp-server), e l’app desktop esegue [agenti di programmazione](/user-guide/coding-agents) come Claude Code e Codex dentro l’editor, ognuno con il proprio cursore sul canvas.

## Collaborazione

OpenPencil consente di modificare insieme in tempo reale: apri una [stanza peer-to-peer](/it/user-guide/collaboration) senza account e senza nulla da ospitare, oppure conserva i documenti su [OpenPencil Cloud](/cloud/), ospitato o sul tuo server, con condivisione, commenti e cronologia delle versioni. Pencil condivide i design tramite link e condivisione dal vivo, con commenti e versioni, sul proprio servizio.

## Dove Pencil è avanti

- **Agenti in parallelo.** Pencil esegue fino a sei agenti su un unico canvas con il piano più alto.
- **Immagini generate.** Pencil genera immagini e SVG e rimuove gli sfondi; OpenPencil vettorializza le immagini tramite Recraft o fal.ai, ma non le genera.
- **Estensione per editor di codice.** Pencil funziona dentro VS Code e Cursor; OpenPencil funziona accanto a loro.

## Quale scegliere

Scegli OpenPencil se vuoi un editor open source che puoi ospitare in proprio, file in un formato che anche Figma apre e AI con le tue chiavi senza limiti di piano. Scegli Pencil se vuoi più agenti che progettano contemporaneamente dentro il tuo editor di codice.
