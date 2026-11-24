---
title: OpenPencil e Penpot a confronto
description: Le differenze tra OpenPencil e Penpot, due strumenti di design open source, nel supporto ai file Figma, nell’AI e nell’automazione, nella collaborazione, nel self-hosting e nell’app desktop.
---

# OpenPencil e Penpot a confronto

OpenPencil e Penpot sono entrambi strumenti di design open source che puoi usare al posto di Figma. Partono però da presupposti diversi: Penpot è una piattaforma web costruita attorno al proprio formato di file e a un server per i team, mentre OpenPencil è un editor che apre i file Figma che hai già, funziona sul tuo dispositivo e può essere guidato da te, da script o da agenti AI. Questa pagina li confronta alle versioni Penpot 2.19 e OpenPencil 0.17.

## In sintesi

|                   | OpenPencil                                                                                             | Penpot                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Licenza           | MIT (editor), Apache 2.0 (server Cloud)                                                                | MPL 2.0                                                   |
| File Figma `.fig` | Li apre e li salva; copia e incolla con Figma in entrambe le direzioni                                 | Convertiti da un plugin che gira in Figma                 |
| Dove funziona     | App desktop per macOS, Windows e Linux, e browser                                                      | Browser                                                   |
| Uso offline       | Sì; i documenti possono restare sul tuo dispositivo                                                    | Richiede il proprio server                                |
| Account           | Non serve per modificare; facoltativo per Cloud                                                        | Obbligatorio                                              |
| Collaborazione    | Stanze peer-to-peer senza account, oppure OpenPencil Cloud con condivisione, commenti e cronologia     | Basata su server, con condivisione, commenti e cronologia |
| Self-hosting      | Server di OpenPencil Cloud                                                                             | Distribuzione con Docker                                  |
| AI integrata      | Assistente in chat con oltre 100 strumenti di design; usa la chiave del tuo provider o i crediti Cloud | —                                                         |
| Agenti e script   | Server MCP, CLI headless e scripting compatibile con la Figma Plugin API                               | Server MCP e Plugin API                                   |
| Layout            | Disposizione automatica con Flexbox e CSS Grid                                                         | Layout flex e grid                                        |
| Token di design   | Variabili con modalità; import ed export dei token di design W3C                                       | Token di design nativi                                    |
| Export del codice | Design JSX, HTML, Vue e React con CSS o Tailwind                                                       | Ispezione di CSS, SVG e HTML                              |
| Prototipazione    | Comportamenti dei componenti dal vivo; flussi e transizioni sono nella [roadmap](/development/roadmap) | Flussi, interazioni e modalità di visualizzazione         |

## File Figma

OpenPencil apre direttamente i file `.fig` e salva di nuovo in `.fig`, così un team può passare senza convertire prima la propria libreria e chi usa ancora Figma può aprire il risultato. I file complessi possono apparire diversi quando vengono riaperti in Figma, quindi conserva l’originale finché non hai controllato il risultato. Copiando livelli in Figma e incollandoli in OpenPencil si conservano riempimenti, contorni, disposizione automatica, testo, effetti e reti vettoriali, e la copia funziona anche nella direzione opposta. Consulta [Compatibilità con Figma](/it/reference/figma-compatibility) per sapere cosa viene trasferito e cosa no.

Penpot usa il proprio formato `.penpot` e non apre i file `.fig`. Passare da Figma significa eseguire il plugin di esportazione di Penpot dentro Figma e importare ciò che produce.

## AI e automazione

OpenPencil è pensato per essere programmato. L’[assistente AI](/it/user-guide/ai-chat) crea e modifica livelli con oltre 100 strumenti; il [server MCP](/developers/mcp-server) mette un insieme simile a disposizione di Claude Code, Cursor, Codex e altri agenti di programmazione, e l’app desktop può eseguire questi agenti all’interno dell’editor. La [CLI](/it/developers/cli/inspecting) ispeziona, verifica, converte ed esporta documenti senza aprire l’editor, e il suo [comando `eval`](/it/developers/cli/scripting) esegue script scritti per la Figma Plugin API.

Penpot ha un server MCP ufficiale che permette agli agenti di programmazione di lavorare sui suoi file, e un sistema di plugin per estensioni che girano nell’editor. Non ha un assistente integrato né scripting headless.

## Collaborazione e hosting

Penpot è composto da client e server: i documenti risiedono su un’istanza Penpot, quella ospitata oppure una che distribuisci con Docker, e tutti vi accedono con un account.

OpenPencil non richiede server né account: i documenti possono restare sul tuo dispositivo. Per lavorare insieme puoi aprire una [stanza peer-to-peer](/it/user-guide/collaboration) senza account e senza nulla da ospitare, con cursori in tempo reale, modalità segui e chiamate vocali. Per archiviazione condivisa, permessi, commenti e cronologia delle versioni usa [OpenPencil Cloud](/cloud/): il servizio ospitato oppure un [server gestito dal tuo team](/cloud/self-hosting/) a partire dallo stesso codice open source.

## App desktop

OpenPencil ha un’app desktop nativa per macOS, Windows e Linux, con menu nativi, modifica offline e salvataggio automatico. Funziona anche nel browser su [cloud.openpencil.dev](https://cloud.openpencil.dev). Penpot funziona nel browser.

## Dove Penpot è avanti

- **Maturità.** Penpot è usato in produzione da anni da team di grandi dimensioni; OpenPencil è più giovane e ha ancora qualche spigolo.
- **Prototipazione.** Penpot offre flussi, interazioni e una modalità presentazione. OpenPencil mostra in anteprima i componenti come controlli funzionanti, ma non ha ancora flussi di prototipo.
- **Ecosistema di plugin.** Penpot ha un catalogo di plugin della community; oggi i punti di estensione di OpenPencil sono gli script, MCP e il [Vue SDK](/it/developers/sdk/).

## Quale scegliere

Scegli OpenPencil se hai file Figma con cui continuare a lavorare, se vuoi un’app desktop che funzioni offline o se vuoi che agenti AI e script lavorino sui tuoi design. Scegli Penpot se ti serve la prototipazione oggi o una piattaforma con una storia più lunga alle spalle.
