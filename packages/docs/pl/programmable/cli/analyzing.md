---
title: Analiza projektów
description: Audytuj kolory, typografię, odstępy i powtarzające się wzorce w plikach .fig.
---

# Analiza projektów

Polecenia `analyze` audytują cały system projektowy z terminala — znajdują niespójności, wyodrębniają rzeczywistą paletę i wykrywają komponenty czekające na wydzielenie.

## Kolory

```sh
open-pencil analyze colors design.fig
```

Znajduje każdy kolor w pliku, zlicza użycie i wyświetla wizualny histogram:

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×
```

## Typografia

```sh
open-pencil analyze typography design.fig
```

Listuje każdą kombinację rodziny czcionek, rozmiaru i grubości wraz z liczbą użyć. Przydatne do wykrywania jednorazowych stylów tekstowych, które powinny zostać ujednolicone.

## Odstępy

```sh
open-pencil analyze spacing design.fig
```

Audytuje wartości gap i padding w ramkach z auto-layoutem. Pomaga zidentyfikować niespójności w skali odstępów — np. przypadkowy `13px` gap wśród wartości `8/16/24`.

## Klastry

```sh
open-pencil analyze clusters design.fig
```

Znajduje powtarzające się wzorce węzłów, które mogłyby zostać wydzielone jako komponenty:

```
3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

## Wyjście JSON

Wszystkie polecenia analyze obsługują `--json` dla wyjścia w formacie do odczytu maszynowego:

```sh
open-pencil analyze colors design.fig --json
```

Przekieruj do `jq`, zasilaj kontrole CI lub używaj w skryptach egzekwujących budżety tokenów projektowych.
