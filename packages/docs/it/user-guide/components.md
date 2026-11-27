---
pageClass: guide
title: Componenti
description: Crea componenti riutilizzabili, inserisci istanze, aggiungi varianti e proprietà e trasforma i componenti in controlli funzionanti.
---

# Componenti

Un componente è un elemento di design che usi più e più volte, come un pulsante o una scheda. Le sue copie si chiamano istanze. Modifica il componente, e ogni istanza cambia con lui.

<GuideLegend>

<GuideImage name="components/overview" alt="Un componente Button con due varianti in un riquadro tratteggiato, e accanto un’istanza Publish" />

1. Un **set di componenti** contiene le varianti di un componente. Ha un bordo viola tratteggiato.
2. Ogni **variante** è un componente a sé. Il suo nome, come **Variant=Primary**, compare sopra di essa.
3. Un’**istanza** è una copia che inserisci nel design. Mantiene il proprio testo, qui **Publish**.

</GuideLegend>

## Creare un componente

1. Seleziona una cornice, o i livelli che vuoi riutilizzare.
2. Premi <Keys mac="⌥ ⌘ K" other="Ctrl Alt K" />.

Una cornice o un gruppo diventa il componente. Gli altri livelli vengono racchiusi in un nuovo componente. Sulla tela, i componenti mostrano il loro nome in viola sopra di sé.

## Inserire un’istanza

Apri **Risorse** in cima al pannello di sinistra. Elenca i componenti del tuo file, per pagina, e quelli delle librerie che hai attivato.

<GuideLegend>

<GuideImage name="components/assets" alt="Il pannello Risorse con i componenti Button e Switch" />

- Fai clic su un componente per inserirlo, o trascinalo sulla tela.
- Scrivi nel campo di ricerca per trovarne uno per nome.
- I pulsanti accanto alla ricerca passano dalla vista a griglia a quella a elenco e aprono le [librerie](./component-libraries).

</GuideLegend>

Puoi anche fare clic destro su un componente sulla tela e scegliere **Crea istanza**, o premere <Keys mac="⌘ D" other="Ctrl D" /> su di esso.

## Modificare tutte le istanze

Modifica il componente: le sue dimensioni, i colori, il testo, il layout o i livelli al suo interno. Ogni istanza segue, tranne dove hai modificato tu quell’istanza.

Per trovare il componente da cui proviene un’istanza, fai clic destro sull’istanza e scegli **Vai al componente principale**. OpenPencil apre la sua pagina e lo seleziona.

## Modificare una sola istanza

Seleziona un’istanza e modificala come qualsiasi altro livello: cambia il testo, sostituisci un colore o nascondi un livello al suo interno. Queste modifiche restano quando il componente cambia, e tutto il resto continua a seguire il componente.

Alcune cose vengono sempre dal componente: la posizione di ogni livello all’interno dell’istanza, la sua rotazione e i suoi vincoli.

Per staccare un’istanza dal suo componente, premi <Keys mac="⌥ ⌘ B" other="Ctrl Alt B" />. Diventa una semplice cornice dall’aspetto identico.

## Creare varianti

Le varianti sono versioni di uno stesso componente, come un pulsante primario e uno secondario, o un interruttore acceso e spento.

1. Seleziona un componente.
2. Fai clic su **Aggiungi variante** in cima al pannello Design. Il componente diventa un set, con una copia sotto.
3. Modifica la copia e dalle un nome in **Varianti**.

Per combinare componenti che hai già, selezionali e premi <Keys mac="⇧ ⌘ K" other="Ctrl Shift K" />.

Una variante può avere più proprietà, come **Size=Small, State=Hover**. Il set non deve contenere tutte le combinazioni. Quando un’istanza richiede una combinazione che il set non ha, usa la variante in alto a sinistra.

## Scegliere una variante in un’istanza

<GuideLegend>

<GuideImage name="components/instance" alt="Le proprietà del componente per un’istanza: Label impostato su Publish e Variant impostato su Primary" />

Seleziona un’istanza. **Proprietà del componente**, in cima al pannello Design, elenca ciò che puoi impostare: scegliere una variante, scrivere un’etichetta o attivare e disattivare un livello.

</GuideLegend>

## Aggiungere proprietà

Le proprietà sono le impostazioni che un’istanza offre. Le proprietà variante di un set di componenti ci sono già.

1. Seleziona il componente.
2. Fai clic su **+** accanto a **Proprietà** e scegli un tipo:
   - **Testo** imposta le parole di un’etichetta.
   - **Booleano** mostra o nasconde un livello, come un’icona.
   - **Scambio di istanza** sostituisce un’istanza nidificata, come l’icona stessa.
   - **Variante** aggiunge un altro insieme di varianti.
3. Collega un livello alla proprietà. Seleziona il livello nel componente e fai clic su **Applica variabile/proprietà** accanto alla sua impostazione: in **Tipografia** per il testo, in **Aspetto** per mostrare e nascondere, o in cima al pannello per un’istanza nidificata.

<GuideLegend>

<GuideImage name="components/property" alt="La proprietà Label aperta, con il nome, il valore predefinito e il livello che controlla" />

Fai clic su una proprietà per rinominarla, cambiarne il valore predefinito, vedere i livelli che controlla o eliminarla. Trascina le proprietà per riordinarle.

</GuideLegend>

Per mostrare le proprietà di un’istanza nidificata sulle istanze del tuo componente, scegli **+ → Istanze nidificate** e selezionala.

## Aggiungere slot

Uno slot è una cornice di un componente il cui contenuto viene riempito da ogni istanza, come il corpo di una scheda o le voci di un elenco.

1. Seleziona una cornice dentro il componente, o i livelli da racchiudere in una cornice.
2. Fai clic su **Crea slot** nel pannello Design, oppure scegli **Oggetto → Crea slot**.

Le impostazioni dello slot comprendono una descrizione, i componenti preferiti e quanti elementi contiene; un’istanza fuori da questi limiti mostra un avviso. In un’istanza, aggiungi, riordina e rimuovi gli elementi di uno slot, o ripristina il contenuto del componente.

## Far funzionare un componente come un controllo

Un comportamento trasforma un componente in un pulsante, un interruttore, un cursore, una scheda o un campo di testo funzionante quando visualizzi l’anteprima del design. I controlli vengono da [Reka UI](https://reka-ui.com).

1. Seleziona il componente o il set di componenti.
2. Fai clic su **+** accanto a **Comportamento** e scegli un controllo.
3. Compila le righe che mostra.

<GuideLegend>

<GuideImage name="components/behaviour" alt="La sezione Comportamento di uno Switch, contrassegnata come Pronto, con Selezionato, On, Off, Cursore, Stati e Transizione" />

- Le prime righe indicano quale proprietà contiene il valore, come **Selezionato** per un interruttore, e quale slot disegna ogni parte, come il suo **Cursore**.
- **Stati** è la proprietà variante che definisce l’aspetto del controllo a riposo, sotto il puntatore, premuto, con focus, disattivato e non valido. **Aggiungi varianti di stato** le crea per te.
- **Transizione** rende graduale il passaggio del controllo da uno stato all’altro. La sua durata e il suo easing possono seguire le [variabili di easing e di tempo](./variables#variabili-di-easing-e-di-tempo).

</GuideLegend>

**Pronto** compare quando il controllo funziona. Fino ad allora, una riga sotto il suo nome indica cosa manca: fai clic per andarci.

Per provare i controlli, premi <Keys mac="⌥ ⌘ ↩" other="Ctrl Alt Enter" /> o fai clic su ▶ accanto a **Condividi**. Gli interruttori scattano, i cursori si trascinano, le schede si aprono e i campi di testo accettano l’input. L’anteprima non modifica il file. **Ripristina** riporta ogni controllo allo stato iniziale, e <Keys mac="Esc" other="Esc" /> torna alla modifica.

I comportamenti vengono salvati nei file `.fig`, e i componenti Vue, React e Storybook esportati li conservano, con ogni transizione scritta in CSS.

## Condividere componenti tra file

Per usare gli stessi componenti in più file, pubblicali come [libreria di componenti](./component-libraries).
