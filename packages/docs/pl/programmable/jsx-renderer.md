---
title: Renderer JSX
description: Deklaratywne tworzenie projektu w JSX i eksport z powrotem do JSX lub HTML z Tailwind.
---

# Renderer JSX

OpenPencil używa JSX jako deklaratywnego języka tworzenia projektu. Nadaje się on do agentów AI, skryptów i powtarzalnego budowania interfejsów.

JSX służy też jako czytelna reprezentacja istniejącego projektu. Zmiany wyglądają jak zwykła różnica w kodzie, którą można sprawdzić i zachować w systemie kontroli wersji.

## Tworzenie projektu

Narzędzie `render`, dostępne w czacie AI, MCP i `eval` CLI, przyjmuje JSX:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

W MCP i czacie AI przekaż narzędziu `render` ciąg JSX. W kodzie aplikacji lub bibliotece działającej bez interfejsu zaimportuj `Frame`, `Text` i pozostałe elementy do tworzenia projektu z `@open-pencil/design-jsx`, a potem twórz obiekty przez `renderTree` lub `renderJSX` z `@open-pencil/core/design-jsx`, które dodają ikony, konwersję SVG i układ. Aby zapisywać drzewa jako TSX, ustaw w `tsconfig.json` `"jsxImportSource": "@open-pencil/design-jsx"` wraz z `"jsx": "react-jsx"` albo dodaj do pliku komentarz `/** @jsxImportSource @open-pencil/design-jsx */`. Środowisko skryptowe określa, które API są dostępne w `eval`; eksporty pakietów nie są tam automatycznie zmiennymi globalnymi. Do konwersji w drugą stronę użyj polecenia `export`.

## Elementy

| Element | Tworzy | Alias |
|---------|--------|-------|
| `<Frame>` | Ramkę z automatycznym układem | `<View>` |
| `<Rectangle>` | Prostokąt | `<Rect>` |
| `<Ellipse>` | Elipsę lub koło | |
| `<Text>` | Obiekt tekstowy; elementy potomne stają się treścią | |
| `<Line>` | Linię | |
| `<Star>` | Gwiazdę | |
| `<Polygon>` | Wielokąt | |
| `<Vector>` | Ścieżkę wektorową | |
| `<Group>` | Grupę | |
| `<Section>` | Sekcję | |

## Właściwości stylu

Nazwy właściwości pozostają zgodne z API JSX, natomiast ich znaczenie jest następujące:

- `flex`, `gap`, `wrap`, `justify`, `items` i skróty `p*` sterują układem i odstępami;
- `w`, `h`, `minW`, `maxW`, `x` i `y` sterują rozmiarem i położeniem;
- `bg`, `stroke`, `rounded`, `opacity`, `shadow`, `blur` i `blendMode` sterują wyglądem;
- `fontFamily`, `fontSize`, `fontWeight`, `color` i `textAlign` sterują typografią.

## Eksport do JSX

```sh
openpencil export design.fig -f jsx                   # Format OpenPencil
openpencil export design.fig -f jsx --style tailwind  # Klasy Tailwind
```

Wyeksportowany projekt można zmienić jak kod i ponownie wyrenderować. Eksport zapisuje ukryte i zablokowane warstwy, ograniczenia, limity rozmiaru, wielowarstwowe, gradientowe i obrazowe zalewy, obwiednie, efekty, maski oraz powiązania ze zmiennymi, więc renderowanie eksportu je odtwarza, a `diff_jsx` pokazuje zmiany każdego z nich. Tekst sformatowany wieloma stylami, ścieżki wektorowe, siatki układu, style współdzielone i definicje właściwości komponentów nie są jeszcze zapisywane. Egzemplarze są zapisywane jako ramki z zawartością, dzięki czemu wyeksportowany JSX jest samodzielny.

## Porównanie zmian

Różnica JSX może być sprawdzana w przeglądzie zmian i przechowywana w systemie kontroli wersji.
