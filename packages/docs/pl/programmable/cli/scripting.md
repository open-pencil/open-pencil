---
title: Skryptowanie
description: Wykonuj JavaScript z Figma Plugin API — odpytuj węzły, modyfikuj projekty wsadowo, twórz ramki.
---

# Skryptowanie

`open-pencil eval` daje Ci pełne Figma Plugin API w terminalu. Odczytuj węzły, modyfikuj właściwości, twórz kształty — a następnie zapisz zmiany z powrotem do pliku.

## Podstawowe użycie

```sh
open-pencil eval design.fig -c "figma.currentPage.children.length"
```

Flaga `-c` przyjmuje JavaScript. Globalny obiekt `figma` działa jak Figma Plugin API.

## Odpytywanie węzłów

```sh
open-pencil eval design.fig -c "
  figma.currentPage.findAll(n => n.type === 'FRAME' && n.name.includes('Button'))
    .map(b => ({ id: b.id, name: b.name, w: b.width, h: b.height }))
"
```

## Modyfikacja i zapis

```sh
open-pencil eval design.fig -c "
  figma.currentPage.children.forEach(n => n.opacity = 0.5)
" -w
```

`-w` zapisuje zmiany z powrotem do pliku wejściowego. Użyj `-o output.fig`, aby zapisać do innego pliku.

## Odczyt ze stdin

Dla dłuższych skryptów:

```sh
cat transform.js | open-pencil eval design.fig --stdin -w
```

## Tryb żywej aplikacji

Pomiń plik, aby uruchomić na działającej aplikacji desktopowej:

```sh
open-pencil eval -c "figma.currentPage.name"
```

## Dostępne API

Obiekt `figma` obsługuje:

- `figma.currentPage` — aktywna strona
- `figma.root` — korzeń dokumentu
- `figma.createFrame()`, `figma.createRectangle()`, `figma.createEllipse()`, `figma.createText()` itp.
- `.findAll()`, `.findOne()` — wyszukiwanie potomków
- `.appendChild()`, `.insertChild()` — manipulacja drzewem
- Wszystkie settery właściwości: `.fills`, `.strokes`, `.effects`, `.opacity`, `.cornerRadius`, `.layoutMode`, `.itemSpacing` itp.

To jest to samo API, którego używają wtyczki Figma, więc istniejąca wiedza i fragmenty kodu można zastosować bezpośrednio.

## Wyjście JSON

```sh
open-pencil eval design.fig -c "..." --json
```
