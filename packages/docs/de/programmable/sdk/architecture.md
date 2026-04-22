---
title: SDK-Architektur
description: Ordnerstruktur, öffentliche API-Grenzen und Kompositionsmuster in @open-pencil/vue.
---

# SDK-Architektur

`@open-pencil/vue` ist die Vue-seitige Schicht über `@open-pencil/core`.

Das Paket besitzt das Editor-Modell selbst nicht. Es passt den Kern-Editor an in:

- Vue-Injection
- reaktive Composables
- headless strukturelle Primitive
- Canvas- und Input-Verdrahtung

## Ordnerstruktur

Dieses Paket ist nach Domänen organisiert.

### Komponentenfamilien

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

Diese enthalten strukturelle/headless Primitive und lokale Hilfsmittel.

### Steuerelemente

`controls/` enthält Composables für Eigenschafts-Panels und Editor-Steuerelemente:

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

### Variablen

`VariablesEditor/` enthält Composables und Zustandsverdrahtung für die Variablen-Domäne.

### Auswahl

`selection/` enthält auswahlabgeleiteten Editor-Zustand und Fähigkeiten.

### Kontext

`context/` enthält Editor-Injektions-Hilfsmittel:

- `EDITOR_KEY`
- `provideEditor`
- `useEditor`

### Intern

`internal/` enthält übergreifende Utilities, die nicht als primäre headless Primitive gedacht sind.

## Philosophie der öffentlichen API

### Composables bevorzugen

Wenn es hauptsächlich um Kontrolllogik, Zustandsableitung oder Editor-Aktionen geht, sollte ein Composable verwendet werden.

### Headless Primitive für bedeutungsvolle Struktur

Komponentenwurzeln verwenden, wenn sie Struktur, Kinder, Slots oder Kontext koordinieren.

Beispiele:

- `PageListRoot`
- `PropertyListRoot`
- `ToolbarRoot`

### Breite Kontext-Dump-Slots vermeiden

Fokussierte Slot-Props oder direkte Composable-Verwendung gegenüber großen `v-slot="ctx"`-Payloads bevorzugen.

## Verantwortlichkeit App vs. SDK

### SDK übernimmt

- Editor-Integration
- wiederverwendbare headless Logik
- wiederverwendbare UI-Struktur ohne Styling-Annahmen
- Canvas-Rendering-Integration

### App übernimmt

- Styling
- Layout-Shells
- Routing
- Produkt-Datei-Flows
- Toasts, Menüs und app-spezifische UX

## Praktische Faustregel

Wenn ein Stück Logik in einer anderen OpenPencil-basierten App wiederverwendet werden könnte, ohne App-Styling mitzubringen, gehört es wahrscheinlich in `@open-pencil/vue`.

## Verwandte Seiten

- [SDK – Erste Schritte](./getting-started)
- [API-Referenz](./api/)
