---
title: useMenuModel
description: Menümodelle für Application und Canvas aus dem aktuellen Editor state erstellen.
---

# useMenuModel

`useMenuModel()` erzeugt renderbereite Menüs aus Editor commands und der aktuellen Selection. Dadurch müssen einzelne Commands nicht für jedes Menü erneut zusammengesetzt werden.

## Verwendung

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Beispiel

```ts
const { canvasMenu } = useMenuModel()
```

`canvasMenu.value` an einen eigenen Context-menu component übergeben.

## Application menu

`appMenu` gruppiert Einträge in:

- Edit;
- View;
- Object;
- Arrange.

## Kontextmenü

`canvasMenu` enthält vom State abhängige Einträge, zum Beispiel Move to page mit den verfügbaren Pages.

## Labels für die Selection

`selectionLabelMenu` liefert die passende Variante:

- Hide oder Show;
- Lock oder Unlock.

## Siehe auch

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
