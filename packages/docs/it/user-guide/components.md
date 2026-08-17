---
title: Componenti
description: Componenti riutilizzabili, istanze, override e sincronizzazione live in OpenPencil.
---
# Componenti

I componenti sono elementi di design riutilizzabili. Le modifiche al componente principale aggiornano automaticamente le istanze.

## Esplorare i componenti

Apri la scheda **Assets** nel pannello sinistro per esplorare componenti locali e librerie abilitate. Cerca per nome, passa tra griglia ed elenco e inserisci con un clic, <kbd>Invio</kbd> o trascinamento. Le revisioni scaricate restano disponibili offline.

## Creare un componente
<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> (<kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd>) — converte la selezione in un componente riutilizzabile. I componenti mostrano un'etichetta viola con icona a diamante.

## Set di componenti e varianti
<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> — combina 2+ componenti in un set con bordo tratteggiato viola.

Le varianti supportano più dimensioni, ad esempio `Dimensione=Piccola`, `Stato=Hover` e `Tema=Scuro`, senza richiedere tutte le combinazioni. La variante in alto a sinistra è predefinita e viene usata come fallback quando un aggiornamento non contiene più una corrispondenza esatta. Nel pannello delle proprietà puoi aggiungere, rinominare, riordinare e rimuovere dimensioni e valori; le combinazioni duplicate vengono rifiutate.

## Proprietà dei componenti

I componenti supportano proprietà di testo, visibilità booleana e scambio di istanza. Collega una proprietà a un campo discendente, quindi modifica il valore di un'istanza senza separarla. Definizioni e assegnazioni vengono conservate nei file `.fig`.

## Librerie di componenti

Una libreria pubblica componenti come revisione immutabile. Apri **Assets → Gestisci librerie → Pubblica libreria**, imposta un ID stabile e un nome alla prima pubblicazione, seleziona le modifiche e pubblica. Le modifiche non selezionate restano in sospeso.

Abilita una libreria da **Gestisci librerie**. I suoi asset appaiono accanto ai componenti locali. Le definizioni pubblicate sono in sola lettura nel documento che le usa, mentre istanze collegate e override restano modificabili.

In **Aggiornamenti**, confronta affiancate l'istanza corrente e quella nuova. Aggiorna una singola istanza, tutte le istanze di un asset, la pagina corrente o tutte le pagine. Le proprietà compatibili vengono mantenute e, se manca una variante esatta, il fallback viene mostrato prima della conferma. Gli aggiornamenti supportano annulla/ripristina.

Le librerie possono usare il catalogo locale o un provider di archiviazione configurato. Le revisioni scaricate vengono memorizzate nella cache. I collegamenti abilitati e le definizioni materializzate vengono salvati in `.fig`, quindi il documento può essere riaperto senza accesso alla libreria remota.

## Creare istanze
Clic destro → **Crea istanza**. Appare 40 px a destra.

## Separare un'istanza
<kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> — diventa un frame senza collegamento.

## Sincronizzazione live
Modificare un componente aggiorna tutte le istanze. Proprietà sincronizzate: dimensioni, riempimenti, contorni, effetti, opacità, raggi angoli, layout.

## Override
Le istanze possono sovrascrivere proprietà specifiche senza rompere il collegamento. Proprietà sovrascrivibili: nome, testo, fontSize, fontWeight, fontFamily e proprietà visuali/layout.

## Selezione
Un clic seleziona il componente. **Doppio clic** per entrare e selezionare i figli.

| Azione | Mac | Windows / Linux |
|--------|-----|-----------------|
| Crea componente | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd> |
| Crea set | <kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd> | <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Separa istanza | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd> | <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>B</kbd> |
