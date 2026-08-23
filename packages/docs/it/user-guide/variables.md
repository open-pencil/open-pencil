---
title: Variabili
description: Creare variabili, raccolte e modalità e collegarle alle proprietà di design.
---

# Variabili

Le variabili memorizzano valori riutilizzabili, come colori e spaziature. Una proprietà collegata viene aggiornata quando cambia la variabile.

## Aprire l’editor

Quando non è selezionato alcun oggetto, la scheda **Design** mostra le proprietà della pagina. L’icona delle impostazioni nella sezione Variabili apre l’editor.

## Raccolte e modalità

Una raccolta raggruppa variabili correlate. Ogni raccolta può avere più modalità, per esempio Chiaro e Scuro, con un valore diverso per variabile.

- Un clic cambia raccolta.
- Un doppio clic sul nome permette di rinominarla.
- I pulsanti nell’intestazione creano raccolte e modalità.

## Modificare le variabili

La tabella contiene nome, tipo e una colonna per modalità. Fai clic su una cella per modificarla.

Sono supportati colore, numero, testo e booleano. I colori si modificano con un campo e un selettore.

## Collegare riempimenti e contorni

Apri il selettore delle variabili dal controllo colore e scegli una variabile compatibile. Il controllo mostra il collegamento invece di copiare il valore.

Aprire o selezionare il campo non modifica il collegamento. Solo la prima variazione reale può rimuoverlo o modificare direttamente la variabile, in base al controllo.

## Alias

Una variabile può fare riferimento a un’altra. OpenPencil risolve la catena in base alla modalità attiva e rileva i cicli.

## Importazione ed esportazione

Le variabili vengono conservate nell’importazione e nell’esportazione `.fig`. La CLI può anche elencarle e modificarle tramite l’API compatibile con i plugin Figma.
