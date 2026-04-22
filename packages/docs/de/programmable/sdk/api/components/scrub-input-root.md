---
title: ScrubInputRoot
description: Headless Wurzel-Primitiv für Ziehen-zum-Scrubben numerische Eingabe.
---

# ScrubInputRoot

`ScrubInputRoot` ist das headless Wurzel-Primitiv für Ziehen-zum-Scrubben numerische Eingabe.

Es verwaltet:

- Mischwertedarstellung
- Bearbeitungs- vs. Scrubbingzustand
- zeigerbetriebenes numerisches Scrubbing
- Commit-Semantik für abgeschlossene Bearbeitungen

## Props

<SdkPropsTable
  :rows="[
    { name: 'modelValue', type: 'number | symbol', description: 'Aktueller numerischer Wert oder Mischzustands-Sentinel.', required: true },
    { name: 'min', type: 'number | undefined', description: 'Minimum erlaubter Wert.', default: '-Infinity' },
    { name: 'max', type: 'number | undefined', description: 'Maximum erlaubter Wert.', default: 'Infinity' },
    { name: 'step', type: 'number | undefined', description: 'Scrub-Schritt-Multiplikator.', default: '1' },
    { name: 'sensitivity', type: 'number | undefined', description: 'Zeiger-Sensitivitäts-Multiplikator.', default: '1' },
    { name: 'placeholder', type: 'string | undefined', description: 'Platzhalter für Mischwerte.', default: 'Mixed' }
  ]"
/>

## Modell

<SdkPropsTable
  :rows="[
    { name: 'v-model:modelValue', type: 'number', description: 'Schreibbares numerisches Modell.', required: true }
  ]"
/>

## Ereignisse

<SdkEventsTable
  :rows="[
    { name: 'update:modelValue', payload: 'value: number', description: 'Ausgelöst während des Scrubbings oder der Bearbeitung.' },
    { name: 'commit', payload: 'value: number, previous: number', description: 'Ausgelöst, wenn eine Bearbeitungsinteraktion abgeschlossen wird.' }
  ]"
/>

## Slots

<SdkSlotsTable
  :rows="[
    { name: 'default', props: '{ modelValue: number | symbol, displayValue: string, isMixed: boolean, editing: boolean, scrubbing: boolean, startScrub: (event: PointerEvent) => void, startEdit: () => void, commitEdit: (event: Event) => void, keydown: (event: KeyboardEvent) => void, placeholder: string }', description: 'Vollständiger Scrub-Eingabe-Render-Vertrag.' }
  ]"
/>

## Beispiel

```vue
<ScrubInputRoot v-model:model-value="value" @commit="commit" v-slot="ctx">
  <div @pointerdown="ctx.startScrub">
    <ScrubInputDisplay />
    <ScrubInputField class="w-16" />
  </div>
</ScrubInputRoot>
```

## Verwandte APIs

- [ScrubInputField](./scrub-input-field)
- [ScrubInputDisplay](./scrub-input-display)
