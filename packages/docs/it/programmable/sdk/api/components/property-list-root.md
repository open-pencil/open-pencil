---
title: PropertyListRoot
description: Primitiva strutturale headless per UI di lista di riempimenti, tratti ed effetti.
---

# PropertyListRoot

`PropertyListRoot` è una primitiva strutturale headless per editor di proprietà basati su array.

È destinata a UI di proprietà come:

- riempimenti
- tratti
- effetti

Fornisce slot prop per:

- gli elementi correnti
- il rilevamento dello stato misto
- operazioni di aggiunta/rimozione/aggiornamento/patch
- attivazione/disattivazione della visibilità per elemento

## Utilizzo

```vue
<PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
  <div v-for="(fill, index) in items" :key="index">
    <button @click="remove(index)">Rimuovi</button>
  </div>
  <button @click="add(defaultFill)">Aggiungi riempimento</button>
</PropertyListRoot>
```

## API correlate

- [Panoramica API SDK](../)
