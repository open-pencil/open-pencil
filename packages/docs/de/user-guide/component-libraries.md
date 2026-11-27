---
pageClass: guide
title: Komponentenbibliotheken
description: Komponenten, Stile und Variablen aus einer Datei veröffentlichen, in anderen Dateien verwenden und ihre Aktualisierungen übernehmen.
---

# Komponentenbibliotheken

Eine Bibliothek teilt die Komponenten, Stile und Variablen einer Datei mit deinen anderen Dateien. Jedes Mal, wenn du veröffentlichst, speichert sie eine neue Version. Dateien, die die Bibliothek verwenden, entscheiden selbst, wann sie diese übernehmen.

## Eine Bibliothek veröffentlichen

1. Öffne die Datei mit den Komponenten, die du teilen willst.
2. Öffne **Elemente** und klicke dann neben dem Suchfeld auf **Bibliotheken verwalten**.
3. Klicke auf **Bibliothek veröffentlichen**.
4. Gib der Bibliothek beim ersten Mal eine ID und einen Namen. Die ID lässt sich später nicht mehr ändern.
5. Hake die Änderungen an, die du veröffentlichen willst, und füge bei Bedarf eine Beschreibung hinzu.
6. Klicke auf **Bibliothek veröffentlichen**.

<GuideImage name="component-libraries/publish" alt="Bibliothek veröffentlichen mit der ID acme-ui, dem Namen Acme UI und angehakter Komponente Button" />

Eine Bibliothek enthält immer jeden Stil und jede Variablensammlung der Datei. Änderungen, die du nicht anhakst, warten aufs nächste Mal.

## Eine Bibliothek verwenden

1. Öffne in der Datei, die sie braucht, **Elemente → Bibliotheken verwalten**.
2. Schalte die Bibliothek unter **Bibliotheken durchsuchen** ein.
3. Platziere ihre Komponenten aus **Elemente** genauso wie deine eigenen.

Eine Komponente bringt die Stile und Variablen mit, die sie verwendet. Sie lassen sich hier nicht bearbeiten: Ändere sie in der Datei der Bibliothek und veröffentliche erneut. Instanzen bleiben wie alle anderen bearbeitbar.

## Auf eine neue Version aktualisieren

Öffne **Bibliotheken verwalten → Aktualisierungen**, um zu sehen, was sich geändert hat. In deiner Datei ändert sich nichts, bis du dich entscheidest.

1. Vergleiche eine Instanz vor und nach der Aktualisierung.
2. Aktualisiere die ausgewählte Instanz, jede Instanz dieser Komponente, die Instanzen auf dieser Seite oder alle.

Instanzen behalten die Änderungen, die du an ihnen vorgenommen hast, auch an Ebenen, die die Bibliothek umbenannt hat. Sie verlieren nur Änderungen an Ebenen, die die Bibliothek entfernt hat. Fehlt die Variante einer Instanz in der neuen Version, zeigt die Übersicht, auf welche Variante sie ausweicht. **Rückgängig** nimmt eine Aktualisierung zurück.

## Wo Bibliotheken liegen

**Lokal**-Bibliotheken bleiben in diesem Browser oder dieser App. **Speicher**-Bibliotheken liegen in dem [S3-kompatiblen Bucket](./cloud-storage), den du eingerichtet hast, sodass andere sie verwenden können. Oben unter **Bibliotheken durchsuchen** wechselst du zwischen beiden.

Versionen, die du verwendet hast, werden auf deinem Computer aufbewahrt, sodass ihre Komponenten auch offline angezeigt und platziert werden können. Eine Datei behält beim Speichern die Bibliotheksversionen, die sie verwendet, und öffnet sich genauso, auch wenn die Bibliothek nicht erreichbar ist.
