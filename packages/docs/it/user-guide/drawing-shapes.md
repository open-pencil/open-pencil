---
pageClass: guide
title: Disegno forme
description: Disegna rettangoli, ellissi, linee, poligoni, stelle, cornici e sezioni, poi colorali e aggiungi contorni, ombre e sfocature.
---

# Disegno forme

Gli strumenti per le forme si trovano nella barra degli strumenti in fondo alla finestra. Scegline uno, poi trascina sulla tela.

## Disegnare una forma

1. Premi <Keys mac="R" other="R" /> per un rettangolo, <Keys mac="O" other="O" /> per un’ellisse o <Keys mac="L" other="L" /> per una linea. Poligoni e stelle si trovano nel menu delle forme: fai clic sulla freccia accanto al rettangolo.
2. Trascina sulla tela. Tieni premuto <Keys mac="⇧" other="Shift" /> per disegnare un quadrato o un cerchio, o per mantenere una linea a passi di 45°.
3. Rilascia. La nuova forma resta selezionata, e la barra degli strumenti torna a **Sposta**.

<GuideImage name="drawing-shapes/tools" alt="Il menu delle forme aperto nella barra degli strumenti, con Rettangolo, Linea, Ellisse, Poligono e Stella" />

Un clic senza trascinare crea una forma di 100 × 100, o una linea lunga 100. Inizia dentro una cornice per disegnare la forma al suo interno.

## Arrotondare gli angoli

Passa il puntatore su un rettangolo selezionato: in ogni angolo compare un punto. Trascinane uno per arrotondare gli angoli: tutti quanti finché sono uguali, o solo quello quando sono diversi. Tieni premuto <Keys mac="⌥" other="Alt" /> per fare il contrario, e <Keys mac="⇧" other="Shift" /> per procedere a passi di 10.

Per inserire un raggio, usa **Raggio** nel pannello Design. Il pulsante accanto imposta ogni angolo separatamente. **Smussatura degli angoli** fa iniziare la curva prima, come nell’icona di un’app.

Un poligono o una stella ha un punto per il raggio, sotto la punta superiore, e altri due:

- Trascina il punto sulla punta successiva attorno al centro per cambiare il numero di punte.
- Trascina in dentro o in fuori il punto sulla prima punta interna di una stella per renderla più sottile o più piena.

**Numero** e **Rapporto** nel pannello Design fanno lo stesso. I punti si nascondono quando la forma è più piccola di circa 108 pixel sullo schermo: ingrandisci per raggiungerli.

<GuidePair>

<GuideImage name="drawing-shapes/corners" alt="Un rettangolo selezionato con un punto in ogni angolo" caption="Punti degli angoli su un rettangolo" />
<GuideImage name="drawing-shapes/star" alt="Una stella selezionata con i punti per raggio, numero di punte e rapporto" caption="Punti per raggio, punte e rapporto su una stella" />

</GuidePair>

## Colorare una forma

Fai clic sul quadratino del colore sotto **Riempimento**. I pulsanti in cima al selettore, da sinistra a destra, scelgono il tipo di riempimento:

<GuideLegend>

<GuideImage name="drawing-shapes/fill" alt="Il selettore del riempimento sul pulsante della sfumatura, con una sfumatura lineare viola e i suoi due punti" />

- **Pieno**: un solo colore. Scrivi un valore esadecimale nel pannello, o usa il contagocce per prendere un colore dalla tela.
- **Sfumatura**: lineare, radiale, angolare o a diamante. Mentre il selettore è aperto, la tela mostra le maniglie della sfumatura. Trascina un’estremità per spostarla, con <Keys mac="⇧" other="Shift" /> per ruotarla a passi di 15°, e trascina il quadratino di un punto per farlo scorrere.
- **Immagine**: un’immagine dal tuo computer o una [foto stock](./photos). Può riempire la forma con **Fill**, **Fit**, **Crop** o **Tile**, e i cursori regolano esposizione, contrasto e altro.
- **Shader**: un effetto in movimento, come **Aurora**. La tela mostra un fotogramma fisso, e l’effetto si anima in anteprima: fai clic su **▷** in alto a destra nella finestra, o premi <Keys mac="⌘ ⌥ Enter" other="Ctrl Alt Enter" />. Fai clic su **{ }** per incollare un preset copiato da shaders.com.

</GuideLegend>

Fai clic su **+** accanto a **Riempimento** per aggiungere un altro riempimento sopra. L’occhio nasconde un riempimento, e **−** lo rimuove.

## Aggiungere un contorno

Fai clic su **+** accanto a **Contorno**. Poi:

- **Interno**, **Centro** o **Esterno** stabilisce dove si trova la linea rispetto al bordo.
- **W** imposta lo spessore. Il pulsante con quattro quadratini imposta lo spessore di ogni lato separatamente.
- Il pulsante delle impostazioni accanto attiva la linea tratteggiata e imposta l’aspetto delle estremità e degli angoli della linea. Un tracciato aperto può terminare con una freccia.

## Aggiungere ombre e sfocature

Fai clic su **+** accanto a **Effetti**, poi scegli il tipo di effetto:

<GuideLegend>

<GuideImage name="drawing-shapes/effects" alt="L’elenco degli effetti: ombra esterna, ombra interna, sfocatura livello, sfocatura sfondo, sfocatura primo piano, rumore, texture e vetro" />

- **Ombra esterna** e **Ombra interna**: un’ombra fuori o dentro la forma.
- **Sfocatura livello** sfoca la forma, **Sfocatura sfondo** ciò che sta dietro, come fa il vetro smerigliato, e **Sfocatura primo piano** ciò che sta davanti. Una sfocatura è **Uniforme**, o **Progressiva** per passare gradualmente da nitida a sfocata.
- **Rumore** e **Texture**: una grana sopra la forma.
- **Vetro**: piega e illumina ciò che sta dietro la forma, come una lente.

</GuideLegend>

Fai clic sul quadratino accanto a un effetto per cambiarne le impostazioni. Una forma può avere più effetti, ma un solo vetro e una sola texture.

## Disegnare una cornice

Una cornice contiene altri livelli: uno schermo, una scheda o un pulsante. Premi <Keys mac="F" other="F" /> o <Keys mac="A" other="A" /> e trascina.

- I livelli che la nuova cornice copre interamente finiscono al suo interno.
- Per una cornice delle dimensioni dello schermo di un telefono, di un tablet o di un desktop, scegli una dimensione nel pannello Design mentre lo strumento Cornice è attivo. Con una cornice selezionata, **Cornice** nel pannello Design la ridimensiona allo stesso modo.
- Una cornice nasconde ciò che sporge. Disattiva **Ritaglia contenuto** per mostrarlo.
- Per disporre in righe o colonne il contenuto di una cornice, usa l’[auto-layout](./auto-layout).

## Raggruppare aree con le sezioni

Una sezione delimita un’area della pagina, come un flusso o un gruppo di schermate. Premi <Keys mac="⇧ S" other="Shift S" /> e trascina attorno ai livelli.

I livelli che una sezione copre interamente finiscono al suo interno, anche quando in seguito sposti o ridimensioni la sezione. Le sezioni restano al livello più alto della pagina: non possono stare dentro una cornice. Trascina il nome di una sezione per spostarla.

## Organizzare la barra degli strumenti

Fai clic destro sulla barra degli strumenti e scegli **Personalizza barra degli strumenti…**. Le stesse impostazioni si trovano in **Impostazioni → Editor**.

- Disattiva uno strumento per nasconderlo. La sua scorciatoia continua a funzionare.
- Trascina uno strumento per spostarlo. Rilascialo dentro un riquadro per metterlo in quel menu, tra due riquadri per dargli un pulsante tutto suo, o su un altro strumento per mettere entrambi in un unico menu.
- **Ripristina predefiniti** rimette tutto com’era.

Gli strumenti aggiunti in una versione successiva vanno al loro posto abituale, anche in una barra degli strumenti che hai modificato.
