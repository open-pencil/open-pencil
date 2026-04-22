---
title: useMenuModel
description: App- und Canvas-Menümodelle aus dem aktuellen Editor-Zustand erstellen.
---

# useMenuModel

`useMenuModel()` erstellt übergeordnete Menüstrukturen auf Basis von Editor-Befehlen und Auswahlzustand.

Es ist nützlich, wenn Sie fertig renderbare Menügruppen anstatt manuell zusammengesetzter Befehle möchten.

## Verwendung

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Einfaches Beispiel

```ts
const { canvasMenu } = useMenuModel()
```

Rendern Sie `canvasMenu.value` in Ihre Kontextmenü-Komponente.

## Praktische Beispiele

### App-artiges Hauptmenü

`appMenu` gruppiert Einträge in:

- Bearbeiten
- Ansicht
- Objekt
- Anordnen

### Kontextmenü mit Seitenverschiebungen

`canvasMenu` enthält dynamische Einträge wie „Auf Seite verschieben" basierend auf der aktuellen Auswahl und verfügbaren Seiten.

### Auswahlbeschriftungen

`selectionLabelMenu` gibt kontextsensitive Beschriftungen wie:

- `Ausblenden` / `Einblenden`
- `Sperren` / `Entsperren`

## Verwandte APIs

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
