---
title: Variabili
description: Creare variabili, raccolte e modalità e collegarle alle proprietà di design.
---

# Variabili

Le variabili memorizzano token di design riutilizzabili, come colori, spaziature e altre proprietà, che possono essere collegati agli oggetti. Quando cambia il valore di una variabile, si aggiornano tutti gli oggetti che la usano.

## Aprire la finestra delle variabili

Quando non è selezionato alcun oggetto, la scheda **Design** mostra le proprietà della pagina, tra cui una sezione Variabili con il numero di raccolte e variabili. L’icona delle impostazioni apre la finestra.

La finestra elenca a sinistra le variabili della raccolta attiva, modifica a destra la variabile selezionata o la raccolta e mostra sotto il foglio di stile che producono. In una finestra stretta o su telefono mostra una modalità alla volta, e una variabile, le impostazioni della raccolta o il foglio di stile si aprono sopra l’elenco con un pulsante per tornare indietro.

## Raccolte

Le variabili sono organizzate in raccolte, mostrate come schede (un menu sugli schermi stretti).

- **Cambiare raccolta:** fai clic su una scheda
- **Creare una raccolta:** fai clic sul pulsante a forma di cartella nella barra degli strumenti (**Crea raccolta**)
- **Rinominare o eliminare:** senza alcuna variabile selezionata, la parte destra modifica la raccolta: cambia il nome o eliminala (**Elimina raccolta**)

## Modalità

Ogni raccolta può avere più modalità (per esempio Chiaro e Scuro). Le modalità compaiono come colonne di valori nell’elenco, e una variabile ha un valore per ciascuna modalità. Si gestiscono nelle **Impostazioni della raccolta**:

- **Aggiungere una modalità:** fai clic su **+** accanto a **Modalità**
- **Rinominare:** modifica il nome della modalità
- **Duplicare, impostare come predefinita, eliminare:** usa il menu **⋯** accanto alla modalità (**Duplica modalità**, **Imposta come predefinita**, **Elimina modalità**)
- **Condizione:** il selettore CSS o la query `@media`, `@supports` o `@container` che attiva la modalità nel foglio di stile. Se è vuota, è un attributo che prende il nome dalla raccolta e dalla modalità, come `[data-theme="dark"]` per la modalità Scuro di una raccolta Theme. La modalità predefinita va sempre in `:root`.

## Gestire le variabili

Le variabili sono raggruppate in base alle cartelle nei loro nomi (`Brand/Primary` compare come *Primary* sotto *Brand*), con il nome CSS e un valore per modalità.

- **Creare una variabile:** fai clic su **+** nella barra degli strumenti e scegli un tipo; la nuova variabile si apre per la modifica
- **Selezionare:** fai clic su una riga, oppure spostati con le frecce e premi Invio
- **Cercare:** digita nella barra di ricerca per filtrare le variabili per nome
- **Eliminare:** fai clic su **Elimina variabile** in fondo alle sue impostazioni

La selezione di una variabile permette di modificare:

- **Nome** e **Nome CSS:** lascia vuoto il nome CSS per ricavarlo da nome e ambiti, ad esempio `--color-brand-primary`
- **Unità:** per i numeri, `px`, `rem`, `%`, `ms`, `s`, `deg` o nessuna; i valori si inseriscono in quell’unità
- **Valori:** uno per modalità; un colore apre il selettore colore, e un alias mostra la variabile a cui punta
- **Espressione CSS:** per i numeri, un valore come `clamp(1rem, 4vw, 1.5rem)` scritto in CSS al posto del numero, mentre il canvas continua a disegnare il numero
- **Ambiti:** per quali proprietà viene proposta la variabile
- **Descrizione**

## Foglio di stile

La parte inferiore della finestra mostra la raccolta attiva come proprietà personalizzate CSS o come tema Tailwind v4. Il pulsante di copia (**Copia tutte le variabili come CSS**) copia le variabili dell’intero documento in quel formato, così gli alias verso altre raccolte vengono risolti.

## Collegare le variabili ai riempimenti

Nella sezione Riempimento del pannello delle proprietà, usa il selettore delle variabili per collegare una variabile colore al riempimento di un oggetto.

- **Collegare:** scegli una variabile colore dal selettore. Il riempimento mostra un’etichetta viola con il nome della variabile.
- **Scollegare:** fai clic sul pulsante di scollegamento sull’etichetta per rimuovere il collegamento. Il riempimento torna al valore di colore risolto.

Quando il valore della variabile cambia (o si cambia modalità), tutti i riempimenti collegati si aggiornano automaticamente.

## Suggerimenti

- Usa le raccolte per raggruppare token correlati (per esempio `Primitives` per i colori di base, `Semantic` per gli alias basati sul ruolo e `Spacing` per i valori di layout).
- Le modalità sono utili per cambiare tema: definisci i valori Chiaro e Scuro nella stessa raccolta.
- Le variabili supportano gli alias: una raccolta `Semantic` può fare riferimento a valori di una raccolta `Primitives`.
- Consulta [Disegnare forme](./drawing-shapes) per capire come funzionano i riempimenti e il selettore colore.
