---
title: Vue SDK
description: Twórz edytory oparte na OpenPencil za pomocą komponentów bez narzuconego wyglądu i composables dla Vue.
---

# Vue SDK

Pakiet `@open-pencil/vue` pozwala korzystać z OpenPencil nie tylko jako z samodzielnej aplikacji do projektowania.

OpenPencil można osadzić w innym produkcie, narzędziu wewnętrznym albo edytorze przeznaczonym do konkretnego zadania. Nie trzeba przy tym korzystać z domyślnego interfejsu aplikacji.

Aplikacja OpenPencil jest tylko jednym z interfejsów zbudowanych za pomocą tego zestawu narzędzi. SDK umożliwia stworzenie własnego.

SDK udostępnia:

- kontekst edytora przekazywany przez dependency injection w Vue;
- renderowanie obszaru roboczego za pomocą CanvasKit;
- composables do obsługi zaznaczenia, poleceń, menu, paneli właściwości i zmiennych;
- strukturalne komponenty bez narzuconego wyglądu, między innymi `PageListRoot`, `PropertyListRoot` i `ToolbarRoot`;
- obsługę lokalizacji menu, paneli i okien dialogowych oraz elementy do wyboru języka.

## Od czego zacząć

<SdkCardGroup>
  <SdkCard title="Pierwsze kroki" to="/programmable/sdk/getting-started" description="Zainstaluj pakiet, utwórz instancję edytora i podłącz podstawowe komponenty." />
  <SdkCard title="Architektura" to="/programmable/sdk/architecture" description="Dowiedz się, jak współpracują composables, komponenty i kontekst edytora." />
  <SdkCard title="Przewodniki" to="/programmable/sdk/guides/custom-editor-shell" description="Twórz własne interfejsy edytora, panele właściwości i panele nawigacyjne." />
  <SdkCard title="Dokumentacja API" to="/programmable/sdk/api/" description="Poznaj komponenty, composables i niskopoziomowe publiczne API." />
</SdkCardGroup>

## Do czego służy SDK

Różne produkty i zespoły potrzebują różnych interfejsów do edycji.

Może to być pełny edytor graficzny, niewielki obszar roboczy osadzony w innej aplikacji, narzędzie wewnętrzne, edytor szablonów albo wyspecjalizowany interfejs wspomagany przez AI.

## Zasady projektowe

- **Bez narzuconego wyglądu:** SDK zapewnia logikę i strukturę, ale nie określa wyglądu aplikacji.
- **Composable zamiast zbędnego wrappera:** jeśli nie trzeba koordynować struktury interfejsu, wystarczy composable.
- **Przemyślane publiczne API:** stabilne funkcje są eksportowane z `packages/vue/src/index.ts`.
- **Pełna integracja z Vue:** SDK łączy Vue z możliwościami `@open-pencil/core`.

## Dwie warstwy API

SDK składa się z dwóch głównych warstw:

1. **Composables** udostępniają stan edytora i operacje na nim.
2. **Komponenty** definiują istotną strukturę interfejsu.

Jeśli potrzebujesz tylko stanu edytora i operacji, zacznij od composables. Jeśli tworzysz elementy interfejsu edytora przeznaczone do ponownego użycia, zacznij od komponentów.

## Sekcje API

- [Komponenty](/programmable/sdk/api/components/)
- [Composables](/programmable/sdk/api/composables/)
- [Niskopoziomowe API](/programmable/sdk/api/advanced/)
