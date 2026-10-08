---
title: Variabili
description: Creare variabili, raccolte e modalità e collegarle alle proprietà di design.
---

# Variabili

Le variabili memorizzano token di design riutilizzabili, come colori, spaziature e altre proprietà, che possono essere collegati agli oggetti. Quando cambia il valore di una variabile, si aggiornano tutti gli oggetti che la usano.

## Aprire la finestra delle variabili

Aprila da **Visualizza → Variabili…**, cercando «Variabili» nella palette dei comandi oppure, quando non è selezionato alcun oggetto, dalla sezione Variabili della scheda **Design**. **Espandi**, nell’angolo della finestra, le dà gran parte dello spazio disponibile.

La finestra elenca a sinistra le variabili della raccolta attiva, modifica a destra la variabile selezionata o la raccolta e mostra sotto il foglio di stile che producono. In una finestra stretta o su telefono mostra una modalità alla volta, e una variabile, le impostazioni della raccolta o il foglio di stile si aprono sopra l’elenco con un pulsante per tornare indietro.

## Raccolte

Le variabili sono organizzate in raccolte. In una finestra larga sono elencate in una barra laterale con il numero di variabili di ciascuna; più stretta, diventano schede, oppure un menu su telefono.

- **Cambiare raccolta:** fai clic su di essa nella barra laterale o sulla sua scheda
- **Creare una raccolta:** fai clic su **+** accanto a **Raccolte**, oppure sul pulsante a forma di cartella nella barra degli strumenti (**Crea raccolta**)
- **Rinominare o eliminare:** senza alcuna variabile selezionata, la parte destra modifica la raccolta: cambia il nome, oppure eliminala dal menu **⋯** accanto al nome (**Elimina raccolta**)
- **Attributo di attivazione:** l’attributo che attiva le modalità attivate manualmente, `data-theme` per impostazione predefinita per una raccolta chiamata Theme; scrivi un altro nome, come `data-color-scheme`, per adattarlo a un codice esistente

## Modalità

Ogni raccolta può avere più modalità (per esempio Chiaro e Scuro). Le modalità compaiono come colonne di valori nell’elenco, e una variabile ha un valore per ciascuna modalità. Si gestiscono nelle **Impostazioni della raccolta**:

- **Aggiungere una modalità:** fai clic su **+** accanto a **Modalità**
- **Rinominare:** modifica il nome della modalità
- **Duplicare, impostare come predefinita, eliminare:** usa il menu **⋯** accanto alla modalità (**Duplica modalità**, **Imposta come predefinita**, **Elimina modalità**)

La modalità predefinita è **Sempre attivo** e va in `:root`. Ogni altra modalità ha **Si applica quando**, che indica quando la modalità subentra nel foglio di stile esportato; il CSS che scrive è mostrato sotto:

| Si applica quando | CSS |
| --- | --- |
| **viene attivata manualmente** | l’attributo di attivazione della raccolta con la modalità come valore, come `[data-theme="dark"]` per la modalità Scuro di una raccolta Theme |
| **il sistema è in modalità scura** / **il sistema è in modalità chiara** | `@media (prefers-color-scheme: dark)` / `light` |
| **il contrasto elevato è attivo** | `@media (prefers-contrast: more)` |
| **la riduzione del movimento è attiva** | `@media (prefers-reduced-motion: reduce)` |
| **lo schermo è più stretto di** / **lo schermo è più largo di** una larghezza | `@media (max-width: 640px)` / `min-width` |
| **il contenitore è più stretto di** / **il contenitore è più largo di** una larghezza | `@container (max-width: 640px)` / `min-width` |
| **CSS personalizzato** | qualsiasi selettore, oppure una query `@media`, `@supports` o `@container` |

Sulla tela, un livello mostra una modalità quando lo imposti su di essa, qualunque sia la condizione. Nel codice esportato, una modalità attivata manualmente si attiva aggiungendo il suo attributo a un elemento, quindi i livelli impostati su di essa vengono esportati con quell’attributo. I livelli impostati su una modalità con qualsiasi altra condizione, selettori personalizzati compresi, vengono esportati con valori letterali invece dei token, perché è il foglio di stile, non il livello, a decidere quando quella modalità si applica.

## Gestire le variabili

Le variabili sono raggruppate in base alle cartelle nei loro nomi (`Brand/Primary` compare come *Primary* sotto *Brand*), con il nome CSS e un valore per modalità.

- **Creare una variabile:** fai clic su **Crea variabile** (o su **+**) e scegli un tipo; la nuova variabile si apre per la modifica
- **Selezionare:** fai clic su una riga, oppure spostati con le frecce e premi Invio. Maiusc-clic seleziona un intervallo, e Cmd-clic (Ctrl-clic su Windows e Linux) aggiunge o rimuove una riga
- **Filtrare:** digita nella barra di ricerca per filtrare per nome, nome CSS, descrizione o valore, come `--color-brand`, un colore esadecimale o la variabile a cui punta un alias, tollerando gli errori di battitura come la tavolozza dei comandi; fai clic su un gruppo nella barra laterale per mostrare solo quel gruppo e quelli al suo interno, oppure usa il pulsante del filtro (**Filtra per tipo**) per mostrare solo alcuni tipi
- **Rinominare o modificare sul posto:** fai doppio clic su un nome, o su un valore numerico o di testo, nell’elenco
- **Clic destro:** rinomina, duplica (**Duplica**), sposta in un gruppo o in uno nuovo (**Sposta nel gruppo**, **Nuovo gruppo…**) oppure elimina (**Elimina variabili**) le variabili selezionate; anche Delete o Backspace le elimina
- **Riordinare:** trascina una riga; l’ordine viene conservato nel file
- **Più selezionate:** la parte destra le sposta in un gruppo, le duplica o le elimina
- **Annulla e ripeti:** Cmd+Z e Cmd+Maiusc+Z o Cmd+Y (Ctrl su Windows e Linux) funzionano nella finestra come sulla tela, un passaggio per modifica. Invio conferma un campo e torna all’elenco; finché un campo contiene testo non confermato, Cmd+Z annulla la digitazione

La selezione di una variabile permette di modificare:

- **Nome** e **Nome CSS:** lascia vuoto il nome CSS per ricavarlo da nome e ambiti, ad esempio `--color-brand-primary`. Digita il nome senza `--`; un nome che CSS non può usare viene segnalato e non viene salvato
- **Unità:** per i numeri, `px`, `rem`, `%`, `ms`, `s`, `deg` o nessuna; i valori si inseriscono in quell’unità
- **Valore** o **Valori:** uno per modalità; un colore apre il selettore colore. Il pulsante della variabile (**Usa una variabile**) accanto a un valore lo fa puntare a un’altra variabile dello stesso tipo, un alias che segue quella variabile; **Scollega variabile** lo riporta al valore che mostrava
- **Espressione CSS:** per i numeri, un valore come `clamp(1rem, 4vw, 1.5rem)` scritto in CSS al posto del numero, mentre il canvas continua a disegnare il numero
- **Ambiti:** per quali proprietà viene proposta la variabile
- **Descrizione**
- **Nascondi dalla pubblicazione:** i file che usano questo come libreria non vedono la variabile

## Foglio di stile

La parte inferiore della finestra mostra la raccolta attiva come proprietà personalizzate CSS. Il pulsante di copia (**Copia tutte le variabili come CSS**) copia le variabili dell’intero documento come CSS o come tema Tailwind v4 (**Copia tutte le variabili come tema Tailwind**), così gli alias verso altre raccolte vengono risolti.

## Importare ed esportare design token

Variabili e stili passano tra OpenPencil, Figma e il codice come [design token W3C](https://www.designtokens.org/):

- **Esportare:** nel menu di copia del foglio di stile scegli **Esporta come design token**. Lo zip contiene un file per ogni modalità di raccolta, che Figma importa come modalità; gli stili di testo ed effetto come token di tipografia e ombra; e un resolver che li combina per strumenti come Style Dictionary
- **Importare:** fai clic su **Importa design token** nella barra degli strumenti e scegli file di token o uno zip. Funzionano i file di Figma, un resolver con i file che nomina e i temi di Tokens Studio
- **Scegliere la destinazione:** prima che cambi qualcosa, la finestra mostra ogni raccolta e modalità trovata e dove va: in una nuova raccolta o modalità, in una esistente o da nessuna parte. Variabili e stili con lo stesso nome vengono aggiornati e il resto viene aggiunto; nulla viene eliminato. Conta cosa verrà aggiunto, aggiornato e saltato, e spiega perché ogni token saltato è stato escluso
- L’importazione è un solo passaggio: **Annulla** la ritira tutta

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
