# Compatibilità con Figma

Confronto tra le funzioni di Figma Design e lo stato attuale di OpenPencil.

::: tip Stato
✅ Supportato · 🟡 Parziale · 🔲 Non implementato
:::

**Copertura:** 94 funzioni su 158 considerate — 76 complete, 18 parziali e 64 in attesa. Aggiornato: 2026-03-07.

## Interfaccia e navigazione

Barra degli strumenti, livelli, pagine, proprietà, zoom, spostamento, righelli, sfondo, menu contestuale, scorciatoie principali e strumenti AI sono disponibili. Guide trascinabili, palette dei comandi, ricerca globale, vista reticolare e passo di spostamento personalizzato mancano o sono parziali.

## Livelli e forme

Forme di base, frame, gruppi, sezioni, archi, gerarchia, selezione, allineamento, copia/incolla, blocco, visibilità, ordine, spostamento tra pagine e modifica multipla sono supportati. Disegno a mano libera, maschere, vincoli, selezione intelligente, griglie di disposizione, misurazione e copia delle proprietà non lo sono ancora.

## Strumenti vettoriali

Reti vettoriali e Penna sono supportate. La modifica avanzata dei vertici è parziale. Operazioni booleane, appiattimento, conversione di contorni o testo, costruttore di forme, offset e semplificazione mancano.

## Testo e tipografia

Modifica diretta, rendering CanvasKit Paragraph, font di sistema, famiglia, dimensione, interlinea e allineamento di base funzionano. Allineamento verticale, dimensioni automatiche, elenchi, link, OpenType, font variabili e supporto completo CJK/RTL sono assenti o parziali.

## Colori, sfumature e immagini

Colori uniformi, sfumature lineari, radiali, angolari e a diamante e riempimenti immagine sono supportati. Pattern, fusione, video, regolazioni, ritaglio interattivo, contagocce e modifica condivisa dei colori mancano.

## Effetti e proprietà

Ombre, sfocature, spessore del contorno, estremità, giunzioni, tratteggio, allineamento e raggi degli angoli sono supportati. Smussatura continua e più riempimenti/contorni per livello non lo sono.

## Disposizione automatica

Flexbox, Grid, direzione, spaziatura, margini interni, allineamento, modalità di dimensionamento, ritorno a capo, disposizioni annidate e riordino tramite trascinamento sono supportati. Mancano dimensioni minime e massime.

## Componenti e sistemi di design

Componenti, insiemi, istanze, varianti, proprietà, sostituzioni, variabili e librerie sono supportati. Mancano stili con nome; alcuni tipi di variabili non hanno ancora un’interfaccia completa.

## Prototipazione

Collegamenti, trigger, azioni, animazioni, sovrapposizioni, scorrimento, flussi, logica condizionale e modalità presentazione non sono ancora disponibili.

## Importazione ed esportazione

Importazione/esportazione `.fig`, salvataggio, appunti Figma ed esportazione immagini/SVG funzionano. Importazione Sketch, PDF e cronologia delle versioni mancano.

## API dei plugin e scripting

`eval` esegue JavaScript senza interfaccia con un oggetto globale `figma` compatibile.

## Collaborazione e modalità sviluppo

Collaborazione P2P, visualizzazione JSX, Tailwind, server MCP e CLI sono disponibili. Commenti, Code Connect, ramificazioni e specifiche complete di consegna mancano.

## Figma Draw

Gli strumenti specializzati di illustrazione e le trasformazioni dei pattern non sono ancora disponibili.
