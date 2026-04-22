---
title: Modifica oggetti vettoriali
description: "Come modificare la geometria di un percorso vettoriale: ancoraggi, maniglie di Bézier, modificatori e azioni dello strumento penna in modalità modifica."
---

# Modifica oggetti vettoriali

La modalità di modifica degli oggetti vettoriali consente di cambiare la **geometria** di una curva: posizione degli ancoraggi, forma dei segmenti e maniglie di Bézier.  
In questa modalità si lavora direttamente sul percorso, non sulle trasformazioni standard dell'oggetto.

## Attivare la modalità

- Seleziona un oggetto vettoriale con lo strumento di selezione.
- **Fai doppio clic sulla curva**.

Questo attiva la modifica della geometria per il vettore selezionato.

## Uscire dalla modalità

- Premi <kbd>Escape</kbd>.
- Oppure passa a un altro contesto di modifica.

## Cosa cambia in questa modalità

- Il riquadro di trasformazione normale è disabilitato per l'oggetto.
- Diventa possibile modificare ancoraggi, segmenti e maniglie.
- Il cursore non passa alla modalità ridimensionamento/rotazione agli angoli del riquadro.

## Azioni di base

### Spostare un ancoraggio

- Trascina un punto di ancoraggio.
- I segmenti collegati e la forma del percorso si aggiornano in anteprima in tempo reale.

### Modificare una maniglia di Bézier

- Trascina una maniglia sull'ancoraggio.
- Per impostazione predefinita, il comportamento segue la composizione corrente delle maniglie dell'ancoraggio.

## Modificatori per il trascinamento delle maniglie

| Azione | Mac | Windows / Linux |
|--------|-----|-----------------|
| Continuo (Uniforme / Continuo) | <kbd>Cmd</kbd> + trascina | <kbd>Ctrl</kbd> + trascina |
| Angolo (maniglie indipendenti) | <kbd>Option</kbd> + trascina | <kbd>Alt</kbd> + trascina |
| Blocco direzione (solo lunghezza) | <kbd>Shift</kbd> + trascina | <kbd>Shift</kbd> + trascina |

### Continuo: <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> + trascina

- La maniglia attiva è vincolata alla stessa linea della maniglia gemella.
- Cambia solo la lunghezza della maniglia attiva.
- Usalo per transizioni fluide senza spezzare la continuità.

### Angolo: <kbd>Option</kbd>/<kbd>Alt</kbd> + trascina

- La maniglia attiva viene modificata in modo indipendente.
- La maniglia gemella rimane ferma.
- Usalo per creare una transizione ad angolo netto.

### Blocco direzione: <kbd>Shift</kbd> + trascina

Per ancoraggi con composizione **Continua** o **Simmetrica**:

- la direzione della maniglia è bloccata al valore **precedente l'inizio del trascinamento corrente**;
- il trascinamento modifica solo la lunghezza della maniglia (o delle maniglie, in base alla composizione).

## Override della curvatura tramite trascinamento di un ancoraggio

Quando si trascina un ancoraggio tenendo premuto <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>, l'editor seleziona la maniglia di destinazione in base alla **direzione di collegamento al segmento** su quell'ancoraggio (non in base alla distanza dal punto vicino più prossimo).  
Funziona anche su ancoraggi di vettori con più rami: una volta determinata, la maniglia di destinazione rimane bloccata per tutta la durata del trascinamento.

## Usare lo strumento penna in modalità modifica

Con lo strumento penna attivo:

- **Fai clic su un segmento** per inserire un nuovo ancoraggio (divisione del segmento).
- **Fai clic sull'estremità di un percorso aperto** per riprendere il disegno da quel punto.
- **Option/Alt + clic su un ancoraggio** per eliminarlo (quando la topologia lo consente).

Per la creazione dei percorsi e il comportamento di chiusura, vedi [Strumento penna](./pen-tool.md).

## Flusso di lavoro pratico

1. Disegna una forma con lo strumento penna.
2. Fai doppio clic sulla curva per entrare in modalità di modifica degli oggetti vettoriali.
3. Sposta gli ancoraggi per rifinire il profilo.
4. Trascina le maniglie:
   - con <kbd>Cmd</kbd>/<kbd>Ctrl</kbd> per transizioni continue e fluide,
   - con <kbd>Option</kbd>/<kbd>Alt</kbd> per modifiche indipendenti,
   - con <kbd>Shift</kbd> per modificare solo la lunghezza.
5. Premi <kbd>Escape</kbd> per uscire.
