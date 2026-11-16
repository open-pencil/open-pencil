---
layout: doc
title: Dla programistów
description: Automatyzuj pliki projektowe z terminala, pozwól agentowi AI sterować edytorem albo zbuduj własny edytor na silniku OpenPencil.
---

# Dla programistów

Wszystko, co robi edytor, jest dostępne także poza nim: z terminala, dla agentów AI i z kodu. Wszystko działa na tym samym silniku co aplikacja, więc to, co możesz zrobić kliknięciem, możesz też zrobić skryptem. Wybierz narzędzie odpowiednie do tego, co chcesz zbudować.

## Skrypty dla plików projektowych

CLI `openpencil` odczytuje, sprawdza, eksportuje i edytuje pliki `.fig` i `.pen` bez uruchamiania aplikacji oraz zwraca JSON dla skryptów i CI. Gdy działa aplikacja komputerowa, to samo CLI nią steruje: otwiera i zapisuje dokumenty, cofa zmiany, zmienia ustawienia i wywołuje dowolne narzędzie edytora.

<SdkCardGroup>
  <SdkCard title="Opis poleceń" to="/reference/cli" description="Wszystkie polecenia i ich opcje." />
  <SdkCard title="Przeglądanie dokumentów" to="/pl/developers/cli/inspecting" description="Strony, węzły, zapytania XPath i tokeny projektu." />
  <SdkCard title="Eksport" to="/pl/developers/cli/exporting" description="Obrazy, JSX, HTML, tokeny projektu i historyjki Storybook." />
  <SdkCard title="Skrypty" to="/pl/developers/cli/scripting" description="Figma Plugin API i API openpencil przez eval." />
</SdkCardGroup>

## Projektowanie z agentem AI

Serwer MCP udostępnia Claude Code, Cursorowi, Windsurfowi i każdemu klientowi MCP te same 90 narzędzi, których używa wbudowany asystent, dzięki czemu agent może odczytywać, tworzyć i zmieniać projekty. Agenci opisują interfejs w JSX, z którego powstają prawdziwe ramki, tekst i automatyczny układ.

<SdkCardGroup>
  <SdkCard title="Serwer MCP" to="/developers/mcp-server" description="Połącz klienta przez stdio lub HTTP." />
  <SdkCard title="Renderer JSX" to="/pl/developers/jsx-renderer" description="Twórz drzewa komponentów z JSX i eksportuj zaznaczenie z powrotem do JSX." />
  <SdkCard title="Opis JSX projektu" to="/reference/design-authoring" description="Co akceptuje JSX projektu." />
</SdkCardGroup>

Jeśli wolisz używać agenta w aplikacji, zobacz [Czat AI](../user-guide/ai-chat) i [Agenci programistyczni](/user-guide/coding-agents).

## Własny edytor

`@open-pencil/vue` to Vue SDK, na którym zbudowana jest aplikacja: kontekst edytora, obszar roboczy, zaznaczenie, polecenia i panele bez narzuconego wyglądu, które stylujesz samodzielnie. Biblioteki silnika działają bez Vue, w przeglądarce lub na serwerze.

<SdkCardGroup>
  <SdkCard title="Vue SDK" to="/pl/developers/sdk/" description="Osadź edytor albo zbuduj własny, wyspecjalizowany." />
  <SdkCard title="Natywne API JavaScript" to="/developers/native-api" description="Biblioteki silnika bez interfejsu." />
  <SdkCard title="Schemat URL" to="/pl/developers/url-scheme" description="Prowadź ze strony prosto do warstwy w aplikacji." />
</SdkCardGroup>

## Zajrzyj do środka

<SdkCardGroup>
  <SdkCard title="Dokumentacja techniczna" to="/reference/node-types" description="Typy węzłów, graf sceny, mapowanie DOM/CSS i format pliku." />
  <SdkCard title="Współtworzenie" to="/development/contributing" description="Zbuduj aplikację, uruchom testy i wyślij zmianę." />
</SdkCardGroup>
