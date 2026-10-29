---
title: Skrypty
description: Wykonywanie JavaScript przez API zgodne z Figma Plugin API do wyszukiwania, masowych zmian i tworzenia projektu.
---

# Skrypty

`openpencil eval` wykonuje JavaScript dla dokumentu OpenPencil i udostępnia globalny obiekt `figma` zgodny z Figma Plugin API. Polecenie nadaje się do zmian zbiorczych, sprawdzania dokumentów, przygotowywania danych testowych i automatyzacji bez interfejsu edytora.

## Pierwsze wywołanie

```sh
openpencil eval design.fig -c "return figma.currentPage.children.length"
```

Opcja `-c` przyjmuje JavaScript. Jeśli kod nie zaczyna się od `return`, OpenPencil umieszcza go w funkcji asynchronicznej i zwraca jej wynik, jeśli istnieje.

## Wyszukiwanie obiektów

```sh
openpencil eval design.fig -c "
  return figma.currentPage
    .findAll((node) => node.type === 'FRAME' && node.name.includes('Button'))
    .map((button) => ({ id: button.id, name: button.name }))
"
```

## Zmiana i zapis

`--write` albo `-w` zapisuje zmiany w pliku wejściowym. `--output` albo `-o` tworzy nowy plik.

## Skrypt ze standardowego wejścia

```sh
cat transform.js | openpencil eval design.fig --stdin --write
```

## Otwarta aplikacja

Nie podawaj pliku, aby wykonać skrypt dla bieżącego dokumentu w aplikacji komputerowej.

## Wyjście

Po przekierowaniu wyjścia domyślnie używany jest JSON. Opcja `--json` włącza go jawnie, a `--quiet` wyłącza wyjście.

## Dostępne API

API jest celowo zbliżone do Figma Plugin API, ale pracuje z SceneGraph i formatami plików OpenPencil.

### Dokument i strony

- `figma.root`
- `figma.currentPage`
- `figma.currentPage.selection`
- `figma.getNodeById(id)`
- `figma.createPage()`

### Tworzenie obiektów

- `figma.createFrame()`
- `figma.createRectangle()`
- `figma.createEllipse()`
- `figma.createText()`
- `figma.createLine()`
- `figma.createPolygon()`
- `figma.createStar()`
- `figma.createVector()`
- `figma.createNodeFromSvg(svg)`
- `figma.createComponent()`
- `figma.createSection()`

### Drzewo

- `node.children`
- `node.parent`
- `node.appendChild(child)`
- `node.insertChild(index, child)`
- `node.clone()`
- `node.remove()`
- `node.findAll(callback?)`
- `node.findOne(callback)`
- `figma.group(nodes, parent)`
- `figma.ungroup(node)`

### Komponenty i zmienne

Nazwy metod, takie jak `component.createInstance()`, `figma.variables.getLocalVariables()` i `node.setBoundVariable()`, pozostają zgodne z Figma Plugin API. Tak jak panel warstwy zmienne wiąże się z polami przez `openpencil.bindVariable(node, field, variable)` i `openpencil.unbindVariable(node, field)`. Kierunek automatycznego układu i tekstu (`AUTO`, `LTR`, `RTL`) ustawiają `openpencil.setLayoutDirection(node, direction)` i `openpencil.setTextDirection(node, direction)`, kolor w OkHCL `openpencil.setFillOkHCL(node, color)` i `setStrokeOkHCL`, a `openpencil.exposeInstanceSwap` i `openpencil.getFontStatus()` udostępniają zamianę instancji i stan czcionek.

### Właściwości

Najczęściej używane właściwości można odczytywać i zapisywać przez pośrednika:

- geometria: `x`, `y`, `width`, `height`, `rotation`, `resize(width, height)`;
- wygląd: `fills`, `strokes`, `effects`, `opacity`, `visible`, `locked`, `blendMode`, `clipsContent`;
- tekst: `characters`, `fontSize`, `fontName`, `fontWeight`, wyrównanie, interlinia, odstęp między znakami i funkcje zakresów stylów;
- automatyczny układ: `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems`, `itemSpacing`, wypełnienie, rozmiary i położenie;
- obwiednia: `strokeWeight`, `strokeAlign`, `dashPattern`;
- status: `devStatus` sekcji, ramek, komponentów, zestawów komponentów i instancji leżących bezpośrednio na stronie lub w sekcji: `{ type: 'READY_FOR_DEV' | 'COMPLETED' }` albo `null` (opis nie jest zachowywany); odczytuje się jako `null`, dopóki warstwa leży tam, gdzie status nie jest widoczny.

### Narzędzia pomocnicze

- `figma.mixed`
- `figma.createImage(data)`
- `figma.loadFontAsync(fontName)` wczytuje czcionkę; jak w Figmie, zmiana tekstu, jego rozmiaru lub czcionki wymaga wcześniejszego wczytania używanych czcionek
- `figma.listAvailableFontsAsync()` zwraca dostępne czcionki systemowe
- `figma.notify(message)` zapisuje ostrzeżenie w trybie bez interfejsu
- `figma.viewport`

## Brak pełnej zgodności z Figmą

Nie są jeszcze dostępne między innymi `node.exportAsync()`, zmienne z bibliotek i API stylów Figmy.

Zamiast nich używaj poleceń eksportu CLI, narzędzi głównego pakietu albo bezpośrednich funkcji pomocniczych SceneGraph.
