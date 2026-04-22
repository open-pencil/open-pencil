---
title: usePropScrub
description: Helper di basso livello per aggiornamenti di proprietà con trascinamento scrub e supporto al commit.
---

# usePropScrub

`usePropScrub(editor)` coordina gli aggiornamenti in tempo reale delle proprietà durante lo scrubbing e salva le modifiche con supporto all'undo quando l'interazione termina.

Usalo quando costruisci controlli numerici che aggiornano direttamente le proprietà dei nodi selezionati tramite scrub.

## API correlate

- [ScrubInputRoot](../components/scrub-input-root)
- [useNodeProps](./use-node-props)
