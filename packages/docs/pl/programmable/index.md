---
layout: doc
title: AI i automatyzacja
description: Każda operacja w OpenPencil jest skryptowalna — czat AI, CLI, renderer JSX, serwer MCP, współpraca w czasie rzeczywistym.
---

# AI i automatyzacja

OpenPencil traktuje pliki projektowe jako dane. Każda operacja dostępna w edytorze — tworzenie kształtów, ustawianie wypełnień, zarządzanie auto-layoutem, eksportowanie zasobów — jest również dostępna z terminala, z agentów AI i z kodu. Bez wtyczek do instalowania, bez kluczy API, bez listy oczekujących.

Interfejs edytora i interfejsy automatyzacji korzystają z tego samego silnika. Jeśli możesz coś zrobić kliknięciem, możesz to zrobić skryptem.

## Czat AI

Wbudowany asystent ma dostęp do 87 narzędzi, które obejmują całą powierzchnię edytora. Opisz czego chcesz w języku naturalnym — „dodaj cień 16px do wszystkich przycisków", „utwórz komponent karty z wariantem ciemnego motywu", „wyeksportuj każdą ramkę na tej stronie w 2×".

[Czat AI →](./ai-chat)

## Współpraca

Edycja wieloosobowa w czasie rzeczywistym przez peer-to-peer WebRTC. Bez serwera, bez konta. Udostępnij link do pokoju i edytujcie wspólnie z kursorami na żywo i trybem śledzenia. Stan dokumentu synchronizuje się przez CRDT, więc edycje łączą się automatycznie nawet przy niestabilnym połączeniu.

[Współpraca →](./collaboration)

## Renderer JSX

Opisz UI jako JSX — tę samą składnię, którą LLM-y już znają z Reacta. Jedno wywołanie może stworzyć całe drzewo komponentów z ramkami, tekstem, auto-layoutem, wypełnieniami i obrysami. Zwięzłe, deklaratywne i porównywalne w diffach.

W drugą stronę — wyeksportuj dowolne zaznaczenie z powrotem do JSX z klasami Tailwind — przydatne do przekazywania do rozwoju lub do zasilania projektami z powrotem do LLM-a.

[Renderer JSX →](./jsx-renderer)

## CLI

Przeglądaj, eksportuj i analizuj pliki `.fig` bez otwierania edytora. Listuj strony, szukaj węzłów, wyodrębniaj tokeny projektowe, renderuj do PNG — wszystko z terminala z wyjściem JSON do odczytu maszynowego.

CLI łączy się również z uruchomioną aplikacją desktopową przez RPC, więc możesz skryptować edytor podczas pracy z nim.

[Przeglądanie plików](./cli/inspecting) · [Eksportowanie](./cli/exporting) · [Analiza projektów](./cli/analyzing) · [Skryptowanie](./cli/scripting)

## Serwer MCP

Połącz Claude Code, Cursor, Windsurf lub dowolnego klienta kompatybilnego z MCP z OpenPencil. Serwer udostępnia 90 narzędzi do odczytywania, tworzenia i modyfikowania projektów — te same narzędzia, z których korzysta wbudowany czat AI. Działa przez stdio lub HTTP z obsługą sesji.

[Serwer MCP →](./mcp-server)

## Dlaczego otwarte?

Figma to zamknięta platforma. Ich serwer MCP jest tylko do odczytu. Dostęp przez CDP w przeglądarce został usunięty w wersji 126. Pliki projektowe żyją w zastrzeżonym formacie na cudzych serwerach. Rozwój wtyczek wymaga niestandardowego środowiska uruchomieniowego z ograniczonymi API.

OpenPencil to alternatywa: open source, licencja MIT, każda operacja skryptowalna, dane przechowywane lokalnie. Twoje pliki projektowe są Twoje — przeglądaj je, przekształcaj, przesyłaj do CI, zasilaj nimi LLM. Bez potrzeby pozwolenia.
