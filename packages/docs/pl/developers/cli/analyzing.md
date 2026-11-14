---
title: Analiza projektu
description: Sprawdzanie kolorów, typografii, odstępów i powtarzających się struktur w plikach .fig.
---

# Analiza projektu

Polecenia `analyze` sprawdzają dokument z terminala: znajdują niespójne wartości, wyodrębniają rzeczywistą paletę i wykrywają powtarzające się struktury, które można przekształcić w komponenty.

## Kolory

```sh
openpencil analyze colors design.fig
```

Polecenie znajduje wszystkie kolory, liczy ich użycia i buduje histogram.

## Typografia

```sh
openpencil analyze typography design.fig
```

Wynik zawiera kombinacje rodziny, rozmiaru i odmiany czcionki oraz liczbę użyć każdej z nich. Pozwala to znaleźć przypadkowe style tekstu, które warto ujednolicić.

## Odstępy

```sh
openpencil analyze spacing design.fig
```

Polecenie sprawdza odstępy i wypełnienie w ramkach z automatycznym układem. Pomaga na przykład zauważyć przypadkowy odstęp `13px` pośród wartości skali `8/16/24`.

## Powtarzające się struktury

```sh
openpencil analyze clusters design.fig
```

Polecenie znajduje powtarzające się struktury obiektów, które mogą stać się komponentami.

## Wyjście JSON

Wszystkie polecenia `analyze` obsługują `--json`. Wynik można przekazać do `jq`, użyć w CI albo w skryptach kontrolujących tokeny projektu.
