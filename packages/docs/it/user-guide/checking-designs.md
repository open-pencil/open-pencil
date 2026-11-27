---
pageClass: guide
title: Verificare i design
description: Trova problemi di accessibilità, coerenza e struttura con il pannello Verifica e gli indicatori dei problemi sulla tela.
---

# Verificare i design

OpenPencil controlla la pagina corrente mentre lavori e segnala i livelli che violano le regole comuni del design: testo difficile da leggere, controlli troppo piccoli da toccare, colori che dovrebbero usare una variabile e spaziature fuori scala.

## Trovare i problemi

Apri la scheda **Verifica** nel pannello di destra. Il suo badge mostra quanti errori e avvisi ha la pagina.

<GuideImage name="checking-designs/lint" alt="Una scheda di registrazione con testo chiaro e piccolo e un pulsante piccolo, i suoi indicatori dei problemi e il pannello Verifica che elenca contrasto basso, testo piccolo e un’area di tocco piccola" />

- **Pagina** elenca ogni problema della pagina corrente; **Selezione** limita l’elenco ai livelli selezionati e a tutto ciò che contengono; **Documento** elenca i problemi di tutte le pagine, contrassegnando quelli delle altre pagine. Un clic su uno di questi passa alla sua pagina. Le pagine di un file `.fig` grande che non sono ancora state aperte vengono controllate quando le apri.
- I problemi sono raggruppati per regola, dai più gravi. Errori e avvisi partono espansi; i suggerimenti partono compressi.
- I pulsanti della gravità sotto il selettore dell’ambito attivano e disattivano il filtro di errori, avvisi e suggerimenti.
- Passa il puntatore sul titolo di un gruppo per leggere cosa controlla la regola e perché.

Passa il puntatore su un problema per evidenziarne il livello sulla tela. Fai clic per selezionare il livello; se è fuori dallo schermo, la tela si sposta su di esso, e riduce lo zoom solo quando il livello non ci sta.

## Correggere i problemi

Le righe che si possono correggere in un solo passaggio mostrano un pulsante al passaggio del puntatore:

- Un colore inserito a mano che corrisponde a una delle variabili di colore del documento viene collegato a essa (pulsante del collegamento). La riga indica il nome della variabile.
- Le posizioni e le dimensioni subpixel vengono arrotondate a pixel interi. I valori impostati dall’auto-layout o dal ridimensionamento del testo, la grafica vettoriale e le parti dei gruppi non vengono toccati.
- Il raggio degli angoli e le spaziature fuori scala passano al valore della scala più vicino, e il testo sotto la dimensione minima viene ingrandito fino a raggiungerla (pulsante della bacchetta). Queste correzioni cambiano il design, quindi si applicano una riga alla volta.
- Un gruppo viene convertito sul posto in una cornice, mantenendo i suoi livelli, la posizione e l’aspetto (pulsante della cornice), e un livello nascosto può essere eliminato (pulsante del cestino). Nessuna delle due opzioni è disponibile per i livelli bloccati o per i livelli dentro un componente o un’istanza, la cui struttura appartiene al componente.

Collegare i colori e arrotondare i pixel mantiene l’aspetto del design, quindi i loro gruppi offrono anche **Collega tutti** o **Correggi tutti**. Ogni correzione è un singolo passaggio di annullamento.

Gli altri problemi mostrano il valore che richiede attenzione, come un rapporto di contrasto o le dimensioni di un’area di tocco, così puoi correggerli nel pannello Design.

## Vedere i problemi sulla tela

Gli indicatori sulla tela, i conteggi delle pagine e i segni nel pannello Livelli restano disattivati finché non li attivi, così un file aperto in un nuovo profilo non è coperto di avvisi. Attivali o disattivali con **Visualizza → Problemi di design**, o con **Mostra i problemi nell’area di lavoro** nel menu delle impostazioni del pannello Verifica. Un profilo che ha già memorizzato la scelta la mantiene.

Quando sono attivi, i livelli con errori e avvisi hanno un indicatore nell’angolo in alto a destra: rosso per gli errori, ambra per gli avvisi. I suggerimenti compaiono solo nel pannello Verifica.

- Passa il puntatore su un indicatore per vederne i problemi. Fai clic per selezionare il livello e aprirne i problemi nel pannello Verifica.
- Gli indicatori che si sovrapporrebbero si uniscono in uno solo che mostra il conteggio complessivo.
- Quando un livello è troppo piccolo per essere visto allo zoom corrente, il suo indicatore si sposta sul livello contenitore più vicino abbastanza grande da essere indicato.
- Gli errori e gli avvisi fuori dalla parte visibile della tela sono fissati al suo bordo e puntano verso di loro. Passa il puntatore su un segnaposto per vederli; fai clic per portare in vista il più vicino tra i più gravi e aprirlo in Verifica.
- I livelli nascosti e quelli ritagliati fuori vista da una cornice mantengono i loro problemi nel pannello ma non hanno indicatori.

Le pagine con errori o avvisi ne mostrano il conteggio nell’elenco delle pagine, controllate in background mentre lavori. Il pannello Livelli contrassegna gli stessi livelli: un livello con errori o avvisi mostra il più grave come icona, e un livello compresso con problemi al suo interno mostra un punto. Questi segni seguono lo stesso interruttore degli indicatori sulla tela.

## Vedere i problemi nel codice

La scheda Codice sottolinea errori e avvisi nel Design JSX, HTML, Vue o React dei loro livelli, sulla proprietà che causa il problema quando ce n’è una, come `size={10}` per il testo piccolo, oppure sulla classe che dà stile al livello. Passa il puntatore sulla sottolineatura per leggere il problema. La pagina viene controllata mentre il pannello Verifica è aperto o gli indicatori sulla tela sono attivi, e le sottolineature seguono quel controllo e le tue modifiche.

## Scegliere le regole

Il menu delle impostazioni del pannello Verifica passa da un insieme di regole predefinito all’altro:

- **Consigliate** — impostazioni bilanciate per il lavoro di tutti i giorni.
- **Rigorose** — ogni regola come avviso o errore.
- **Accessibilità** — solo contrasto, dimensioni delle aree di tocco e dimensioni del testo.

Disattiva una singola regola dal menu del suo gruppo. **Riattiva regole disattivate** nel menu delle impostazioni le riattiva. Gli insiemi di regole e le regole disattivate vengono salvati tra una sessione e l’altra.

Le stesse regole si eseguono dalla riga di comando con `openpencil lint`; vedi [Esaminare file con la CLI](/it/developers/cli/inspecting).
