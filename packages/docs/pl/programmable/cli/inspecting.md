---
title: Przeglądanie plików
description: Przeglądaj drzewa węzłów, szukaj po nazwie lub typie i sprawdzaj właściwości z terminala.
---

# Przeglądanie plików

CLI pozwala eksplorować pliki `.fig` bez otwierania edytora. Każde polecenie działa również na żywej aplikacji — wystarczy pominąć argument pliku.

::: tip Instalacja
```sh
bun add -g @open-pencil/cli
# lub
brew install open-pencil/tap/open-pencil
```
:::

## Informacje o dokumencie

Szybki przegląd — liczba stron, łączna liczba węzłów, użyte czcionki, rozmiar pliku:

```sh
open-pencil info design.fig
```

## Drzewo węzłów

Wyświetl pełną hierarchię węzłów:

```sh
open-pencil tree design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

## Wyszukiwanie węzłów

Szukaj po typie:

```sh
open-pencil find design.fig --type TEXT
```

Szukaj po nazwie:

```sh
open-pencil find design.fig --name "Button"
```

Obie flagi można łączyć, aby zawęzić wyniki.

## Szczegóły węzła

Sprawdź wszystkie właściwości konkretnego węzła po jego ID:

```sh
open-pencil node design.fig --id 1:23
```

## Strony

Wylistuj wszystkie strony w dokumencie:

```sh
open-pencil pages design.fig
```

## Zmienne

Wylistuj zmienne projektowe i ich kolekcje:

```sh
open-pencil variables design.fig
```

## Tryb żywej aplikacji

Gdy aplikacja desktopowa jest uruchomiona, pomiń argument pliku — CLI łączy się przez RPC i operuje na żywym płótnie:

```sh
open-pencil tree              # przeglądaj żywy dokument
open-pencil eval -c "..."     # odpytuj edytor
```

## Wyjście JSON

Wszystkie polecenia obsługują `--json` dla wyjścia w formacie do odczytu maszynowego — przekieruj do `jq`, zasilaj skrypty CI lub przetwarzaj innymi narzędziami:

```sh
open-pencil tree design.fig --json | jq '.[] | .name'
```
