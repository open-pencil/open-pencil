---
title: FillPickerRoot
description: Headless popover-basiertes Füllungsauswahl-Primitiv.
---

# FillPickerRoot

`FillPickerRoot` ist ein headless popover-basiertes Füllungsauswahl-Primitiv für einfarbige, Verlaufs- und Bildfüllungen.

## Props

<SdkPropsTable
  :rows="[
    { name: 'fill', type: 'Fill', description: 'Aktueller Füllungswert.', required: true },
    { name: 'contentClass', type: 'string | undefined', description: 'Optionale Klasse für den Popover-Inhalt.' },
    { name: 'swatchClass', type: 'string | undefined', description: 'Optionale Klasse für die Standard-Trigger-Schaltfläche.' }
  ]"
/>

## Ereignisse

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'fill: Fill', description: 'Ausgelöst, wenn sich die Füllung ändert.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'trigger', props: 'Farbmuster-Stil', description: 'Benutzerdefinierter Trigger mit Farbmuster-Hintergrundstil.' },
    { name: 'default', props: 'Füllungszustand + Konvertierungs-Hilfsmittel', description: 'Haupt-Füllungs-Editor-Inhalt.' }
  ]"
/>

### Trigger-Slot-Props

```ts
{
  style: Record<string, string>
}
```

### Standard-Slot-Props

```ts
{
  fill: Fill
  category: 'SOLID' | 'GRADIENT' | 'IMAGE'
  toSolid: () => void
  toGradient: () => void
  toImage: () => void
  update: (fill: Fill) => void
}
```

## Beispiel

```vue
<FillPickerRoot :fill="fill" @update="fill = $event">
  <template #default="{ fill, category, toSolid, toGradient, update }">
    <div>{{ category }}</div>
    <button @click="toSolid">Einfarbig</button>
    <button @click="toGradient">Verlauf</button>
    <MyFillEditor :fill="fill" @change="update" />
  </template>
</FillPickerRoot>
```

## Verwandte APIs

- [GradientEditorRoot](./gradient-editor-root)
