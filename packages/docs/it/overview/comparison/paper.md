---
title: OpenPencil e Paper a confronto
description: Le differenze tra OpenPencil, un editor di design open source, e Paper, un canvas di design commerciale costruito su HTML e CSS, nei file Figma, nell’uso locale, negli agenti AI e nel prezzo.
---

# OpenPencil e Paper a confronto

[Paper](https://paper.design) è uno strumento di design commerciale il cui canvas è costruito su HTML e CSS, pensato per lavorare con agenti di programmazione AI tramite MCP. OpenPencil è un editor di design open source che apre i file `.fig` di Figma, ha un proprio assistente AI e offre anche agli agenti un set completo di strumenti. Questa pagina li confronta alle versioni Paper Desktop 0.5 e OpenPencil 0.17.

## In sintesi

|                          | OpenPencil                                                                                          | Paper                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Licenza                  | Open source: MIT (editor), Apache 2.0 (server Cloud)                                                | Proprietaria                                                                 |
| Prezzo                   | Gratuito; i piani Cloud aggiungono spazio di archiviazione, editor e crediti AI                     | Piano gratuito con 100 chiamate MCP a settimana; Pro per editor              |
| Piattaforme              | App desktop per macOS, Windows e Linux, e browser                                                   | App desktop per macOS, Windows e Linux, e browser                            |
| Dove risiedono i file    | Sul tuo dispositivo, nel tuo bucket di archiviazione o su OpenPencil Cloud                          | Il servizio di Paper                                                         |
| Self-hosting             | Server di OpenPencil Cloud                                                                          | —                                                                            |
| Figma                    | Apre e salva file `.fig`; copia e incolla in entrambe le direzioni                                  | Incolla da Figma                                                             |
| AI integrata             | Assistente in chat con oltre 100 strumenti di design; le chiavi dei tuoi provider o i crediti Cloud | Generazione di immagini e SVG; lavoro di design tramite agenti esterni       |
| Agenti di programmazione | Server MCP, più Claude Code, Codex, Cursor e altri eseguiti dentro l’editor                         | Server MCP locali e remoti                                                   |
| Scripting                | CLI headless e scripting compatibile con la Figma Plugin API                                        | CLI per il suo server MCP                                                    |
| Export del codice        | Design JSX, HTML, Vue e React con CSS o Tailwind                                                    | React con CSS o Tailwind                                                     |
| Export                   | PNG, JPG, WEBP, SVG e `.fig`; PDF dalla CLI                                                         | PNG, SVG, PDF e video                                                        |
| Collaborazione           | Stanze peer-to-peer, oppure OpenPencil Cloud con commenti e cronologia delle versioni               | Modifica in tempo reale con colleghi e agenti, e commenti                    |

## File e hosting

Paper conserva i design sul proprio servizio. OpenPencil salva normali file `.fig` che anche Figma apre, e ti permette di tenerli sul tuo dispositivo, nel tuo [bucket di archiviazione](/user-guide/cloud-storage) o su [OpenPencil Cloud](/cloud/), ospitato oppure su un [server gestito dal tuo team](/cloud/self-hosting/). Apre direttamente i file Figma, mentre Paper accetta livelli incollati da Figma.

## AI e agenti

Entrambi sono pensati per gli agenti. Paper collega agenti esterni come Claude Code o Cursor tramite il suo server MCP, e il piano gratuito consente 100 chiamate MCP a settimana.

OpenPencil ha un [assistente AI](/it/user-guide/ai-chat) dentro l’editor, che usa la chiave del tuo provider o i crediti Cloud, e oltre 100 strumenti sono aperti agli agenti esterni tramite il [server MCP](/developers/mcp-server) senza limiti di chiamate. L’app desktop può anche eseguire [agenti di programmazione](/user-guide/coding-agents) dentro l’editor, ognuno con il proprio cursore sul canvas. La [CLI](/it/developers/cli/inspecting) ed [`eval`](/it/developers/cli/scripting) lavorano sui documenti senza aprire affatto l’editor.

## Dove Paper è avanti

- **Canvas HTML e CSS.** I livelli di Paper sono layout web, quindi ciò che progetti è ciò che il browser renderizza. OpenPencil impagina con Flexbox e CSS Grid tramite Taffy ed esporta HTML, ma il suo canvas non è una pagina web.
- **Media generati.** Paper genera immagini e SVG ed esporta video.
- **MCP remoto.** Il server MCP ospitato di Paper funziona anche ad app chiusa.

## Quale scegliere

Scegli OpenPencil se vuoi un editor open source, file `.fig` che conservi tu, AI integrata oltre che tramite agenti, o nessun limite sulle chiamate degli agenti. Scegli Paper se vuoi un canvas che sia HTML e CSS dall’inizio alla fine.
