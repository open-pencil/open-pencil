---
layout: doc
title: AI i automatyzacja
description: Czat AI, CLI, JSX, serwer MCP i inne narzędzia automatyzacji oparte na silniku OpenPencil.
---

# AI i automatyzacja

OpenPencil pozwala traktować pliki projektowe jak dane. Wszystkie operacje edytora — tworzenie figur, ustawianie zalewów, zarządzanie automatycznym układem i eksport zasobów — są dostępne także z terminala, dla agentów AI i z kodu.

Interfejs edytora i narzędzia automatyzacji korzystają z tego samego silnika. Każde działanie dostępne w interfejsie można również wykonać ze skryptu.

## Czat AI

Wbudowany asystent używa ponad 90 narzędzi. Opisz zadanie zwykłym językiem, na przykład: „dodaj wszystkim przyciskom cień 16 px”, „utwórz komponent karty z wariantem ciemnym” albo „wyeksportuj wszystkie ramki na tej stronie w skali 2×”.

[Czat AI →](./ai-chat)

## Współpraca

Dokument jest synchronizowany bezpośrednio między uczestnikami przez WebRTC. Centralny serwer i konto nie są potrzebne. Kursory uczestników i tryb śledzenia pokazują ich obecność, a Yjs CRDT łączy równoczesne zmiany.

[Współpraca →](./collaboration)

## Vue SDK

Twórz edytory oparte na OpenPencil za pomocą tego samego Vue SDK, którego używa aplikacja. SDK udostępnia kontekst edytora, podłączenie obszaru roboczego, stan zaznaczenia, modele poleceń, composables dla paneli właściwości i komponenty bez narzuconego wyglądu.

[Vue SDK →](./sdk/)

## JSX

Opisuj interfejs za pomocą JSX. Jedno wywołanie może utworzyć drzewo komponentów zawierające ramki, tekst, automatyczny układ, zalewy i obwiednie.

W drugą stronę OpenPencil eksportuje zaznaczenie jako JSX albo HTML z klasami Tailwind. Wynik może służyć jako podstawa implementacji, przeglądu kodu lub kolejnego kroku z AI.

[JSX →](./jsx-renderer)

## CLI

Przeglądaj, eksportuj i analizuj dokumenty bez uruchamiania edytora. CLI pozwala wyświetlać strony, znajdować obiekty, wydobywać tokeny projektu, wykrywać problemy układu i eksportować PNG. Wszystkie polecenia obsługują wyjście JSON.

CLI łączy się również przez RPC z uruchomioną aplikacją komputerową i steruje otwartym dokumentem.

[Przeglądanie plików](./cli/inspecting) · [Eksport](./cli/exporting) · [Analiza](./cli/analyzing) · [Skrypty](./cli/scripting)

## Serwer MCP

Claude Code, Cursor, Windsurf i inni klienci MCP mogą korzystać z tych samych 90 narzędzi co czat AI. Serwer obsługuje stdio i HTTP z sesjami.

[Serwer MCP →](/programmable/mcp-server)

## Otwarta platforma

OpenPencil jest udostępniany na licencji MIT, przechowuje dokumenty lokalnie i zapewnia programowy dostęp do operacji. Pliki `.fig` można sprawdzać, przekształcać, przetwarzać w CI i przekazywać modelowi językowemu bez zależności od konkretnego dostawcy hostingu.
