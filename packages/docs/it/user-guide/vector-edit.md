---
pageClass: guide
title: Modifica vettoriale
description: Sposta i punti e le curve di un tracciato, aggiungi ed elimina punti e combina forme per crearne di nuove.
---

# Modifica vettoriale

Un tracciato è fatto di punti uniti da linee rette o curve. Per cambiarne la forma, modifica i punti stessi.

## Modificare un tracciato

Fai doppio clic su un tracciato, oppure selezionalo e premi <Keys mac="Enter" other="Enter" />. I suoi punti diventano visibili e le maniglie attorno al livello scompaiono.

<GuideImage name="vector-edit/points" alt="Un tracciato curvo in modalità di modifica, con un punto selezionato e le sue due maniglie" />

- Trascina un punto per spostarlo.
- Trascina la maniglia di un punto per cambiare la curva.
- Fai clic su una linea tra due punti per selezionarla, e trascinala per spostare entrambi i suoi punti.
- Trascina partendo da un punto vuoto per selezionare i punti dentro il riquadro.
- Dentro una forma con riempimento, l’area sotto il puntatore appare tratteggiata. Fai clic per selezionarla con tutti i suoi punti, e trascina per spostarla.
- Tieni premuto <Keys mac="⇧" other="Shift" /> e fai clic per aggiungere alla selezione.

Per terminare la modifica, premi <Keys mac="Esc" other="Esc" /> o <Keys mac="Enter" other="Enter" />, oppure fai clic su una parte vuota della tela.

## Modellare una curva

Tieni premuto un tasto mentre trascini una maniglia:

| Tieni premuto | Cosa fa |
| ------------- | ------- |
| <Keys mac="⌘" other="Ctrl" /> | Mantiene le due maniglie sulla stessa linea, per una curva morbida. Cambia solo la lunghezza di questa maniglia. |
| <Keys mac="⌥" other="Alt" /> | Sposta solo questa maniglia, per un angolo netto. |
| <Keys mac="⇧" other="Shift" /> | Mantiene la direzione della maniglia e ne cambia solo la lunghezza. |

Tieni premuto <Keys mac="⌘" other="Ctrl" /> e trascina un punto per estrarne le maniglie e piegare le linee vicine.

## Aggiungere ed eliminare punti

Premi <Keys mac="P" other="P" /> durante la modifica per usare la penna:

- Fai clic su una linea per aggiungervi un punto.
- Fai clic sull’estremità di un tracciato aperto per continuare a disegnare da lì.
- Tieni premuto <Keys mac="⌥" other="Alt" /> e fai clic su un punto per eliminarlo.

Per eliminare ciò che è selezionato, premi <Keys mac="⌫" other="Delete" />. Un punto eliminato si porta via le sue linee. Una linea eliminata lascia i suoi punti, a meno che nient’altro li tenga, quindi eliminare una linea nel mezzo divide un tracciato in due. Per dividere invece un tracciato in un punto, seleziona il punto e premi <Keys mac="⌥ ⌫" other="Alt Delete" />.

## Combinare forme

Seleziona due o più forme e scegli come combinarle in **Oggetto**:

<GuideImage name="vector-edit/combine" alt="Un quadrato e un cerchio sovrapposti, e i quattro modi per combinarli: unione, sottrazione, intersezione ed esclusione" />

- **Unisci selezione** le unisce in un’unica forma.
- **Sottrai selezione** ritaglia le forme sopra da quella più in basso.
- **Interseca selezione** mantiene solo la zona in cui si sovrappongono.
- **Escludi selezione** mantiene tutto tranne la zona in cui si sovrappongono.

Il risultato resta modificabile: ogni forma conserva al suo interno i propri punti. **Appiattisci** trasforma la selezione in un unico tracciato semplice, e **Converti traccia in contorno** trasforma un contorno in una forma con riempimento. Rettangoli, ellissi e stelle, una volta appiattiti, diventano tracciati che puoi modificare punto per punto.
