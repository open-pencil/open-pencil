---
title: Collaborazione
description: Editing collaborativo in tempo reale tramite P2P WebRTC — nessun server, nessun account.
---

# Collaborazione

Modifica i design insieme in tempo reale. I peer si connettono direttamente — nessun server trasmette i tuoi dati, nessun account richiesto.

## Condivisione di una Stanza

1. Clicca il pulsante di condivisione nell'angolo in alto a destra
2. Copia il link generato (`app.openpencil.dev/share/<room-id>`)
3. Invialo ai tuoi collaboratori

Chiunque abbia il link può partecipare. La stanza rimane attiva finché almeno un partecipante ha la pagina aperta.

## Cosa si Sincronizza

- **Modifiche al documento** — ogni modifica (forme, testo, proprietà, layout) si sincronizza istantaneamente
- **Cursori** — vedi dove sta puntando ciascun collaboratore, con il suo nome e colore
- **Selezioni** — le selezioni evidenziate sono visibili a tutti

## Modalità Follow

Clicca l'avatar di un collaboratore nella barra superiore per seguire il suo viewport. Il tuo canvas si sposta e zooma per corrispondere alla sua vista. Clicca di nuovo per smettere di seguire.

## Come Funziona

I peer si connettono direttamente tramite WebRTC — i dati del tuo design vanno dritti da browser a browser, senza mai passare per un server centrale. Lo stato del documento usa un CRDT (tipo di dato replicato senza conflitti), quindi le modifiche concorrenti si uniscono automaticamente senza conflitti.

La stanza persiste localmente — se aggiorni la pagina, ti riconnetti con lo stesso stato.

## Suggerimenti

- Funziona nel browser e nell'app desktop
- Gli ID delle stanze sono crittograficamente casuali — solo chi ha il link può partecipare
- I cursori inattivi vengono rimossi automaticamente quando qualcuno si disconnette
