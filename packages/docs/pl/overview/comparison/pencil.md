---
title: OpenPencil a Pencil
description: Czym różnią się OpenPencil, edytor projektów o otwartym kodzie źródłowym, i Pencil (pen.dev), zamknięte narzędzie projektowe z AI, pod względem licencji, formatów plików, AI, współpracy i ceny.
---

# OpenPencil a Pencil

[Pencil](https://pen.dev) to komercyjne narzędzie projektowe z AI, które przechowuje projekty w plikach `.pen` i współpracuje z agentami programistycznymi. OpenPencil to edytor projektów o otwartym kodzie źródłowym, który otwiera te pliki `.pen`, a także pliki Figma `.fig`. To dwa odrębne projekty różnych zespołów. Porównanie dotyczy wersji Pencil desktop 1.2 i OpenPencil 0.17.

## W skrócie

|                        | OpenPencil                                                                                         | Pencil                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Licencja               | Otwarty kod: MIT (edytor), Apache 2.0 (serwer Cloud)                                               | Zamknięta                                                                         |
| Cena                   | Za darmo; plany Cloud dodają miejsce, edytorów i kredyty AI                                        | Darmowy plan z ograniczonym AI; plany Pro i Ultra za użytkownika                  |
| Gdzie działa           | Aplikacja na macOS, Windows i Linux oraz przeglądarka                                              | Aplikacja na komputer, rozszerzenie edytora kodu i przeglądarka                   |
| Natywny format         | Figma `.fig`                                                                                       | `.pen`                                                                            |
| Otwiera pliki `.pen`   | Tak                                                                                                | Tak                                                                               |
| Otwiera pliki `.fig`   | Otwiera je i zapisuje                                                                              | Importuje je                                                                      |
| Wbudowane AI           | Asystent w czacie z ponad 100 narzędziami projektowymi; własne klucze dostawców lub kredyty Cloud  | Agenci na obszarze roboczym; własne klucze, subskrypcja ChatGPT lub Claude albo plany |
| Agenci programistyczni | Serwer MCP oraz Claude Code, Codex, Cursor i inni działający wewnątrz edytora                      | Serwer MCP dla Claude Code, Codex, Cursor i innych                                |
| Skrypty                | CLI bez interfejsu i skrypty zgodne z Figma Plugin API                                             | CLI                                                                               |
| Eksport kodu           | Design JSX, HTML, Vue i React z CSS lub Tailwind                                                   | HTML z CSS lub Tailwind                                                           |
| Współpraca             | Edycja w czasie rzeczywistym w pokojach peer-to-peer lub w OpenPencil Cloud z komentarzami i historią  | Linki udostępniania, udostępnianie na żywo, komentarze i wersje               |
| Własny hosting         | Serwer OpenPencil Cloud                                                                            | —                                                                                 |

## Licencja i pliki

Pencil jest licencjonowany, a nie sprzedawany: jego warunki zabraniają modyfikowania i redystrybucji aplikacji. Edytor OpenPencil jest na licencji MIT, a serwer Cloud na Apache 2.0, więc całość możesz czytać, zmieniać i hostować.

OpenPencil zapisuje w formacie Figma `.fig`, który otwierają też Figma i inne narzędzia. Otwiera dokumenty `.pen`, więc projekt z Pencil można przenieść i zapisać jako `.fig`; o otwieraniu plików pisze strona [Eksport i pliki](/pl/user-guide/exporting).

## AI

Oba edytory są zbudowane do pracy z AI. Pencil uruchamia kilku agentów na obszarze roboczym jednocześnie, generuje obrazy i SVG, a użycie AI wlicza do limitów planu, chyba że podasz własny klucz lub subskrypcję.

[Asystent AI](/pl/user-guide/ai-chat) OpenPencil działa z Twoim własnym kluczem do Anthropic, OpenAI, Google AI, OpenRouter i innych dostawców, bez naszych limitów użycia, albo z kredytami zawartymi w planie Cloud. Ponad 100 narzędzi jest dostępnych dla agentów programistycznych przez [serwer MCP](/developers/mcp-server), a aplikacja na komputer uruchamia [agentów programistycznych](/user-guide/coding-agents), takich jak Claude Code i Codex, wewnątrz edytora, każdego z własnym kursorem na obszarze roboczym.

## Współpraca

OpenPencil pozwala edytować wspólnie w czasie rzeczywistym: otwórz [pokój peer-to-peer](/pl/user-guide/collaboration) bez konta i bez niczego do hostowania albo trzymaj dokumenty w [OpenPencil Cloud](/cloud/) — hostowanym lub na własnym serwerze — z udostępnianiem, komentarzami i historią wersji. Pencil udostępnia projekty przez link i udostępnianie na żywo, z komentarzami i wersjami, we własnej usłudze.

## Gdzie Pencil ma przewagę

- **Równolegli agenci.** W najwyższym planie Pencil uruchamia do sześciu agentów na jednym obszarze roboczym.
- **Generowane obrazy.** Pencil generuje obrazy i SVG oraz usuwa tła; OpenPencil wektoryzuje obrazy przez Recraft lub fal.ai, ale ich nie generuje.
- **Rozszerzenie edytora kodu.** Pencil działa wewnątrz VS Code i Cursor; OpenPencil działa obok nich.

## Co wybrać

Wybierz OpenPencil, jeśli chcesz edytora o otwartym kodzie źródłowym, który możesz hostować samodzielnie, plików w formacie, który otwiera też Figma, i AI na własnych kluczach bez limitów planu. Wybierz Pencil, jeśli chcesz, aby kilku agentów projektowało jednocześnie wewnątrz Twojego edytora kodu.
