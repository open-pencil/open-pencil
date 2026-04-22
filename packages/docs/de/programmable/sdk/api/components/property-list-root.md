---
title: PropertyListRoot
description: Headless strukturelles Primitiv für Füllungs-, Kontur- und Effekte-Listen-UIs.
---

# PropertyListRoot

`PropertyListRoot` ist ein headless strukturelles Primitiv für array-basierte Eigenschafts-Editoren.

Es ist gedacht für Eigenschafts-UIs wie:

- Füllungen
- Konturen
- Effekte

Es bietet Slot-Props für:

- aktuelle Elemente
- Mischzustands-Erkennung
- Hinzufügen/Entfernen/Aktualisieren/Patchen-Operationen
- Sichtbarkeitsumschalten pro Element

## Verwendung

```vue
<PropertyListRoot prop-key="fills" v-slot="{ items, add, remove }">
  <div v-for="(fill, index) in items" :key="index">
    <button @click="remove(index)">Entfernen</button>
  </div>
  <button @click="add(defaultFill)">Füllung hinzufügen</button>
</PropertyListRoot>
```

## Verwandte APIs

- [SDK API-Übersicht](../)
