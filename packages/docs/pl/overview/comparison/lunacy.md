---
title: OpenPencil a Lunacy
description: Czym różnią się OpenPencil i Lunacy, dwa darmowe edytory projektów na komputer otwierające pliki Figma, pod względem licencji, zapisu z powrotem do Figmy, AI i automatyzacji oraz własnego hostingu.
---

# OpenPencil a Lunacy

[Lunacy](https://icons8.com/lunacy) od Icons8 i OpenPencil to darmowe edytory projektów z natywnymi aplikacjami na macOS, Windows i Linux; oba otwierają pliki Figma `.fig`. Różnią się tym, kto kontroluje oprogramowanie i dokąd trafia Twoja praca później. Porównanie dotyczy wersji Lunacy 14 i OpenPencil 0.17.

## W skrócie

|                        | OpenPencil                                                                                            | Lunacy                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Licencja               | Otwarty kod: MIT (edytor), Apache 2.0 (serwer Cloud)                                                  | Zamknięte oprogramowanie darmowe                                                |
| Cena                   | Za darmo; plany Cloud dodają miejsce, edytorów i kredyty AI                                           | Za darmo; płatne plany za funkcje chmurowe i zespołowe oraz grafiki bez atrybucji |
| Platformy              | Aplikacja na macOS, Windows i Linux oraz przeglądarka                                                 | Aplikacja na macOS, Windows i Linux oraz przeglądarka                           |
| Natywny format         | Figma `.fig`                                                                                          | `.free` i Sketch `.sketch`                                                      |
| Pliki `.fig`           | Otwiera je i zapisuje; kopiowanie i wklejanie z Figmą w obie strony                                   | Otwiera je                                                                      |
| Praca offline          | Tak                                                                                                   | Tak, z dokumentami lokalnymi                                                    |
| Współpraca             | Pokoje peer-to-peer albo OpenPencil Cloud, z komentarzami i historią wersji                           | Chmura Lunacy z komentarzami; prywatna chmura dla zespołów                      |
| Własny hosting         | Serwer OpenPencil Cloud                                                                               | —                                                                               |
| Wbudowane AI           | Asystent w czacie z ponad 100 narzędziami projektowymi; własne klucze dostawców lub kredyty Cloud     | Czat AI w usłudze Icons8 oraz narzędzia do obrazów                              |
| Agenci programistyczni | Serwer MCP oraz Claude Code, Codex, Cursor i inni działający wewnątrz edytora                         | Serwer MCP                                                                      |
| Skrypty                | CLI bez interfejsu i skrypty zgodne z Figma Plugin API                                                | Wtyczki przez jego API MCP                                                      |
| Eksport kodu           | Design JSX, HTML, Vue i React z CSS lub Tailwind                                                      | Podgląd CSS                                                                     |
| Prototypowanie         | Działające zachowania komponentów; przepływy i przejścia są w [planach rozwoju](/development/roadmap) | Przepływy, smart animate i animacje sprężynowe                                  |
| Wbudowane zasoby       | Zestawy ikon                                                                                          | Ikony, zdjęcia, ilustracje i zestawy UI od Icons8                               |

## Praca z plikami Figma

Lunacy otwiera pliki `.fig` i zapisuje we własnym formacie `.free` albo jako pliki Sketch, więc projekt, który trafił z Figmy do Lunacy, nie wraca jako `.fig`. OpenPencil sam zapisuje `.fig`: możesz otworzyć plik od kolegi pracującego w Figmie, zmienić go i odesłać, a także kopiować i wklejać warstwy między obiema aplikacjami w dowolnym kierunku. Co jest przenoszone, opisuje strona [Zgodność z Figmą](/pl/reference/figma-compatibility).

## Otwarty kod i hosting

Lunacy jest darmowy, ale zamknięty: Icons8 decyduje, co robi program, i utrzymuje jego chmurę. Kod OpenPencil jest otwarty, a dokumenty mogą pozostać na Twoim urządzeniu, we własnym [zasobniku danych](/user-guide/cloud-storage) albo w [OpenPencil Cloud](/cloud/), także na [serwerze utrzymywanym przez Twój zespół](/cloud/self-hosting/).

## AI i automatyzacja

Czat AI w Lunacy działa w usłudze Icons8 i nie wymaga klucza API. [Asystent AI](/pl/user-guide/ai-chat) OpenPencil korzysta z Twojego klucza dostawcy lub kredytów Cloud, a te same ponad 100 narzędzi jest dostępnych dla agentów programistycznych przez [serwer MCP](/developers/mcp-server). [CLI](/pl/developers/cli/inspecting) analizuje, sprawdza i eksportuje dokumenty bez otwierania edytora, a [`eval`](/pl/developers/cli/scripting) uruchamia skrypty napisane pod Figma Plugin API.

## Gdzie Lunacy ma przewagę

- **Prototypowanie.** Lunacy ma przepływy, smart animate i animacje sprężynowe; OpenPencil nie ma jeszcze przepływów prototypu.
- **Wbudowane grafiki.** Lunacy zawiera ikony, zdjęcia, ilustracje i zestawy UI od Icons8.
- **Dojrzałość.** Lunacy jest rozwijany od lat i doszedł do wersji 14.

## Co wybrać

Wybierz OpenPencil, jeśli musisz dalej wymieniać pliki `.fig` z użytkownikami Figmy, chcesz oprogramowania i hostingu pod własną kontrolą albo chcesz, aby agenci programistyczni i skrypty pracowali nad Twoimi projektami. Wybierz Lunacy, jeśli chcesz prototypowania i dużej wbudowanej biblioteki grafik w darmowej aplikacji.
