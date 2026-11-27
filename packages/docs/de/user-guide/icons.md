---
pageClass: guide
title: Symbole
description: Open-Source-Symbolsätze und SF Symbols durchsuchen, Symbole einfügen und sie in OpenPencil austauschen, umfärben oder anders gestalten.
---

# Symbole

OpenPencil durchsucht die Open-Source-Symbolsätze, die über [Iconify](https://iconify.design) veröffentlicht werden, etwa Lucide, Material Symbols, Tabler und Phosphor, und in der App für Mac auch Apples SF Symbols. Ein platziertes Symbol weiß, welches Symbol es ist, sodass du es später gegen ein anderes austauschen oder seine Farbe ändern kannst, und Exporte schreiben es als dieses Symbol.

Zum Suchen und Platzieren von Symbolen brauchst du eine Netzwerkverbindung zur Iconify-API.

## Ein Symbol einfügen

Öffne die Symbolauswahl auf eine dieser Arten:

- Klicke am Ende der Werkzeugleiste auf **Symbol einfügen**.
- Wähle **Objekt → Symbol einfügen…**.
- Suche in der Befehlspalette, <Keys mac="⌘ K" other="Ctrl K" />, nach **Symbol einfügen**.

Bevor du tippst, zeigt die Auswahl die Symbole, die in dieser Datei schon platziert sind, und die, die du zuletzt gewählt hast. Tippe ein, was du suchst, etwa `arrow` oder `heart`, um alle Sätze zu durchsuchen. Zeige auf ein Symbol, um seinen Namen und Satz zu sehen.

Wähle eines aus, um es in 24 × 24 in der Mitte der Ansicht zu platzieren, und zwar in dem Rahmen, den du gerade bearbeitest, falls du einen betreten hast. Das neue Symbol ist ausgewählt, und <Keys mac="⌘ Z" other="Ctrl Z" /> entfernt es in einem Schritt.

<GuideImage name="icons/picker" alt="Die Symbolauswahl bei der Suche nach heart, mit Ergebnissen aus mehreren Symbolsätzen" />

## Einen Symbolsatz wählen

Der Satz-Button am Ende des Suchfelds (anfangs **Alle Symbolsätze**) schränkt die Auswahl auf einen Satz ein. Die Sätze sind nach Art gruppiert, etwa Material oder Logos; tippe, um einen nach Namen zu finden, etwa `tabler`. Bei jedem Satz steht, wie viele Symbole er hat.

Ist ein Satz gewählt, zeigt die Auswahl den ganzen Satz und lädt beim Scrollen weitere nach, und eine Suche durchsucht nur diesen Satz. Zeige auf ein Symbol oder geh mit den Pfeiltasten dorthin, um unter dem Raster seinen Namen, seinen Satz und seine Lizenz zu sehen. Die Auswahl merkt sich den zuletzt gewählten Satz, und **Symbol austauschen** öffnet sich mit dem Satz des Symbols, das du austauschst.

## Ein Symbol austauschen oder umfärben

Wählst du ein platziertes Symbol aus, erscheint im Design-Panel der Bereich **Symbol**.

- **Symbol austauschen** öffnet die Auswahl und zeichnet das gewählte Symbol an die Stelle des aktuellen. Das Symbol behält Größe, Position und Farbe.
- **Symbolfarbe** ändert die Farbe der eigenen Pfade des Symbols. Symbole in mehreren festen Farben, etwa Markenlogos, behalten diese Farben und zeigen dieses Feld nicht.

- **Options** erscheinen bei Symbolen aus Material Symbols und SF Symbols, die OpenPencil selbst zeichnet; siehe unten. Änderst du eine Option, wird das Symbol neu gezeichnet.

Jeder Austausch und jede Farb- oder Optionsänderung ist ein Rückgängig-Schritt; Ziehen in der Farbauswahl wird als eine einzige Änderung rückgängig gemacht.

Ein Symbol ist ein Rahmen aus Vektorpfaden, benannt nach dem Symbol, etwa `cat`, und im Ebenenbaum mit einem Smiley markiert. Anders als andere Rahmen auf der Seite hat es keinen Titel auf der Arbeitsfläche, und wenn du seine Größe änderst, werden seine Pfade skaliert. Seine Ebenen, Einschränkungen, Effekte und der Rest des Design-Panels funktionieren wie bei jedem Rahmen.

## Material Symbols anpassen

Material Symbols Outlined, Rounded und Sharp werden aus Googles variablen Schriften gezeichnet, daher sind ihre Optionen im Bereich Symbol die Achsen dieser Schriften:

- **Weight**, von 100 bis 700.
- **Fill**, 0 für Kontur oder 1 für gefüllt.
- **Grade**, von −50 bis 200; verdickt die Striche leicht, ohne die Größe des Symbols zu ändern, etwa um helle Symbole auf dunklem Hintergrund auszugleichen.
- **Optical size**, von 20 bis 48. Ein platziertes Symbol beginnt, wie von Google empfohlen, mit der optischen Größe seiner Größe, ein Symbol mit 24 × 24 also mit 24; stell sie selbst ein, um ein kleines Symbol mit den Details eines großen zu zeichnen oder umgekehrt.

## SF Symbols verwenden {#sf-symbols}

SF Symbols sind Apples Symbole. Apple lizenziert sie nur für seine eigenen Plattformen, daher liefert OpenPencil sie nie mit: macOS zeichnet sie, und sie werden nur in der [OpenPencil-App für Mac](/de/download) unter **macOS 14 Sonoma oder neuer** angeboten. Im Browser, unter Windows und Linux und unter älteren macOS-Versionen listet die Symbolauswahl SF Symbols unter Apple auf und sagt, was sie brauchen, statt sie anzuzeigen.

So verwendest du sie:

1. [Lade OpenPencil](/de/download) für macOS herunter und öffne es. Läuft auf deinem Mac ein älteres macOS, aktualisiere es zuerst unter **Systemeinstellungen → Allgemein → Softwareupdate**.
2. Öffne die Symbolauswahl, wähle im Satz-Menü **SF Symbols** und suche nach Name oder Stichwort, etwa `heart` oder `weather`.

Der Bereich Symbol bietet dann:

- **Weight**, von Ultralight bis Black, und **Scale**, klein, mittel oder groß, wie in Apples Apps.
- **Rendering**: **Monochrome** in der Symbolfarbe; **Hierarchical**, die Symbolfarbe in einigen Deckkraftstufen; **Palette**, die Symbolfarbe plus eine **Secondary color** und eine **Tertiary color** für die anderen Ebenen des Symbols; oder **Multicolor**, die eigenen Farben des Symbols, wobei die Teile, die dem Vordergrund folgen, die Symbolfarbe übernehmen.
- **Variable value**, von 0 bis 1, für Symbole, die sich in Stufen füllen, etwa `wifi` oder `speaker.wave.3`; andere Symbole ändern sich nicht.

Ein Dokument behält die Umrisse seiner SF Symbols, sodass sie überall gezeichnet werden, wo es geöffnet wird. Zum Ändern oder Austauschen eines Symbols brauchst du wieder die Mac-App; anderswo sagt der Bereich Symbol das anstelle seiner Optionen.

## Die Pfade eines Symbols bearbeiten

Du kannst die Pfade eines Symbols wie jeden Vektor bearbeiten. Sobald sich seine Punkte, Pfade oder eigenen Farben ändern, zeigt der Bereich Symbol **Geändert**:

- Das Symbol wird als die Pfade exportiert, die es jetzt zeichnet, statt über seinen Namen, sodass die Bearbeitung erhalten bleibt.
- **Zurücksetzen** (der kreisförmige Pfeil) zeichnet das ursprüngliche Symbol wieder, in derselben Größe und Farbe.
- Beim Austauschen wirst du vorher gefragt, da ein Austausch ein neues Symbol zeichnet und die Bearbeitung verwirft.

Größe oder Farbe des Symbols zu ändern zählt nicht als Bearbeitung.

**Symbol lösen**, im Bereich Symbol, im Kontextmenü der Arbeitsfläche oder unter **Objekt → Symbol lösen**, macht aus einem Symbol eine einfache Grafik: Es behält seine Pfade, wird aber nicht mehr als Symbol ausgetauscht, umgefärbt oder exportiert. Wie jeder Symbolbefehl ist es ein Rückgängig-Schritt.

## Symbole in Exporten

- **Design JSX** schreibt ein platziertes Symbol als `<Icon name="lucide:heart" size={24} color="#…" />`. Material Symbols und SF Symbols werden als die Pfade exportiert, die sie zeichnen, da ihr Name allein nicht sagt, wie sie gezeichnet wurden; um eines per Namen zu platzieren, gib `<Icon>` seine `options`, etwa <code v-pre>options={{ wght: 600, FILL: 1 }}</code>.
- **HTML** schreibt es als Inline-SVG mit der Markierung `data-icon`, mit Pfaden in `currentColor` und der Farbe des Symbols auf dem `<svg>`, sodass das Ändern dieser einen `color` es umfärbt.
- **SVG und Bilder** zeichnen es wie jeden anderen Vektor.

## Symbole in importiertem HTML

Beim Import von HTML bleiben die Symbole, die eine Seite zeichnet, Symbole, mit den eigenen Pfaden und der Farbe der Seite:

- Inline-SVG mit der Markierung `data-icon`, wie es der HTML-Export von OpenPencil schreibt, wird zu diesem Symbol.
- Anderes Inline-SVG wird zu dem Symbol aus einem beliebten Iconify-Satz, das es zeichnet, wenn es ihm nahe genug kommt: Es wird mit den Symbolen verglichen, deren Formen am nächsten liegen und die auf dieselbe Weise gezeichnet sind.
- Alles andere bleibt Grafik.

Für den Abgleich wird ein Index der beliebten Sätze heruntergeladen, etwa 2 MB, und Iconify wird nach den Vergleichssymbolen per Namen gefragt; das SVG selbst wird nie gesendet. Ohne Verbindung bleibt Inline-SVG ohne `data-icon` Grafik. Schalte das mit **Icons in importiertem HTML benennen** unter **Einstellungen → Editor** aus oder mit `--no-icon-names` bei `openpencil import`.

Symbole, die KI-Agenten, MCP-Clients und Design JSX platzieren, sind auf dieselbe Weise Symbole, daher funktioniert der Bereich Symbol auch bei ihnen.
