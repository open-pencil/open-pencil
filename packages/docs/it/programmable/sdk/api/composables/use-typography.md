---
title: useTypography
description: Leggere e modificare font, dimensione, spaziatura e allineamento del testo.
---

# useTypography

`useTypography()` fornisce famiglia, stile, dimensione, interlinea, spaziatura tra lettere, allineamento, formattazione e valori misti.

Durante la modifica del testo, i cambiamenti possono applicarsi solo all’intervallo selezionato.

### Impostare gli assi dei font variabili

`axes` elenca gli assi del font variabile del testo selezionato, ciascuno con `tag`, `name`, intervallo e il `value` a cui è disegnato (`MIXED` se i livelli differiscono); è vuoto per un font statico o per livelli di famiglie diverse. `previewAxis` mostra un valore durante il trascinamento, `setAxis` lo imposta in un solo passo di annullamento e `setOpticalSizeAuto` fa seguire alla dimensione ottica la dimensione del font o la blocca. Cambiare peso, inclinazione o famiglia riporta gli assi a quelli dello stile.

```ts
typography.setAxis('wght', 560)
typography.setOpticalSizeAuto(false)
```

## Vedi anche

- [TypographyControlsRoot](../components/typography-controls-root)
- [useFontPicker](../advanced/use-font-picker)
- [Modificare testo](/user-guide/text-editing)
