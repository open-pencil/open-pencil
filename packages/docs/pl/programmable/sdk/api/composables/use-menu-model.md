---
title: useMenuModel
description: Buduj modele menu aplikacji i kanvasu na podstawie bieżącego stanu edytora.
---

# useMenuModel

`useMenuModel()` buduje wyższopoziomowe struktury menu na bazie poleceń edytora i stanu selekcji.

Przydatny, gdy chcesz gotowe do renderowania grupy menu zamiast ręcznego komponowania poleceń.

## Użycie

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Podstawowy przykład

```ts
const { canvasMenu } = useMenuModel()
```

Renderuj `canvasMenu.value` do swojego komponentu menu kontekstowego.

## Przykłady praktyczne

### Menu górne w stylu aplikacji

`appMenu` grupuje wpisy w:

- Edycja
- Widok
- Obiekt
- Ułóż

### Menu kontekstowe z przenoszeniem stron

`canvasMenu` zawiera dynamiczne elementy jak "Przenieś na stronę" na podstawie bieżącej selekcji i dostępnych stron.

### Etykiety selekcji

`selectionLabelMenu` udostępnia kontekstowe etykiety jak:

- `Ukryj` / `Pokaż`
- `Zablokuj` / `Odblokuj`

## Powiązane API

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
