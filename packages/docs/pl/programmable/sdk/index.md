---
title: Vue SDK
description: Buduj edytory oparte na OpenPencil z bezstanowymi kompozytami i prymitywami Vue.
---

# Vue SDK

`@open-pencil/vue` istnieje po to, by OpenPencil mógł być czymś więcej niż samodzielną aplikacją do projektowania.

Celem jest uczynienie OpenPencil zestawem narzędzi, który można wbudować w inne produkty, narzędzia wewnętrzne i edytory dopasowane do konkretnych przepływów pracy — a nie tylko jednym domyślnym interfejsem.

Aplikacja OpenPencil jest jedną z kompozycji tego zestawu. SDK to sposób na zbudowanie innej.

Udostępnia:

- wstrzykiwany kontekst edytora
- renderowanie canvasu oparte na CanvasKit
- kompozyty selekcji, poleceń, menu, panelu właściwości i zmiennych
- bezstanowe prymitywy strukturalne jak `PageListRoot`, `PropertyListRoot` i `ToolbarRoot`
- wbudowane prymitywy i18n dla menu, paneli, okien dialogowych i niestandardowych selektorów języka

## Zacznij tutaj

<SdkCardGroup>
  <SdkCard title="Pierwsze kroki" to="/programmable/sdk/getting-started" description="Zainstaluj pakiet, utwórz instancję edytora i zamontuj podstawowe prymitywy." />
  <SdkCard title="Architektura" to="/programmable/sdk/architecture" description="Zobacz jak kompozyty, prymitywy i kontekst edytora współpracują ze sobą." />
  <SdkCard title="Przewodniki" to="/programmable/sdk/guides/custom-editor-shell" description="Buduj własne powłoki edytora, panele właściwości i panele nawigacyjne." />
  <SdkCard title="Dokumentacja API" to="/programmable/sdk/api/" description="Przeglądaj komponenty, kompozyty i zaawansowane publiczne API." />
</SdkCardGroup>

## Dlaczego SDK istnieje

Różne produkty i zespoły potrzebują różnych powierzchni edycji.

Czasem chcesz pełny edytor projektowania. Czasem chcesz skupiony kanvas wewnątrz innej aplikacji. Czasem potrzebujesz wewnętrznego narzędzia do przepływu pracy, edytora szablonów lub powierzchni edycji wspomaganej AI zbudowanej wokół wąskiego przypadku użycia.

SDK to warstwa, która to umożliwia.

## Zasady projektowania

- **Headless na pierwszym miejscu**: logika i struktura, bez stylowania aplikacji
- **Kompozyty zamiast opakowań**: używaj kompozytów, gdy nie ma znaczącej koordynacji strukturalnej
- **Przemyślane publiczne API**: stabilne eksporty z `packages/vue/src/index.ts`
- **Świadomość frameworka**: integracja Vue nad `@open-pencil/core`

## Jak myśleć o pakiecie

SDK ma dwie główne warstwy:

1. **Kompozyty** dla stanu edytora i akcji
2. **Prymitywy** dla znaczącej struktury UI

Jeśli potrzebujesz tylko stanu edytora i akcji, zacznij od kompozytów.
Jeśli budujesz wielokrotnie używalne bloki budulcowe UI edytora, zacznij od prymitywów.

## Sekcje API

- [Komponenty](/programmable/sdk/api/components/)
- [Kompozyty](/programmable/sdk/api/composables/)
- [Zaawansowane](/programmable/sdk/api/advanced/)
