---
title: Przeglądanie dokumentów
description: Drzewo obiektów, wyszukiwanie według nazwy i typu oraz właściwości z terminala.
---

# Przeglądanie dokumentów

CLI pozwala analizować dokumenty projektu bez uruchamiania edytora. Te same polecenia działają z otwartą aplikacją komputerową, jeśli nie podasz pliku.

::: tip Instalacja
```sh
npm install -g @open-pencil/cli
# albo
bun add -g @open-pencil/cli
# albo
brew install open-pencil/tap/open-pencil
```
:::

## Informacje ogólne

Liczba stron i obiektów, używane czcionki oraz rozmiar pliku:

```sh
openpencil info design.fig
```

## Drzewo obiektów

```sh
openpencil tree design.fig
```

## Wyszukiwanie obiektów

Według typu:

```sh
openpencil find design.fig --type TEXT
```

Według nazwy:

```sh
openpencil find design.fig --name "Button"
```

## Zapytania XPath

Selektory XPath wyszukują obiekty według typu, atrybutów i położenia w drzewie:

```sh
openpencil query design.fig "//FRAME"
```

```sh
openpencil query design.fig "//TEXT"                    # Wszystkie obiekty tekstowe
openpencil query design.fig "//COMPONENT"               # Wszystkie komponenty
openpencil query design.fig "//INSTANCE"                # Wszystkie egzemplarze
openpencil query design.fig "//FRAME[@width < 300]"     # Ramki węższe niż 300 px
openpencil query design.fig "//*[@cornerRadius > 0]"    # Obiekty z zaokrąglonymi narożnikami
openpencil query design.fig "//*[@visible = false]"     # Ukryte obiekty
openpencil query design.fig "//SECTION//TEXT"            # Tekst wewnątrz sekcji
```

Nazwy dostępnych atrybutów, takie jak `fontSize`, `layoutMode` i `strokeWeight`, pozostają zgodne z API.

## Właściwości obiektu

```sh
openpencil node design.fig --id 1:23
```

## Strony i zmienne

```sh
openpencil pages design.fig
openpencil variables design.fig
```

## Praca z otwartą aplikacją

Jeśli aplikacja komputerowa jest uruchomiona, nie podawaj ścieżki pliku. CLI połączy się przez RPC z otwartym dokumentem:

```sh
openpencil documents
openpencil tree
openpencil tree --document-id tab-123 --page-id 0:1
openpencil eval --document-id tab-123 --page-id 0:1 -c "..."
```

W procesach automatycznych najpierw wywołaj `openpencil documents --json`, a potem jawnie przekazuj `--document-id` i `--page-id`.

## Kontrola jakości

Sprawdzanie nazw, układu, struktury i dostępności:

```sh
openpencil lint design.fig
openpencil lint design.pen --preset strict
openpencil lint design.fig --rule color-contrast
openpencil lint design.fig --list-rules
```

## Wyjście JSON

Wszystkie polecenia obsługują `--json`. Wynik można przekazać do `jq`, CI albo innego programu.
