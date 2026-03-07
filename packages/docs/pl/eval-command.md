# `open-pencil eval` — API Pluginów kompatybilne z Figmą do skryptowania headless

## Przegląd

`bun open-pencil eval <file> --code '<js>'` wykonuje JavaScript na pliku `.fig` z globalnym obiektem `figma` kompatybilnym z Figmą. Umożliwia to skryptowanie headless, operacje wsadowe, wykonywanie narzędzi AI i testy — wszystko bez GUI.

Obiekt `figma` odzwierciedla powierzchnię API Pluginów Figmy jak najdokładniej, więc istniejąca wiedza o pluginach Figmy i fragmenty kodu są bezpośrednio przenośne.

```bash
# Utworzenie ramki, ustawienie auto-layout, dodanie dzieci
bun open-pencil eval design.fig --code '
  const frame = figma.createFrame()
  frame.name = "Card"
  frame.resize(300, 200)
  frame.layoutMode = "VERTICAL"
  frame.itemSpacing = 12
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
  return { id: frame.id, name: frame.name }
'

# Zapytanie o węzły
bun open-pencil eval design.fig --code '
  const buttons = figma.currentPage.findAll(n => n.name.includes("Button"))
  return buttons.map(b => ({ id: b.id, name: b.name }))
'

# Zapis zmian
bun open-pencil eval design.fig --code '...' --write
```

## Architektura

```
CLI: open-pencil eval <file> --code '...'
  → loadDocument(file) → SceneGraph
  → FigmaAPI(sceneGraph) → proxy `figma`
  → AsyncFunction('figma', code)(figmaProxy)
  → wydruk wyniku / zapis pliku z --write
```

### Główne klasy

| Klasa | Lokalizacja | Rola |
|-------|-------------|------|
| `FigmaAPI` | `packages/core/src/figma-api.ts` | Obiekt proxy implementujący metody `figma.*` |
| `FigmaNode` | `packages/core/src/figma-api.ts` | Proxy opakowujący `SceneNode` z dostępem do właściwości w stylu Figmy |
| Polecenie `eval` | `packages/cli/src/commands/eval.ts` | Ładuje dokument, tworzy API, wykonuje kod |

### Dlaczego w `@open-pencil/core`?

Klasa `FigmaAPI` żyje w core, ponieważ: narzędzia AI ją reużywają, testy mogą jej używać i nie ma zależności DOM.

## Polecenie CLI

```
bun open-pencil eval <file> [opcje]

Argumenty:
  file            Plik .fig do przetworzenia

Opcje:
  --code, -c      Kod JavaScript do wykonania
  --stdin         Odczyt kodu ze stdin
  --write, -w     Zapis zmian do pliku wejściowego
  -o, --output    Zapis do innego pliku
  --json          Wynik jako JSON
  --quiet, -q     Pomiń wydruk
```

## Implementacja fazowa

- **Faza 1: Core** — tworzenie węzłów, właściwości, operacje na drzewie, auto-layout, tekst (~80% realnych skryptów)
- **Faza 2: Komponenty i Instancje** — createComponent, createInstance, detachInstance
- **Faza 3: Zmienne** — getLocalVariables, createVariable, setBoundVariable
- **Faza 4: Style i Zaawansowane** — style paint/tekst/efekty, operacje boolowskie

[Pełna referencja API po angielsku](/eval-command)
