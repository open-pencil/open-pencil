---
title: Auto-layout
description: Layout flex e griglia in Inkly — direzione, spaziatura, padding, allineamento, dimensionamento e track CSS Grid.
---
# Auto-layout

L'auto-layout posiziona i figli automaticamente all'interno di un frame. Supporta due modalità: **flex** (flusso orizzontale/verticale) e **griglia** (righe e colonne con dimensionamento dei track).

<kbd>⇧</kbd><kbd>A</kbd> per attivare/disattivare o avvolgere la selezione in un frame auto-layout.

## Direzione
- **Orizzontale** — da sinistra a destra
- **Verticale** — dall'alto in basso
- **A capo** — va a capo quando lo spazio finisce

## Spaziatura
**Gap** tra figli adiacenti. **Padding** tra bordo del frame e figli (uniforme o per lato).

## Allineamento
- **Asse principale (Justify):** inizio, centro, fine, spazio tra
- **Asse trasversale (Align):** inizio, centro, fine, estendi

## Dimensionamento figli
- **Fisso** — larghezza/altezza esplicita
- **Riempi** — si estende nello spazio disponibile
- **Adatta** — si restringe al contenuto

## Riordino per trascinamento
Trascina un figlio per riordinarlo, con indicatore visuale di inserimento.

## CSS Grid

Il layout a griglia organizza i figli in righe e colonne con dimensionamento esplicito dei track.

### Attivare la griglia

Seleziona un frame con auto-layout attivo e clicca sull'icona griglia nella barra degli strumenti layout per passare da flex a griglia.

### Dimensionamento dei track

Definisci track di colonne e righe con tre modalità:

- **fr** — unità frazionaria, divide lo spazio disponibile proporzionalmente
- **px** — dimensione fissa in pixel
- **auto** — si adatta al contenuto

### Spaziatura della griglia

Imposta gap orizzontali (colonne) e verticali (righe) separati tra le celle.

### Posizionamento dei figli

I figli vengono posizionati nelle celle della griglia automaticamente in ordine di riga. Puoi sovrascrivere il posizionamento con valori di inizio colonna/riga e span nelle proprietà layout del figlio.

### Esportazione JSX e Tailwind

I layout a griglia vengono esportati come JSX con classi Tailwind: `grid grid-cols-3`, `gap-x-4 gap-y-2`, `col-start-2 row-span-2`.
