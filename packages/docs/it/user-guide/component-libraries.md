---
pageClass: guide
title: Librerie di componenti
description: Pubblica componenti, stili e variabili da un file, usali in altri file e ricevi i loro aggiornamenti.
---

# Librerie di componenti

Una libreria condivide i componenti, gli stili e le variabili di un file con gli altri tuoi file. Ogni volta che pubblichi, salva una nuova versione. I file che usano la libreria scelgono quando adottarla.

## Pubblicare una libreria

1. Apri il file con i componenti che vuoi condividere.
2. Apri **Risorse**, poi fai clic su **Gestire le librerie** accanto al campo di ricerca.
3. Fai clic su **Pubblica libreria**.
4. La prima volta, dai alla libreria un ID e un nome. L’ID non può essere cambiato in seguito.
5. Seleziona le modifiche da pubblicare e, se vuoi, aggiungi una descrizione.
6. Fai clic su **Pubblica libreria**.

<GuideImage name="component-libraries/publish" alt="Pubblica libreria con l’ID acme-ui, il nome Acme UI e il componente Button selezionato" />

Una libreria porta sempre con sé tutti gli stili e tutte le raccolte di variabili del file. Le modifiche che lasci deselezionate aspettano la volta successiva.

## Usare una libreria

1. Apri **Risorse → Gestire le librerie** nel file che ne ha bisogno.
2. Attiva la libreria in **Sfoglia le librerie**.
3. Inserisci i suoi componenti da **Risorse** come inserisci i tuoi.

Un componente porta con sé gli stili e le variabili che usa. Qui non si possono modificare: cambiali nel file della libreria e pubblica di nuovo. Le istanze restano modificabili come tutte le altre.

## Aggiornare a una nuova versione

Apri **Gestire le librerie → Aggiornamenti** per vedere cosa è cambiato. Nel tuo file non cambia nulla finché non scegli tu.

1. Confronta un’istanza prima e dopo l’aggiornamento.
2. Aggiorna l’istanza selezionata, tutte le istanze di quel componente, le istanze di questa pagina o tutte quante.

Le istanze conservano le modifiche che hai fatto, anche sui livelli che la libreria ha rinominato. Perdono solo le modifiche sui livelli che la libreria ha rimosso. Quando la variante di un’istanza non esiste più nella nuova versione, il riepilogo indica a quale variante ripiega. **Annulla** annulla un aggiornamento.

## Dove si trovano le librerie

Le librerie **Locale** restano in questo browser o in questa app. Le librerie **Archiviazione** si trovano nel [bucket compatibile con S3](./cloud-storage) che hai configurato, così anche altre persone possono usarle. Passa dalle une alle altre in cima a **Sfoglia le librerie**.

Le versioni che hai usato vengono conservate sul tuo computer, così i loro componenti restano visibili e si possono inserire anche quando sei offline. Un file conserva le versioni delle librerie che usa quando lo salvi, e si apre allo stesso modo anche quando la libreria non è raggiungibile.
