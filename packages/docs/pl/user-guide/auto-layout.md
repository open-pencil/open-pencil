---
title: Auto-layout
description: Layout flex i grid w Inkly — kierunek, odstępy, padding, wyrównanie, rozmiary i ścieżki CSS Grid.
---
# Auto-layout

Auto-layout automatycznie pozycjonuje dzieci wewnątrz ramki. Obsługuje dwa tryby: **flex** (przepływ poziomy/pionowy) i **grid** (wiersze i kolumny z wymiarowaniem ścieżek).

<kbd>⇧</kbd><kbd>A</kbd> aby włączyć/wyłączyć lub opakować zaznaczenie.

## Kierunek
- **Poziomy** — od lewej do prawej
- **Pionowy** — z góry na dół
- **Zawijanie** — zawija gdy brakuje miejsca

## Odstępy
**Gap** między sąsiednimi dziećmi. **Padding** między krawędzią ramki a dziećmi.

## Wyrównanie
- **Oś główna (Justify):** początek, środek, koniec, rozłóż
- **Oś poprzeczna (Align):** początek, środek, koniec, rozciągnij

## Rozmiar dzieci
- **Stały** — jawna szerokość/wysokość
- **Wypełnij** — rozciąga się w dostępnej przestrzeni
- **Dopasuj** — kurczy się do zawartości

## CSS Grid

Layout siatkowy (grid) organizuje dzieci w wierszach i kolumnach z jawnym wymiarowaniem ścieżek.

### Włączanie siatki

Wybierz ramkę z włączonym auto-layout i kliknij ikonę siatki w pasku narzędzi layout, aby przełączyć z flex na grid.

### Wymiarowanie ścieżek

Zdefiniuj ścieżki kolumn i wierszy za pomocą trzech trybów:

- **fr** — jednostka ułamkowa, dzieli dostępną przestrzeń proporcjonalnie
- **px** — stały rozmiar w pikselach
- **auto** — dopasowuje się do zawartości

### Odstępy siatki

Ustaw oddzielne odstępy poziome (kolumny) i pionowe (wiersze) między komórkami.

### Pozycjonowanie dzieci

Dzieci są umieszczane w komórkach siatki automatycznie w kolejności wierszy. Można nadpisać umieszczenie wartościami początku kolumny/wiersza i rozpiętości we właściwościach layout dziecka.

### Eksport JSX i Tailwind

Layouty siatkowe eksportują się jako JSX z klasami Tailwind: `grid grid-cols-3`, `gap-x-4 gap-y-2`, `col-start-2 row-span-2`.
