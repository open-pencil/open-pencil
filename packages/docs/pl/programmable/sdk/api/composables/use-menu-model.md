---
title: useMenuModel
description: Modele menu aplikacji i obszaru roboczego zależne od aktualnego state edytora.
---

# useMenuModel

`useMenuModel()` tworzy gotowe do wyświetlenia menu na podstawie poleceń edytora i bieżącego selection.

Użyj go, jeśli nie chcesz samodzielnie składać menu z pojedynczych poleceń.

## Użycie

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Przykład

```ts
const { canvasMenu } = useMenuModel()
```

Przekaż `canvasMenu.value` do własnego komponentu menu kontekstowego.

## Menu aplikacji

`appMenu` grupuje pozycje w menu:

- Edit;
- View;
- Object;
- Arrange.

## Menu kontekstowe

`canvasMenu` zawiera pozycje zależne od state, na przykład Move to page z listą dostępnych stron.

## Etykiety zależne od selection

`selectionLabelMenu` zwraca odpowiednią wersję etykiet:

- Hide albo Show;
- Lock albo Unlock.

## Zobacz też

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
