---
title: Architektura SDK
description: Struktura pakietu, granice publicznego API i zasady projektowania @open-pencil/vue.
---

# Architektura SDK

`@open-pencil/vue` łączy `@open-pencil/core` z Vue.

Model edytora nadal znajduje się w core. Ten pakiet dodaje:

- dependency injection za pomocą Vue;
- reaktywne composables;
- strukturalne komponenty bez narzuconego wyglądu;
- podłączenie obszaru roboczego i obsługę danych wejściowych.

## Struktura pakietu

Kod jest podzielony według obszarów funkcjonalnych.

### Rodziny komponentów

- `Canvas/`
- `ColorPicker/`
- `FillPicker/`
- `FontPicker/`
- `GradientEditor/`
- `LayerTree/`
- `PageList/`
- `PropertyList/`
- `PropertySection/`
- `SegmentedControl/`
- `NumberField/`
- `Toolbar/`

W tych katalogach znajdują się strukturalne komponenty bez narzuconego wyglądu oraz funkcje pomocnicze danego obszaru.

### Controls

W `controls/` znajdują się composables dla paneli właściwości i elementów sterujących edytora:

- `usePosition`
- `useLayout`
- `useAppearance`
- `useColorModel`
- `useTypography`
- `useExport`
- `useFillControls`
- `useStrokeControls`
- `useEffectsControls`
- `useNodeProps`
- `usePropScrub`
- `useEditorPropertyList`

### Variables

`VariablesEditor/` zawiera composables i kod łączący stan edytora zmiennych z Vue.

### Zaznaczenie

`selection/` zawiera stan obliczany na podstawie zaznaczenia oraz informacje o dostępnych operacjach.

### Kontekst

`context/` zawiera klucz i funkcje przekazujące edytor przez mechanizm wstrzykiwania zależności Vue:

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Internal

`internal/` zawiera wspólne funkcje pomocnicze, które nie należą do podstawowych komponentów pakietu.

## Zasady publicznego API

### Używaj composables do obsługi logiki i stanu

Jeśli kod przede wszystkim oblicza stan, zarządza nim lub wywołuje operacje edytora, udostępnij go jako composable.

### Twórz komponenty bez wyglądu tylko wtedy, gdy istotna jest struktura

Komponent główny jest potrzebny, gdy koordynuje strukturę, elementy potomne, slots albo kontekst.

Przykłady:

- `PageListRoot`
- `PropertyListRoot`
- `PropertySectionRoot`
- `SegmentedControlRoot`
- `ToolbarRoot`

### Nie przekazuj całego kontekstu przez jeden slot

Przekazuj do slot tylko potrzebne props albo użyj composable bezpośrednio. Komponenty kontrolowane, takie jak `PropertyListRoot`, emitują zdarzenia opisujące wykonane operacje. Powiązanie z zaznaczeniem i historią cofania powinno znajdować się w adapterze lub composable sterującym, a nie w samym komponencie.

## Odpowiedzialność aplikacji i SDK

### SDK

- integracja z edytorem;
- logika przeznaczona do ponownego użycia, niezależna od wyglądu;
- struktura interfejsu niezależna od wyglądu;
- integracja z renderowaniem obszaru roboczego.

### Aplikacja

- wygląd;
- ogólny układ stron;
- routing;
- otwieranie, zapisywanie i inne operacje na plikach;
- powiadomienia, menu i zachowanie charakterystyczne dla konkretnej aplikacji.

## Prosta zasada

Jeśli kod można bez stylów aplikacji wykorzystać w innym edytorze opartym na OpenPencil, prawdopodobnie powinien znaleźć się w `@open-pencil/vue`.

## Zobacz też

- [Pierwsze kroki z SDK](./getting-started)
- [Dokumentacja API](./api/)
