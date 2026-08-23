---
title: Disposizione automatica
description: Flexbox e CSS Grid con direzione, spaziatura, margini interni, allineamento e modalità di dimensionamento.
---

# Disposizione automatica

La disposizione automatica distribuisce gli oggetti figli all’interno di un frame. Supporta Flexbox orizzontale o verticale e Grid con righe, colonne e tracce configurabili.

## Attivare

- Seleziona un frame e premi <kbd>⇧</kbd><kbd>A</kbd>.
- Seleziona più oggetti liberi e usa la stessa scorciatoia per racchiuderli in un nuovo frame.

## Direzione e spaziatura

Gli oggetti possono scorrere in orizzontale, verticale o andare a capo. La spaziatura regola la distanza tra gli oggetti; i margini interni quella dai bordi.

## Allineamento

L’asse principale offre inizio, centro, fine e spazio tra gli elementi. L’asse trasversale offre inizio, centro, fine ed estensione.

## Dimensionamento

- **Fisso:** larghezza o altezza esplicita.
- **Riempi:** occupa lo spazio disponibile.
- **Adatta:** adegua la dimensione al contenuto.

La prima modifica reale di una dimensione rende fisso solo quell’asse. Portare il focus sul campo non cambia la modalità.

## CSS Grid

Grid distribuisce gli oggetti in righe e colonne con dimensioni `fr`, `px` o `auto`. Le spaziature orizzontale e verticale sono indipendenti. Ogni oggetto può definire riga, colonna e numero di celle occupate.

Il risultato può essere esportato in JSX con classi Tailwind.
