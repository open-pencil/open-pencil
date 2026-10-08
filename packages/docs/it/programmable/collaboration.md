---
title: Collaborazione
description: Modifica P2P in tempo reale tramite WebRTC e Yjs, senza server centrale.
---

# Collaborazione

OpenPencil permette a più persone di modificare un documento in tempo reale. Le modifiche passano direttamente tra i partecipanti tramite WebRTC.

## Avviare una sessione

Apri il menu di collaborazione, crea una stanza e condividi il link. L’identificatore usa casualità crittografica e non contiene dati del documento.

## Dati condivisi

- **Documento:** forme, testo, proprietà e disposizione;
- **Presenza:** nome, colore, selezione e pagina attiva;
- **Cursori:** posizione di ogni partecipante;
- **Vista:** possibilità di seguire l’inquadratura di un’altra persona;
- **Agenti:** la chat AI integrata, le chat ACP e Pi harness e ogni client MCP collegato compaiono come cursori sui livelli che leggono o modificano, con un’etichetta contornata che mostra una scintilla e un nome in codice come *Fern*. Mentre la chat trasmette JSX, il suo cursore percorre gli elementi man mano che compaiono e li contorna. Cursore e contorno hanno il colore di chi esegue l’agente, così si capisce a chi appartiene. Vengono condivisi solo nome, tipo, modello, stato, pagina, posizione e livelli modificati, mai richieste o risposte.

## Modalità di seguito

Fai clic sull’avatar di un partecipante nella barra superiore per seguire la sua inquadratura. L’area di lavoro si sposta e cambia zoom come la sua vista, e una cornice del suo colore con una barra «Stai seguendo …» indica chi stai seguendo. Per smettere, fai di nuovo clic sull’avatar, premi <kbd>Esc</kbd> oppure fai clic, scorri, cambia zoom o pagina.

I tuoi agenti, la chat AI e i client MCP come Claude Code o Cursor, vengono seguiti automaticamente mentre lavorano, così ciò che modificano resta in vista. Puoi disattivarlo con il pulsante a mirino in alto nel pannello AI. Se smetti di seguire un agente mentre lavora, non viene più seguito finché non ha finito e torna a esserlo alla sua esecuzione successiva.

Un avatar conta gli agenti eseguiti da quella persona. Passaci sopra il puntatore per vedere ogni agente, cosa sta facendo e su quale pagina, e fai clic su **Segui** accanto a un agente per tenere in vista la pagina e i livelli che sta modificando; il seguito continua tra una risposta e l’altra e termina quando l’agente se ne va. Il pulsante dopo gli avatar elenca tutti i presenti nella stanza con i rispettivi agenti e funziona anche da tastiera. Il tuo avatar elenca i tuoi agenti (fai clic su uno per rinominarlo) e contiene **Esci dalla stanza**.

Il pannello di condivisione elenca tutti i presenti nella stanza con gli agenti che eseguono, cosa fa ciascun agente e su quale pagina. Segui un agente allo stesso modo per tenere in vista la pagina e i livelli che sta modificando. Fai doppio clic su un tuo agente per rinominarlo.

## Architettura

Yjs mantiene lo stato condiviso con un CRDT. Trystero individua i partecipanti e stabilisce le connessioni WebRTC. Un server di segnalazione aiuta ad avviare la connessione, ma non trasmette il documento.

Non servono account o infrastruttura propria. La qualità dipende dalla rete e dalla possibilità di stabilire WebRTC.

## Privacy

Il contenuto non viene archiviato su un server OpenPencil. Ogni partecipante conserva una copia locale. Condividi il link solo con persone fidate.

## Terminare

Alla chiusura della sessione, partecipanti remoti e cursori vengono rimossi. Le modifiche già sincronizzate restano nel documento locale.
