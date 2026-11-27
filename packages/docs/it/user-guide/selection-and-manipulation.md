---
pageClass: guide
title: Selezione e manipolazione
description: Seleziona i livelli, poi spostali, ridimensionali, ruotali, copiali e modificane diversi insieme.
---

# Selezione e manipolazione

Per modificare un livello, prima selezionalo. Il pannello Design mostra allora le sue impostazioni, e le maniglie attorno ti permettono di ridimensionarlo e ruotarlo.

## Selezionare un livello

Fai clic su un livello sulla tela. In una cornice, un clic seleziona un livello subito dentro la cornice, come una riga di un elenco. Fai doppio clic per scendere di un livello.

<GuidePair>

<GuideImage name="selection-and-manipulation/click" alt="La riga Paper Lanterns selezionata in una scheda playlist" caption="Il clic seleziona la riga" />
<GuideImage name="selection-and-manipulation/double-click" alt="Il titolo e l’artista dentro la riga selezionati" caption="Il doppio clic entra nella riga" />

</GuidePair>

Per raggiungere subito il livello sotto il puntatore, tieni premuto <Keys mac="⌘" other="Ctrl" /> e fai clic. Per non selezionare nulla, fai clic su una parte vuota della tela o premi <Keys mac="Esc" other="Esc" />.

## Selezionare più livelli

- Tieni premuto <Keys mac="⇧" other="Shift" /> e fai clic sui livelli per aggiungerli alla selezione o toglierli.
- Trascina sulla tela partendo da un punto vuoto per disegnare un riquadro. I livelli che tocca vengono selezionati. Una cornice della pagina viene selezionata solo quando il riquadro la copre interamente.
- Premi <Keys mac="⌘ A" other="Ctrl A" /> per selezionare tutto il contenuto della pagina.

<GuideImage name="selection-and-manipulation/marquee" alt="Un riquadro di selezione disegnato su due righe di una scheda playlist" />

## Selezionare con la tastiera

- <Keys mac="Enter" other="Enter" /> seleziona i livelli dentro quello selezionato.
- <Keys mac="⇧ Enter" other="Shift Enter" /> seleziona il livello che lo contiene.
- <Keys mac="Tab" other="Tab" /> e <Keys mac="⇧ Tab" other="Shift Tab" /> selezionano il livello successivo e precedente allo stesso livello di annidamento.

## Spostare i livelli

Trascina un livello selezionato. I tasti freccia lo spostano di un pixel, e di dieci con <Keys mac="⇧" other="Shift" />.

- Tieni premuto <Keys mac="⇧" other="Shift" /> mentre trascini per spostarlo in linea retta.
- Rilascialo sopra una cornice per inserire il livello al suo interno. Trascinalo fuori dalla cornice per toglierlo.
- Tieni premuto <Keys mac="Space" other="Space" /> mentre trascini per mantenere il livello nella sua cornice.

## Ridimensionare e ruotare

<GuideLegend>

<GuideImage name="selection-and-manipulation/handles" alt="Una scheda selezionata con tre parti numerate: una maniglia d’angolo, la maniglia di rotazione e le dimensioni" />

1. Trascina una **maniglia** per ridimensionare. Tieni premuto <Keys mac="⇧" other="Shift" /> su un angolo per mantenere le proporzioni.
2. Trascina la **maniglia di rotazione** per ruotare, oppure punta appena fuori da un angolo e trascina. Tieni premuto <Keys mac="⇧" other="Shift" /> per ruotare a passi di 15°.
3. Le **dimensioni** vengono mostrate mentre il livello è selezionato.

</GuideLegend>

Per inserire dimensioni o un angolo esatti, usa **W**, **H** e il campo dell’angolo nel pannello Design. <Keys mac="⇧ H" other="Shift H" /> e <Keys mac="⇧ V" other="Shift V" /> riflettono la selezione in orizzontale o in verticale.

## Copiare, incollare ed eliminare

- <Keys mac="⌘ D" other="Ctrl D" /> crea una copia accanto all’originale.
- Tieni premuto <Keys mac="⌥" other="Alt" /> mentre trascini per estrarre una copia.
- <Keys mac="⌘ C" other="Ctrl C" /> e <Keys mac="⌘ V" other="Ctrl V" /> copiano e incollano. Un livello incollato mantiene la sua posizione; per incollarlo sotto il puntatore, fai clic destro e scegli **Incolla qui**.
- <Keys mac="⇧ ⌘ R" other="Ctrl Shift R" /> incolla al posto dei livelli selezionati.
- <Keys mac="⌫" other="Delete" /> elimina la selezione.

Il testo copiato da una pagina web viene incollato come un unico livello di testo. Quando copi una parte del layout di una pagina, come una scheda, un avviso propone **Incolla come livelli** per ricostruirla come cornici e testo.

## Copiare l’aspetto di un livello

<Keys mac="⌥ ⌘ C" other="Ctrl Alt C" /> copia l’aspetto di un livello, e <Keys mac="⌥ ⌘ V" other="Ctrl Alt V" /> applica quell’aspetto a ogni livello selezionato. Funziona anche con i livelli copiati in Figma.

L’aspetto comprende riempimenti, contorni, effetti, opacità, metodo di fusione, raggio degli angoli e gli stili e le variabili che usano. Tra cornici include l’auto-layout, e tra livelli di testo lo stile del testo. Posizione, dimensioni, nome e contenuto restano invariati.

## Raggruppare i livelli

- <Keys mac="⌘ G" other="Ctrl G" /> raggruppa la selezione.
- <Keys mac="⌥ ⌘ G" other="Ctrl Alt G" /> la inserisce invece in una nuova cornice.
- <Keys mac="⇧ ⌘ G" other="Ctrl Shift G" /> scompone un gruppo, una cornice o una sezione, lasciando i suoi livelli dove sono.

Per disporre i livelli in una riga o in una colonna, usa invece l’[auto-layout](./auto-layout).

## Mostrare un livello attraverso una forma

Metti la forma sotto i livelli che deve ritagliare, selezionali tutti e premi <Keys mac="⌥ ⌘ M" other="Ctrl Alt M" />. Il livello più in basso diventa una maschera: i livelli sopra si vedono solo al suo interno, come una foto in un cerchio. Premi di nuovo la scorciatoia per disattivare la maschera.

## Portare i livelli davanti o dietro

I livelli più in alto nell’[elenco dei livelli](./layers-and-pages) coprono quelli sotto.

- <Keys mac="]" other="]" /> porta la selezione in primo piano, e <Keys mac="[" other="[" /> la porta in fondo.
- <Keys mac="⌘ ]" other="Ctrl ]" /> e <Keys mac="⌘ [" other="Ctrl [" /> la spostano di un passo.

## Nascondere e bloccare i livelli

- <Keys mac="⇧ ⌘ H" other="Ctrl Shift H" /> nasconde la selezione, o la mostra di nuovo. I livelli nascosti restano nell’elenco dei livelli.
- <Keys mac="⇧ ⌘ L" other="Ctrl Shift L" /> la blocca. Non puoi selezionare né spostare un livello bloccato sulla tela; selezionalo invece nell’elenco dei livelli.

## Modificare più livelli insieme

Con più livelli selezionati, il pannello Design mostra le impostazioni che hanno in comune. **Misto** indica un’impostazione che è diversa tra loro. Se cambi un’impostazione, cambia per tutti.

<GuideImage name="selection-and-manipulation/several" alt="Il pannello Design per due righe selezionate, con Y impostato su Misto" />

<GuideLegend>

<GuideImage name="selection-and-manipulation/selection-colors" alt="Colori della selezione con quattro colori elencati" />

**Colori della selezione** elenca ogni colore presente nella selezione, compresi i livelli al suo interno. Cambia un colore qui per cambiarlo ovunque sia usato.

</GuideLegend>
