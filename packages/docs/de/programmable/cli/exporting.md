---
title: Export mit der CLI
description: PNG, JPG, WEBP, SVG, `.fig`, JSX, HTML und Storybook-Stories exportieren oder Dokumentformate umwandeln.
---

# Export mit der CLI

Die CLI exportiert Rasterbilder, SVG, Teile eines Dokuments als `.fig`, JSX, HTML und Storybook-Stories.

## Formate

```sh
openpencil export design.fig                           # PNG
openpencil export design.fig -f jpg -s 2 -q 90        # JPG mit 2×
openpencil export design.fig -f svg                   # SVG
openpencil export design.fig -f fig --page "Page 1"   # Seite als .fig
openpencil export design.fig -f html --css tailwind    # HTML mit Tailwind-Klassen
```

`-f` wählt das Format (`png`, `jpg`, `webp`, `svg`, `pdf`, `pptx`, `jsx`, `html`, `fig`, `storybook`), `-s` den Maßstab, `-q` die Qualität und `-o` den Ausgabepfad. `--page` und `--node` begrenzen den Export.

## JSX

```sh
openpencil export design.fig -f tailwind-jsx    # oder: -f jsx --style tailwind
```

`--style openpencil` erzeugt das native JSX-Format des [JSX-Renderers](../jsx-renderer).

## HTML

```sh
openpencil export design.fig -f html
openpencil export design.fig -f html --css tailwind
openpencil export design.fig -f html --html standalone --assets external
```

Der eigenständige HTML-Export wird sofort mit Tailwind kompiliert und benötigt keine Browser-Laufzeit. `--assets external` schreibt CSS und Bilder neben die HTML-Datei. `--fonts assets` speichert aufgelöste Webschriften als lokale `@font-face`-Dateien.

Der HTML-Export dient Übergabe und Weiterverarbeitung, nicht als pixelgenauer Ersatz für die Darstellung auf der Arbeitsfläche.

## Storybook

Erzeugt pro Komponentensatz oder Komponente eine CSF3-Datei `.stories.ts`:

```sh
openpencil export design.fig -f storybook                      # React-Stories in ./design-stories/
openpencil export design.fig -f storybook --framework vue -o src/stories
openpencil export design.fig -f storybook --framework html --page "Components"
openpencil export design.pen -f storybook -o src/stories --watch  # bei jedem Speichern neu exportieren
openpencil export 'src/**/*.pen' -f storybook --beside --watch    # Stories neben jedem Design
```

### Designs neben ihren Stories

Legen Sie die Designdatei jeder Komponente in den Ordner der Komponente und exportieren Sie mit `--beside`: Die Stories, Designbilder und das Manifest `.openpencil-stories.json` jedes Dokuments landen im eigenen Ordner dieses Dokuments, neben dem Code der Komponente. Ein Storybook-`stories`-Glob wie `../src/**/*.stories.ts` in `.storybook/main.ts` erfasst sie dann ohne weitere Konfiguration.

Sie können mehrere Dokumente übergeben oder einen Glob in Anführungszeichen wie `'src/**/*.pen'`, den OpenPencil selbst auflöst (Node.js 22 oder neuer). Mehrere Dokumente erfordern `--beside` oder `--output`; `--page` funktioniert nur mit einem Dokument. Die Dokumente werden nacheinander exportiert, und schlägt eines fehl, werden die übrigen trotzdem exportiert, bevor der Befehl mit einem Fehler endet. `--watch` beobachtet jedes passende Dokument; ein Dokument, das nach dem Start der Beobachtung entsteht, erfordert einen neuen Lauf.

Jede Variante eines Komponentensatzes wird zu einer Story, und ihre Variantenmerkmale werden zu `select`-Controls, sodass das Umschalten eines Controls die passende Variante zeigt. Ein Satz mit Verhalten erhält stattdessen die Props des Controls: ein Switch oder eine Checkbox ein boolesches `checked`, ein Toggle `pressed`, ein Collapsible `open` und `disabled`, wenn der Satz einen deaktivierten Zustand zeichnet; Hover, Pressed und Fokus bleiben eigene Storys. Eigenständige Komponenten mit Schrägstrich im Namen, etwa `Button/Primary` und `Button/Secondary`, werden in einer `Button`-Datei mit einem `Variant`-Control zusammengefasst. Eine Kombination, für die das Design keine Variante hat, löst in Storybook einen benannten Fehler aus, statt eine andere Variante zu zeigen.

Die Stories rendern die Komponente wie `-f html` als HTML mit Inline-Stilen und benötigen daher keine OpenPencil-Laufzeit; `--framework` (`react`, `vue` oder `html`) ändert nur den Wrapper und den Import von `Meta`/`StoryObj` aus `@storybook/react-vite`, `@storybook/vue3-vite` oder `@storybook/html-vite`. Text verwendet die Schriftfamilien des Dokuments, die Storybook selbst laden muss. Text-, Boolean- und Instanztausch-Eigenschaften werden noch nicht exportiert.

Die Stories enthalten `parameters.design`-Einträge für [`@storybook/addon-designs`](https://github.com/storybookjs/addon-designs):

- **OpenPencil:** Liegt der Dokumentpfad im aktuellen Verzeichnis, ein [`openpencil://`-Link](../index#url-scheme), der das Dokument in der Desktop-Anwendung öffnet und die Variante auswählt, oder ihren Komponentensatz, wenn eine andere Ebene den Namen der Variante trägt. Das Schema adressiert Ebenen über ihren Namen; eine Story, deren Varianten- und Komponentenname beide von anderen Ebenen geteilt werden, erhält keinen Link.
- **Design:** ein PNG der Variante in 2×, das neben der Story in `<Name>.design/` abgelegt und mit `new URL(…, import.meta.url)` referenziert wird, sodass Vite es bündelt. Kopieren Sie den Parameter in die Story Ihrer eigenen Komponente, um die Implementierung mit dem Design zu vergleichen. `--no-design-images` überspringt das Rendern; die Schriftersetzung folgt wie beim Rasterexport `--font-policy`.

`-o` benennt das Ausgabeverzeichnis. Ein dortiges Manifest `.openpencil-stories.json` hält fest, welches Dokument (als Pfad relativ zum Ausgabeverzeichnis) und welche Seite jede Story und jedes Designbild erzeugt hat; checken Sie es zusammen mit den Stories ein. Ein Export ersetzt die Dateien, die ein früherer Export desselben Dokuments dort erzeugt hat, auch die inzwischen gelöschter oder umbenannter Komponenten; mit `--page` nur die dieser Seite. Er weigert sich, bevor etwas geändert wird, jede andere Datei zu überschreiben – eine handgeschriebene Story, die eines anderen Dokuments oder ein verirrtes Bild. Ein Export einer einzelnen Seite, dessen Dateinamen auf die Stories einer anderen Seite verschoben wurden, verlangt stattdessen einen vollständigen Export. Ohne das Manifest gelten vorhandene Stories als fremd, entfernen Sie sie daher vor einem erneuten Export. `--watch` hält den Befehl am Laufen und exportiert bei jedem Speichern des Dokuments neu, sodass das Hot Reload von Storybook dem Design folgt; ein Speicherstand, der nicht gelesen werden kann, wird gemeldet, und die Beobachtung läuft weiter. Ein fehlendes `--page` oder eine Ersetzung bei `--font-policy strict` beendet den Befehl dennoch.

## Laufende Anwendung

Ohne Dateiargument exportiert die CLI aus der laufenden Anwendung:

```sh
openpencil export -f png                       # Auswahl im aktiven Dokument exportieren
openpencil export --page "Components" -f png   # alle Ebenen einer Seite exportieren
openpencil export --node 1:23 -f png           # eine Ebene auf einer beliebigen Seite exportieren
```

`--page` nimmt einen Seitennamen und `--page-id` eine Seiten-ID aus `openpencil documents list`; beide exportieren diese Seite, ohne die Anwendung zu ihr zu wechseln. Mit `--document-id` exportieren Sie aus einem anderen als dem aktiven Dokument.

Dieser Modus unterstützt PNG, JPG, WEBP, SVG und PDF. PowerPoint, JSX, HTML, Storybook und `.fig` erfordern ein Dateiargument.
