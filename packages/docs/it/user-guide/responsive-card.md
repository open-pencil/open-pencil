---
pageClass: guide
title: Creare una scheda adattiva
description: "Un primo progetto in OpenPencil, passo dopo passo: una scheda prodotto il cui testo va a capo e la cui altezza segue il contenuto a qualsiasi larghezza."
---

# Creare una scheda adattiva

In questo progetto crei una scheda prodotto che si adatta: rendila più stretta o più larga, e la foto si allunga, il testo va a capo e l’altezza segue. Ci vogliono circa dieci minuti e usa gli strumenti che userai più spesso.

<GuidePair>

<GuideImage name="responsive-card/narrow" alt="La scheda finita larga 240, con la descrizione su tre righe" caption="Larga 240" />
<GuideImage name="responsive-card/wide" alt="La stessa scheda larga 420, con la descrizione su due righe" caption="Larga 420" />

</GuidePair>

## 1. Aggiungere le parti

Inizia con un nuovo file: **File → Nuovo design**, oppure <Keys mac="⌘ N" other="Ctrl N" />.

1. Premi <Keys mac="R" other="R" /> e trascina un rettangolo largo circa 280 e alto 160. Conterrà la foto.
2. Premi <Keys mac="T" other="T" />, fai clic sotto il rettangolo e scrivi il nome: *Ceramic mug*. Premi <Keys mac="Esc" other="Esc" />.
3. Aggiungi allo stesso modo altri due testi sotto: una descrizione, come *Hand-thrown in small batches, and keeps your coffee warm for longer*, e *Add to cart*.

Tieni le quattro parti in colonna, con i bordi sinistri più o meno allineati.

<GuideImage name="responsive-card/parts" alt="Un rettangolo e tre testi in una colonna approssimativa sulla tela" />

## 2. Metterle in una scheda

1. Premi <Keys mac="⌘ A" other="Ctrl A" /> per selezionare tutte e quattro le parti.
2. Premi <Keys mac="⇧ A" other="Shift A" />. Finiscono in una nuova cornice con [auto-layout](./auto-layout), che le dispone una dopo l’altra.
3. Nel pannello Design, in **Flusso**, scegli il pulsante della colonna, **Layout verticale**, se le parti sono finite in una riga.
4. Imposta lo spazio tra le parti su **12** e la spaziatura interna su **20**.
5. Fai clic su **+** accanto a **Riempimento** per dare uno sfondo alla scheda, e imposta **Raggio** su **16**.
6. Fai doppio clic sul nome della cornice nell’elenco dei livelli e chiamala *Card*.

## 3. Far allungare le parti

1. Imposta la **W** della scheda su **320**.
2. Seleziona il rettangolo. Apri il menu nel suo campo **W** e scegli **Riempi**: prende la larghezza della scheda, all’interno della spaziatura interna.
3. Fai lo stesso per il nome e la descrizione. La descrizione va a capo su nuove righe invece di oltrepassare il bordo della scheda.

L’altezza della scheda segue da sola il contenuto. Ora prova: trascina il bordo destro della scheda, o scrivi un’altra **W**. La foto si allunga, la descrizione va a capo e la scheda si allarga o si restringe per adattarsi.

## 4. Creare un pulsante

1. Seleziona *Add to cart* e premi <Keys mac="⇧ A" other="Shift A" />. Il testo finisce in una cornice tutta sua.
2. Dai a quella cornice un riempimento blu, una spaziatura interna di **16** in orizzontale e **10** in verticale, e un **Raggio** di **10**. Rendi il testo bianco.
3. Premi <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" /> per trasformare il pulsante in un [componente](./components), così puoi riutilizzarlo.

## 5. Aggiungere una foto

1. Seleziona il rettangolo e fai clic sul quadratino del colore sotto **Riempimento**.
2. Fai clic sul pulsante dell’immagine in cima al selettore, poi su **Choose image** per usare un’immagine dal tuo computer, o su **Foto stock** per [trovarne una](./photos).

La foto riempie il rettangolo a qualsiasi larghezza.

## 6. Verificarla e condividerla

- Apri la scheda **Verifica** per [controllare la scheda](./checking-designs) alla ricerca di problemi, come un testo difficile da leggere.
- [Esportala](./exporting) come PNG, oppure fai clic destro e scegli **Copia/Incolla come → Copia come PNG** per incollarla in una chat.
- Chiedi all’[IA](./ai-chat) una variante: *"Crea una versione scura di questa scheda."*

## Dove andare dopo

- [Auto-layout](./auto-layout): righe, griglie, a capo e gli altri modi in cui i livelli si ridimensionano.
- [Componenti](./components): varianti, proprietà e istanze.
- [Variabili](./variables): colori e dimensioni da impostare una volta sola, con modalità scura e chiara.
