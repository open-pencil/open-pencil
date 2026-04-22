---
title: useMenuModel
description: Costruisci modelli di menu per app e canvas dallo stato corrente dell'editor.
---

# useMenuModel

`useMenuModel()` costruisce strutture di menu di livello superiore sopra i comandi dell'editor e lo stato della selezione.

È utile quando vuoi gruppi di menu pronti per il rendering invece di comporre i comandi manualmente.

## Utilizzo

```ts
import { useMenuModel } from '@open-pencil/vue'

const { appMenu, canvasMenu, selectionLabelMenu } = useMenuModel()
```

## Esempio base

```ts
const { canvasMenu } = useMenuModel()
```

Renderizza `canvasMenu.value` nel tuo componente menu contestuale.

## Esempi pratici

### Menu principale in stile app

`appMenu` raggruppa le voci in:

- Modifica
- Visualizza
- Oggetto
- Disponi

### Menu contestuale con spostamento tra pagine

`canvasMenu` include voci dinamiche come "Sposta alla pagina" in base alla selezione corrente e alle pagine disponibili.

### Etichette di selezione

`selectionLabelMenu` espone etichette contestuali come:

- `Nascondi` / `Mostra`
- `Blocca` / `Sblocca`

## API correlate

- [useEditorCommands](./use-editor-commands)
- [useSelectionState](./use-selection-state)
- [useSelectionCapabilities](./use-selection-capabilities)
