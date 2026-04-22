---
title: Architektura SDK
description: Struktura katalogów, granice publicznego API i wzorce kompozycji w @open-pencil/vue.
---

# Architektura SDK

`@open-pencil/vue` to warstwa Vue nad `@open-pencil/core`.

Nie jest właścicielem samego modelu edytora. Adaptuje rdzeń edytora do:

- wstrzyknięcia Vue
- reaktywnych kompozytów
- bezstanowych prymitywów strukturalnych
- okablowania kanvasu i wejść

## Struktura katalogów

Pakiet jest zorganizowany według domeny.

### Rodziny komponentów

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `ScrubInput/`
- `Toolbar/`

Zawierają prymitywy strukturalne/bezstanowe i lokalne pomocniki.

### Kontrolki

`controls/` zawiera kompozyty panelu właściwości i kontrolek edytora:

- `usePosition`
- `useLayout`
- `useAppearance`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`

### Zmienne

`VariablesEditor/` zawiera kompozyty domeny zmiennych i okablowanie stanu.

### Selekcja

`selection/` zawiera stan edytora pochodny od selekcji i możliwości.

### Kontekst

`context/` zawiera pomocniki wstrzykiwania edytora:

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Wewnętrzne

`internal/` zawiera narzędzia przekrojowe nieprzeznaczone jako główne bezstanowe prymitywy.

## Filozofia publicznego API

### Preferuj kompozyty

Jeśli problem dotyczy głównie logiki sterowania, derywacji stanu lub akcji edytora, udostępnij kompozyt.

### Zachowaj bezstanowe prymitywy dla znaczącej struktury

Używaj korzeni komponentów, gdy koordynują strukturę, dzieci, sloty lub kontekst.

Przykłady:

- `PageListRoot`
- `PropertyListRoot`
- `ToolbarRoot`

### Unikaj slotów z masowym zrzutem kontekstu

Preferuj skupione właściwości slotów lub bezpośrednie użycie kompozytu zamiast gigantycznych ładunków `v-slot="ctx"`.

## Odpowiedzialność aplikacji vs SDK

### SDK odpowiada za

- integrację edytora
- wielokrotnie używalną logikę bezstanową
- wielokrotnie używalną strukturę UI bez założeń dotyczących stylowania
- integrację renderowania kanvasu

### Aplikacja odpowiada za

- stylowanie
- powłoki layoutu
- routing
- przepływy plików produktu
- powiadomienia, menu i UX specyficzne dla aplikacji

## Praktyczna zasada

Jeśli logika mogłaby być użyta ponownie w innej aplikacji opartej na OpenPencil bez przenoszenia stylowania aplikacji, prawdopodobnie należy do `@open-pencil/vue`.

## Powiązane strony

- [Pierwsze kroki z SDK](./getting-started)
- [Dokumentacja API](./api/)
