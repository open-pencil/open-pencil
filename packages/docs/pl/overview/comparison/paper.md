---
title: OpenPencil a Paper
description: Czym różnią się OpenPencil, edytor projektów o otwartym kodzie źródłowym, i Paper, komercyjny obszar roboczy oparty na HTML i CSS, pod względem plików Figma, pracy lokalnej, agentów AI i ceny.
---

# OpenPencil a Paper

[Paper](https://paper.design) to komercyjne narzędzie projektowe, którego obszar roboczy jest zbudowany na HTML i CSS, stworzone do pracy z agentami AI do programowania przez MCP. OpenPencil to edytor projektów o otwartym kodzie źródłowym, który otwiera pliki Figma `.fig`, ma własnego asystenta AI i również daje agentom pełny zestaw narzędzi. Porównanie dotyczy wersji Paper Desktop 0.5 i OpenPencil 0.17.

## W skrócie

|                        | OpenPencil                                                                                        | Paper                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Licencja               | Otwarty kod: MIT (edytor), Apache 2.0 (serwer Cloud)                                              | Zamknięta                                                              |
| Cena                   | Za darmo; plany Cloud dodają miejsce, edytorów i kredyty AI                                       | Darmowy plan ze 100 wywołaniami MCP tygodniowo; Pro za edytora         |
| Platformy              | Aplikacja na macOS, Windows i Linux oraz przeglądarka                                             | Aplikacja na macOS, Windows i Linux oraz przeglądarka                  |
| Gdzie są pliki         | Na Twoim urządzeniu, we własnym zasobniku danych albo w OpenPencil Cloud                          | Usługa Paper                                                           |
| Własny hosting         | Serwer OpenPencil Cloud                                                                           | —                                                                      |
| Figma                  | Otwiera i zapisuje pliki `.fig`; kopiowanie i wklejanie w obie strony                             | Wklejanie z Figmy                                                      |
| Wbudowane AI           | Asystent w czacie z ponad 100 narzędziami projektowymi; własne klucze dostawców lub kredyty Cloud | Generowanie obrazów i SVG; praca nad projektem przez zewnętrznych agentów |
| Agenci programistyczni | Serwer MCP oraz Claude Code, Codex, Cursor i inni działający wewnątrz edytora                     | Lokalne i zdalne serwery MCP                                           |
| Skrypty                | CLI bez interfejsu i skrypty zgodne z Figma Plugin API                                            | CLI dla jego serwera MCP                                               |
| Eksport kodu           | Design JSX, HTML, Vue i React z CSS lub Tailwind                                                  | React z CSS lub Tailwind                                               |
| Eksport                | PNG, JPG, WEBP, SVG i `.fig`; PDF z CLI                                                           | PNG, SVG, PDF i wideo                                                  |
| Współpraca             | Pokoje peer-to-peer albo OpenPencil Cloud z komentarzami i historią wersji                        | Edycja w czasie rzeczywistym z członkami zespołu i agentami oraz komentarze |

## Pliki i hosting

Paper przechowuje projekty we własnej usłudze. OpenPencil zapisuje zwykłe pliki `.fig`, które otwiera też Figma, i pozwala trzymać je na Twoim urządzeniu, we własnym [zasobniku danych](/user-guide/cloud-storage) albo w [OpenPencil Cloud](/cloud/) — hostowanym lub na [serwerze utrzymywanym przez Twój zespół](/cloud/self-hosting/). Otwiera pliki Figma bezpośrednio, podczas gdy Paper przyjmuje warstwy wklejone z Figmy.

## AI i agenci

Oba narzędzia są stworzone dla agentów. Paper podłącza zewnętrznych agentów, takich jak Claude Code lub Cursor, przez swój serwer MCP, a darmowy plan pozwala na 100 wywołań MCP tygodniowo.

OpenPencil ma [asystenta AI](/pl/user-guide/ai-chat) wewnątrz edytora, korzystającego z Twojego klucza dostawcy lub kredytów Cloud, a ponad 100 narzędzi jest dostępnych dla zewnętrznych agentów przez [serwer MCP](/developers/mcp-server) bez limitów wywołań. Aplikacja na komputer może też uruchamiać [agentów programistycznych](/user-guide/coding-agents) wewnątrz edytora, każdego z własnym kursorem na obszarze roboczym. [CLI](/pl/developers/cli/inspecting) i [`eval`](/pl/developers/cli/scripting) działają na dokumentach w ogóle bez otwierania edytora.

## Gdzie Paper ma przewagę

- **Obszar roboczy z HTML i CSS.** Warstwy w Paper to układ webowy, więc to, co projektujesz, jest tym, co renderuje przeglądarka. OpenPencil układa elementy z Flexbox i CSS Grid przez Taffy i eksportuje HTML, ale jego obszar roboczy nie jest stroną internetową.
- **Generowane media.** Paper generuje obrazy i SVG oraz eksportuje wideo.
- **Zdalne MCP.** Hostowany serwer MCP Paper działa, gdy aplikacja jest zamknięta.

## Co wybrać

Wybierz OpenPencil, jeśli chcesz edytora o otwartym kodzie źródłowym, plików `.fig`, które zostają u Ciebie, AI wbudowanego w edytor i dostępnego przez agentów albo braku limitów wywołań agentów. Wybierz Paper, jeśli chcesz obszaru roboczego, który w całości jest HTML i CSS.
