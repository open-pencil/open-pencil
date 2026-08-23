---
title: GradientEditorRoot
description: Stato e azioni per modificare i punti di una sfumatura.
---

# GradientEditorRoot

`GradientEditorRoot` coordina tipo di sfumatura, punto attivo e modifiche a colore, posizione e opacità.

Riceve un riempimento tramite `fill` ed emette `update` con il nuovo oggetto `Fill`. L’applicazione può comporre `GradientEditorBar` e `GradientEditorStop` nel proprio spazio.

## Vedi anche

- [useGradientStops](../advanced/use-gradient-stops)
