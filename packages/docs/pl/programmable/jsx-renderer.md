---
title: Renderer JSX
description: Twórz projekty za pomocą JSX — składni, którą LLM-y już znają z milionów komponentów React.
---

# Renderer JSX

OpenPencil używa JSX jako języka tworzenia projektów. LLM-y widziały miliony komponentów React — opisanie layoutu jako `<Frame><Text>` jest naturalne, bez potrzeby specjalnego trenowania. Każdy token ma znaczenie, gdy agent AI wykonuje dziesiątki operacji, a JSX jest najbardziej zwięzłą deklaratywną reprezentacją.

JSX jest również porównywalny w diffach. Gdy AI modyfikuje projekt, zmiana jest diffem JSX — czytelnym, weryfikowalnym, kontrolowalnym wersyjnie.

## Tworzenie projektów

Narzędzie `render` (dostępne w czacie AI, MCP i CLI eval) przyjmuje JSX:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

W serwerze MCP i czacie AI narzędzie `render` przyjmuje ciągi JSX bezpośrednio. W CLI użyj polecenia `export`, aby pójść w drugą stronę — [eksportowanie projektów jako JSX](./cli/exporting).

## Elementy

Wszystkie typy węzłów są dostępne jako elementy JSX:

| Element | Tworzy | Aliasy |
|---------|--------|--------|
| `<Frame>` | Ramka (kontener, obsługuje auto-layout) | `<View>` |
| `<Rectangle>` | Prostokąt | `<Rect>` |
| `<Ellipse>` | Elipsa / koło | |
| `<Text>` | Węzeł tekstowy (dzieci stają się treścią tekstu) | |
| `<Line>` | Linia | |
| `<Star>` | Gwiazda | |
| `<Polygon>` | Wielokąt | |
| `<Vector>` | Ścieżka wektorowa | |
| `<Group>` | Grupa | |
| `<Section>` | Sekcja | |

## Właściwości stylów

Zwięzłe skrócone właściwości inspirowane nazewnictwem Tailwind.

### Layout

| Właściwość | Opis |
|------------|------|
| `flex` | `"row"` lub `"col"` — włącza auto-layout |
| `gap` | Odstęp między dziećmi |
| `wrap` | Zawijanie dzieci do następnej linii |
| `rowGap` | Odstęp na osi poprzecznej przy zawijaniu |
| `justify` | `"start"`, `"end"`, `"center"`, `"between"` |
| `items` | `"start"`, `"end"`, `"center"`, `"stretch"` |
| `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl` | Padding |

### Rozmiar i pozycja

| Właściwość | Opis |
|------------|------|
| `w`, `h` | Szerokość/wysokość — liczba, `"fill"` lub `"hug"` |
| `minW`, `maxW`, `minH`, `maxH` | Ograniczenia rozmiaru |
| `x`, `y` | Pozycja |

### Wygląd

| Właściwość | Opis |
|------------|------|
| `bg` | Wypełnienie tła (kolor hex) |
| `fill` | Alias dla `bg` |
| `stroke` | Kolor obrysu |
| `strokeWidth` | Szerokość obrysu (domyślnie: 1) |
| `rounded` | Zaokrąglenie narożników (lub `roundedTL`, `roundedTR`, `roundedBL`, `roundedBR`) |
| `cornerSmoothing` | Gładkie narożniki w stylu iOS (0–1) |
| `opacity` | 0–1 |
| `shadow` | Cień (np. `"0 4 8 #00000040"`) |
| `blur` | Promień rozmycia warstwy |
| `rotate` | Obrót w stopniach |
| `blendMode` | Tryb mieszania |
| `overflow` | `"hidden"` lub `"visible"` |

### Typografia

| Właściwość | Opis |
|------------|------|
| `size` / `fontSize` | Rozmiar czcionki |
| `font` / `fontFamily` | Rodzina czcionki |
| `weight` / `fontWeight` | `"bold"`, `"medium"`, `"normal"` lub liczba |
| `color` | Kolor tekstu |
| `textAlign` | `"left"`, `"center"`, `"right"`, `"justified"` |

## Eksport do JSX

Konwertuj istniejące projekty z powrotem do JSX:

```sh
open-pencil export design.fig -f jsx                   # format OpenPencil
open-pencil export design.fig -f jsx --style tailwind  # klasy Tailwind
```

Pełen cykl działa: wyeksportuj projekt jako JSX, zmodyfikuj kod, wyrenderuj z powrotem.

## Wizualne porównywanie

Ponieważ projekty są reprezentowalne jako JSX, zmiany stają się diffami kodu:

```diff
 <Frame name="Card" w={320} flex="col" gap={16} p={24} bg="#FFF">
-  <Text size={18} weight="bold">Old Title</Text>
+  <Text size={24} weight="bold" color="#1D1B20">New Title</Text>
   <Text size={14} color="#666">Description</Text>
 </Frame>
```

Dzięki temu zmiany projektowe są weryfikowalne w pull requestach, śledzone w systemie kontroli wersji i audytowalne w CI.
