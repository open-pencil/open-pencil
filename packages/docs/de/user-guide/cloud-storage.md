---
pageClass: guide
title: Cloud-Speicher
description: Dokumente und Komponentenbibliotheken in deinem eigenen S3-kompatiblen Bucket aufbewahren — AWS S3, Backblaze B2, Cloudflare R2, MinIO und andere.
---

# Cloud-Speicher

OpenPencil kann Dokumente in einem Bucket aufbewahren, der dir gehört, bei jedem S3-kompatiblen Dienst: AWS S3, Backblaze B2, Cloudflare R2, MinIO und anderen. Dazwischen steht kein OpenPencil-Server; der Editor spricht mit deinen eigenen Zugriffsschlüsseln direkt mit deinem Bucket.

## Einen Bucket verbinden

Öffne **Einstellungen → Speicher**, wähle **S3-Speicher** und fülle Folgendes aus:

| Feld                  | Was du eingibst                                                                   |
| --------------------- | --------------------------------------------------------------------------------- |
| **Endpunkt**          | Die S3-API-URL des Anbieters, einschließlich eines erforderlichen Pfads. Siehe die Beispiele unten. |
| **Bucket**            | Der Name des Buckets.                                                             |
| **Region**            | Optional. Bleibt das Feld leer, wird die Region aus dem Endpunkt gelesen, oder es gilt `us-east-1`, wenn das nicht geht. |
| **Zugriffsschlüssel-ID** | Ein Zugriffsschlüssel mit Lese-, Schreib-, Auflistungs- und Löschzugriff auf den Bucket. |
| **Geheimer Zugriffsschlüssel** | Das Geheimnis des Schlüssels.                                            |

Beispiele für Endpunkte:

- AWS S3: `https://s3.eu-west-1.amazonaws.com`
- Backblaze B2: `https://s3.eu-central-003.backblazeb2.com`
- Cloudflare R2: `https://<account-id>.r2.cloudflarestorage.com`
- MinIO: `http://localhost:9000` oder wo auch immer dein Server lauscht

Wähle **Verbindung testen**, um Endpunkt, Schlüssel und Bucket vor dem Speichern zu prüfen, und dann **Speichern**. OpenPencil hängt den Bucket selbst an den Endpunkt an, als `{endpoint}/{bucket}/{key}`, lass den Bucket-Namen also aus dem Endpunkt weg.

In der Desktop-App werden Zugriffsschlüssel im Anmeldedatenspeicher des Systems aufbewahrt. Im Browser werden sie verschlüsselt im Browserspeicher abgelegt oder nur bis zum Ende der Sitzung behalten, wenn **Einstellungen → Allgemein → API-Schlüssel auf diesem Gerät speichern** ausgeschaltet ist.

## Die Web-App in CORS zulassen

Der Browser kann einen Bucket nur erreichen, wenn dieser Anfragen vom Ursprung der Seite zulässt, daher braucht die Web-App eine CORS-Regel auf dem Bucket. Die Desktop-App sendet ihre Anfragen nativ und braucht keine.

Füge eine Regel wie diese hinzu, mit den Ursprüngen, von denen aus du OpenPencil öffnest:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://cloud.openpencil.dev"],
    "ExposeHeaders": ["ETag", "Content-Range", "x-amz-request-id", "x-amz-id-2", "x-amz-version-id"],
    "MaxAgeSeconds": 3600
  }
]
```

Die Web-App zieht von app.openpencil.dev nach cloud.openpencil.dev um: Bei einer Regel, die für die alte Adresse eingerichtet wurde, muss die neue ergänzt werden. Lege sie in der AWS-Konsole unter **Permissions → Cross-origin resource sharing** des Buckets fest, im Cloudflare-Dashboard unter **Settings → CORS policy** des R2-Buckets oder mit der CLI deines Anbieters. Fehlt die Regel, meldet **Verbindung testen**, dass der Browser den Bucket von der aktuellen Website aus nicht erreichen konnte.

## Ein Dokument im Speicher sichern

Öffne oder erstelle ein Dokument und wähle dann **Datei → Speichern in…**. Gibt es keinen Cloud-Arbeitsbereich zur Auswahl, wird das Dokument direkt im Bucket gespeichert; andernfalls wählst du den Bucket aus der Liste. Der Tab bleibt daran gebunden: **Speichern** und das automatische Speichern schreiben jetzt in den Speicher statt in eine lokale Datei. Eine lokale `.fig`-Datei, die du offen hattest, behält ihren zuletzt gespeicherten Inhalt.

Um gespeicherte Dokumente zu öffnen, wähle deinen Bucket in der Seitenleiste der Startseite. **Neues Design** legt bei ausgewähltem Bucket darin ein Dokument an. Die Startseite listet jedes Dokument im Bucket mit einer Vorschau auf, die aus dem Dokument selbst gelesen wird, sodass beim Auflisten einer großen Datei nur ihr eingebettetes Vorschaubild heruntergeladen wird.

## Wie das Speichern funktioniert

Beim Speichern wird das Dokument zuerst auf diesem Gerät geschrieben und im Hintergrund hochgeladen, sodass das Bearbeiten nie auf das Netzwerk wartet. Schlägt ein Upload fehl oder bist du offline, wird er mit wachsenden Abständen wiederholt, und ausstehende Arbeit wird fortgesetzt, sobald du wieder verbunden bist oder die Speichereinstellungen änderst.

Jedes Dokument wird als Ganzes hochgeladen. Speichern zwei Geräte dasselbe Dokument, gewinnt der letzte Upload.

Dokumente, die du geöffnet hast, bleiben für ein schnelleres erneutes Öffnen auf dem Gerät zwischengespeichert, bis zu 500 MB. Ist der Zwischenspeicher voll, werden nur vollständig hochgeladene Kopien entfernt, und sie werden beim nächsten Öffnen erneut heruntergeladen.

## Komponentenbibliotheken

Der Bucket kann auch Komponentenbibliotheken enthalten. Stelle unter **Elemente → Bibliotheken verwalten** die Quelle auf **Speicher** um, um Bibliotheken dort statt auf diesem Gerät zu veröffentlichen und einzuschalten. Das Veröffentlichen nutzt bedingte Schreibvorgänge, sodass zwei Personen, die gleichzeitig dieselbe Bibliothek veröffentlichen, nicht gegenseitig ihre Revision überschreiben können. Wie du Bibliotheken veröffentlichst und aktualisierst, steht unter [Komponentenbibliotheken](./component-libraries).

## Was im Bucket liegt

OpenPencil schreibt nur unter zwei Präfixen und lässt alles andere im Bucket unangetastet:

- `open_pencil_storage/canvases/` — jedes Dokument als `<id>.fig`, mit seinem Namen und seiner Änderungszeit in `<id>.meta.json`.
- `open-pencil/libraries/` — die `manifest.json` jeder Bibliothek und ihre veröffentlichten Revisionen.

## Hinweise zu Anbietern

- **Cloudflare R2** braucht in seiner CORS-Regel den exakten Ursprung der Web-App; Platzhalter-Ursprünge wie `https://*.example.com` akzeptiert es nicht.
- **MinIO** beantwortet CORS-Anfragen von jedem Ursprung, sofern du es nicht anders konfigurierst.
- **`rclone serve s3`** funktioniert mit zwei Einschränkungen. Es lehnt CORS-Preflight-Anfragen ab, daher braucht die Web-App einen vorgeschalteten Reverse Proxy, der sie beantwortet; die Desktop-App nicht. Außerdem ignoriert es bedingte Schreibvorgänge, sodass gleichzeitige Veröffentlichungen einer Bibliothek nicht erkannt werden.
