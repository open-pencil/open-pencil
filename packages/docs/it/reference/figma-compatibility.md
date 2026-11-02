# Compatibilità con Figma

Confronto tra le funzioni di Figma Design e lo stato attuale di OpenPencil.

::: tip Stato
✅ Supportato · 🟡 Parziale · 🔲 Non implementato
:::

**Copertura:** 128 funzioni su 156 considerate — 112 complete, 16 parziali e 28 in attesa. Aggiornato: 2026-10-27.

## Interfaccia e navigazione

Barra degli strumenti personalizzabile, livelli, pagine, proprietà, zoom, spostamento, righelli, sfondo, guide trascinabili dai righelli, palette dei comandi (<kbd>⌘</kbd><kbd>K</kbd>), menu contestuale e menu dell’applicazione sono disponibili. Le scorciatoie sono parziali (mancano Scala, Freccia, Contagocce e lo strumento Zoom), così come gli strumenti AI, che non generano immagini né offrono ricerca AI. Ricerca e sostituzione, vista reticolare, miniatura personalizzata e passo di spostamento personalizzato mancano.

## Livelli e forme

Forme di base, frame, gruppi, sezioni, archi, maschere, gerarchia, selezione, allineamento, copia/incolla, blocco, visibilità, ordine, spostamento tra pagine, vincoli, griglie di disposizione, misurazione delle distanze, modifica multipla e copia delle proprietà sono supportati. Il ridimensionamento proporzionale non ha uno strumento Scala (<kbd>K</kbd>) e la selezione intelligente si limita ad allineare e distribuire. Manca la ricerca di livelli simili.

## Strumenti vettoriali

Reti vettoriali, Penna, Matita, operazioni booleane, appiattimento e conversione di contorni o testo in tracciati sono supportati. La modifica dei vertici è parziale: mancano la simmetria per punto e i controlli degli angoli. Costruttore di forme, offset e semplificazione mancano.

## Testo e tipografia

Modifica diretta, rendering CanvasKit Paragraph, font di sistema, famiglia, dimensione, interlinea, allineamento orizzontale e verticale, modalità di ridimensionamento, elenchi, emoji, CJK, RTL e font di icone funzionano. Funzionano anche i font variabili, con gli assi regolabili nel pannello. Il testo su tracciato è parziale, perché per modificarne i caratteri servono i contorni del font in locale. Lo sono anche stili di testo, link e funzioni OpenType, a cui mancano soprattutto i controlli nel pannello.

## Colori, sfumature e immagini

Selettore colore con campi RGB, HSL, HSB e OkHCL, colori uniformi, sfumature lineari, radiali, angolari e a diamante, riempimenti immagine, metodi di fusione e colori della selezione sono supportati. I pattern importati si vedono ma non si possono creare, l’inserimento di immagini esclude i video e il ritaglio non ha maniglie sulla tela. Regolazioni delle immagini e contagocce mancano.

## Effetti e proprietà

Ombre, sfocature, spessore del contorno, estremità, giunzioni, tratteggio, allineamento, raggi e smussatura continua degli angoli e più riempimenti/contorni per livello sono supportati.

## Disposizione automatica

Flexbox, Grid, direzione, spaziatura, margini interni, allineamento, modalità di dimensionamento, ritorno a capo, disposizioni annidate, riordino tramite trascinamento e dimensioni minime e massime sono supportati.

## Componenti e sistemi di design

Componenti, insiemi, istanze, varianti, proprietà, sostituzioni, variabili di tutti e quattro i tipi con collezioni e modalità, e librerie sono supportati. Gli stili con nome si applicano e si scollegano, ma non c’è ancora un’interfaccia per crearli o modificarli.

## Prototipazione

Collegamenti, trigger, azioni, animazioni, sovrapposizioni, scorrimento, flussi, logica condizionale e modalità presentazione non sono ancora disponibili.

## Importazione ed esportazione

Importazione/esportazione `.fig`, salvataggio, appunti Figma ed esportazione in immagini, SVG, PDF, PPTX e draw.io funzionano. La cronologia delle versioni è parziale: esiste solo per i documenti OpenPencil Cloud (in anteprima), non per i file locali. Manca l’importazione Sketch.

## API dei plugin e scripting

`eval` esegue JavaScript senza interfaccia con un oggetto globale `figma` compatibile.

## Collaborazione e modalità sviluppo

Commenti, collaborazione P2P con chiamate vocali, Tailwind, server MCP e CLI sono disponibili. La modalità sviluppo e gli snippet di codice sono parziali: design JSX, HTML, Vue e React con CSS o Tailwind, ma niente ispezione con quote né Swift, Kotlin o Compose. Chat del cursore, ramificazioni, Code Connect e Figma per VS Code mancano.

## Figma Draw

Gli strumenti specializzati di illustrazione e le trasformazioni dei pattern non sono ancora disponibili.
