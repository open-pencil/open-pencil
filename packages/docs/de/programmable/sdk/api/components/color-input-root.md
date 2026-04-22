---
title: ColorInputRoot
description: Headless Farb-Eingabe-Hilfsmittel mit Hex-Parsing und Aktualisierungs-Hilfsmitteln.
---

# ColorInputRoot

`ColorInputRoot` ist ein headless Hilfsmittel für Farb-Eingabe-UIs.

Es leitet einen Hex-Wert aus einer Farbe ab und gibt Aktualisierungs-Hilfsmittel für Hex- und vollständige Farbänderungen zurück.

## Props

<SdkPropsTable
  :rows="[
    { name: 'color', type: 'Color', description: 'Aktueller Farbwert.', required: true },
    { name: 'editable', type: 'boolean | undefined', description: 'Ob der Verbraucher den Wert als bearbeitbar darstellen soll.' }
  ]"
/>

## Ereignisse

<SdkEventsTable
  :rows="[
    { name: 'update', payload: 'color: Color', description: 'Ausgelöst, wenn sich die Farbe ändert.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ color: Color, editable: boolean, hex: string, updateFromHex: (value: string) => void, updateColor: (color: Color) => void }', description: 'Haupt-Farb-Eingabe-Render-Vertrag.' }
  ]"
/>

## Beispiel

```vue
<ColorInputRoot :color="color" @update="color = $event" v-slot="{ hex, updateFromHex }">
  <input :value="hex" @input="updateFromHex(($event.target as HTMLInputElement).value)" />
</ColorInputRoot>
```

## Verwandte APIs

- [ColorPickerRoot](./color-picker-root)
