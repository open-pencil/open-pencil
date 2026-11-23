---
title: OpenPencil e Lunacy a confronto
description: Le differenze tra OpenPencil e Lunacy, due editor di design desktop gratuiti che aprono i file Figma, nella licenza, nel salvataggio verso Figma, nell’AI e nell’automazione e nel self-hosting.
---

# OpenPencil e Lunacy a confronto

[Lunacy](https://icons8.com/lunacy) di Icons8 e OpenPencil sono entrambi editor di design gratuiti con app desktop native per macOS, Windows e Linux, ed entrambi aprono i file `.fig` di Figma. Si differenziano per chi controlla il software e per dove finisce il tuo lavoro dopo. Questa pagina li confronta alle versioni Lunacy 14 e OpenPencil 0.17.

## In sintesi

|                          | OpenPencil                                                                                             | Lunacy                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Licenza                  | Open source: MIT (editor), Apache 2.0 (server Cloud)                                                   | Freeware proprietario                                                                  |
| Prezzo                   | Gratuito; i piani Cloud aggiungono spazio di archiviazione, editor e crediti AI                        | Gratuito; piani a pagamento per funzioni cloud e team e grafica senza attribuzione     |
| Piattaforme              | App desktop per macOS, Windows e Linux, e browser                                                      | App desktop per macOS, Windows e Linux, e browser                                      |
| Formato nativo           | Figma `.fig`                                                                                           | `.free` e Sketch `.sketch`                                                             |
| File `.fig`              | Li apre e li salva; copia e incolla con Figma in entrambe le direzioni                                 | Li apre                                                                                |
| Uso offline              | Sì                                                                                                     | Sì, con documenti locali                                                               |
| Collaborazione           | Stanze peer-to-peer, oppure OpenPencil Cloud con commenti e cronologia delle versioni                  | Il cloud di Lunacy o un cloud privato, con commenti                                    |
| Self-hosting             | Server di OpenPencil Cloud                                                                             | Cloud privato sui tuoi server, con licenza a pagamento                                 |
| AI integrata             | Assistente in chat con oltre 100 strumenti di design; le chiavi dei tuoi provider o i crediti Cloud    | Chat AI sul servizio di Icons8, più strumenti per le immagini                          |
| Agenti di programmazione | Server MCP, più Claude Code, Codex, Cursor e altri eseguiti dentro l’editor                            | Server MCP                                                                             |
| Scripting                | CLI headless e scripting compatibile con la Figma Plugin API                                           | Plugin tramite la sua API MCP                                                          |
| Export del codice        | Design JSX, HTML, Vue e React con CSS o Tailwind                                                       | Ispezione CSS                                                                          |
| Prototipazione           | Comportamenti dei componenti dal vivo; flussi e transizioni sono nella [roadmap](/development/roadmap) | Flussi, smart animate e animazioni a molla                                             |
| Risorse integrate        | Set di icone                                                                                           | Icone, foto, illustrazioni e UI kit di Icons8                                          |

## Lavorare con i file Figma

Lunacy apre i file `.fig` e salva nel proprio formato `.free` o in file Sketch, quindi un design che passa da Figma a Lunacy non torna indietro come `.fig`. OpenPencil salva direttamente in `.fig`: puoi aprire un file di un collega che usa Figma, modificarlo e rimandarglielo, e copiare e incollare livelli tra le due app in entrambe le direzioni. I file complessi possono apparire diversi quando vengono riaperti in Figma, quindi conserva l’originale finché non hai controllato il risultato; consulta [Compatibilità con Figma](/it/reference/figma-compatibility).

## Open source e hosting

Lunacy è gratuito ma closed source, e far girare il suo cloud privato sui tuoi server richiede una licenza a pagamento. Il codice di OpenPencil è aperto, e i documenti possono restare sul tuo dispositivo, nel tuo [bucket di archiviazione](/user-guide/cloud-storage) o su [OpenPencil Cloud](/cloud/), compreso un [server gestito dal tuo team](/cloud/self-hosting/).

## AI e automazione

La chat AI di Lunacy gira sul servizio di Icons8 senza bisogno di una chiave API. L’[assistente AI](/it/user-guide/ai-chat) di OpenPencil usa la chiave del tuo provider o i crediti Cloud, e gli stessi oltre 100 strumenti sono aperti agli agenti di programmazione tramite il [server MCP](/developers/mcp-server). La [CLI](/it/developers/cli/inspecting) ispeziona, verifica ed esporta documenti senza aprire l’editor, e [`eval`](/it/developers/cli/scripting) esegue script scritti per la Figma Plugin API.

## Dove Lunacy è avanti

- **Prototipazione.** Lunacy ha flussi, smart animate e animazioni a molla; OpenPencil non ha ancora flussi di prototipo.
- **Grafica integrata.** Lunacy include icone, foto, illustrazioni e UI kit di Icons8.
- **Maturità.** Lunacy è sviluppato da anni ed è arrivato alla versione 14.

## Quale scegliere

Scegli OpenPencil se devi continuare a scambiare file `.fig` con chi usa Figma, se vuoi software e hosting sotto il tuo controllo o se vuoi che agenti di programmazione e script lavorino sui tuoi design. Scegli Lunacy se vuoi la prototipazione e un’ampia libreria grafica integrata in un’app gratuita.
