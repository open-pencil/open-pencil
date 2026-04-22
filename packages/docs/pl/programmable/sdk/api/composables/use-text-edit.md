---
title: useTextEdit
description: Zarządzaj edycją tekstu DOM, kompozycją, formatowaniem i synchronizacją dla węzłów tekstowych kanvasu.
---

# useTextEdit

`useTextEdit()` łączy wejście tekstowe DOM z modelem edycji tekstu kanvasu edytora.

Koordynuje:

- wejście tekstowe oparte na textarea
- kompozycję IME
- miganie kursora
- zachowanie Delete/Backspace
- polecenia formatowania jak pogrubienie/kursywa/podkreślenie
- synchronizację zmian tekstu z powrotem do grafu

## Użycie

```ts
useTextEdit(canvasRef, editor)
```

## Podstawowy przykład

Użyj go w komponencie właściciela kanvasu razem z `useCanvas()` i `useCanvasInput()`.

## Przykłady praktyczne

### Obsługa skrótów formatowania

`useTextEdit()` obsługuje już klawiaturowe akcje formatowania jak pogrubienie, kursywa i podkreślenie podczas aktywnej edycji tekstu.

### Synchronizacja kanvasu i edytora tekstu

Aktualizuje tekst grafu i przebiegi stylów gdy użytkownik pisze lub edytuje sformatowane zakresy.

## Uwagi

Jest to kompozyt integracji kanvasu/edytora, a nie ogólny kompozyt pola tekstowego.

## Powiązane API

- [useCanvas](./use-canvas)
- [useCanvasInput](./use-canvas-input)
