---
title: JSX-Renderer
description: Designs deklarativ mit JSX erstellen und als JSX oder HTML mit Tailwind exportieren.
---

# JSX-Renderer

OpenPencil kann einen Designbaum aus JSX erstellen. Die deklarative Syntax eignet sich für AI-Agenten, Skripte und wiederholbare Erzeugung von Oberflächen.

JSX dient außerdem als lesbare Darstellung eines vorhandenen Designs. Änderungen erscheinen als gewöhnlicher Codevergleich und lassen sich prüfen und versionieren.

## Design erstellen

Das Werkzeug `render`, verfügbar in AI-Chat, MCP und CLI `eval`, akzeptiert JSX:

```jsx
<Frame name="Card" w={320} h="hug" flex="col" gap={16} p={24} bg="#FFF" rounded={16}>
  <Text size={18} weight="bold">Card Title</Text>
  <Text size={14} color="#666">Description text</Text>
</Frame>
```

In Anwendungs- oder Headless-Bibliothekscode importieren Sie `Frame`, `Text` und weitere Authoring-Exporte aus `@open-pencil/design-jsx` und erzeugen die Objekte mit `renderTree` oder `renderJSX` aus `@open-pencil/core/design-jsx`, die Icons, SVG-Umwandlung und Layout ergänzen. Um die Bäume als TSX zu schreiben, setzen Sie in der `tsconfig.json` `"jsxImportSource": "@open-pencil/design-jsx"` zusammen mit `"jsx": "react-jsx"` oder fügen der Datei den Kommentar `/** @jsxImportSource @open-pencil/design-jsx */` hinzu. Welche APIs `eval` bereitstehen, bestimmt die Skriptumgebung; Paket-Exporte sind dort nicht automatisch global verfügbar.

## Elemente

JSX-Elemente wie `<Frame>`, `<Rectangle>`, `<Ellipse>`, `<Text>`, `<Line>`, `<Vector>`, `<Group>` und `<Section>` erzeugen die entsprechenden OpenPencil-Objekte.

## Eigenschaften

Die Eigenschaftsnamen bleiben Teil der JSX-API:

- `flex`, `gap`, `wrap`, `justify`, `items` und `p*` steuern Anordnung und Abstände;
- `w`, `h`, `x`, `y` und die Min-/Max-Werte steuern Größe und Position;
- `bg`, `stroke`, `rounded`, `opacity`, `shadow`, `blur` und `blendMode` steuern die Darstellung;
- `fontFamily`, `fontSize`, `fontWeight`, `color` und `textAlign` steuern die Typografie.

## Export

```sh
openpencil export design.fig -f jsx
openpencil export design.fig -f jsx --style tailwind
```

Exportiertes JSX kann als Code verändert und erneut gerendert werden. Der Export schreibt ausgeblendete und gesperrte Ebenen, Constraints, Größenbegrenzungen, gestapelte Füllungen, Verlaufs- und Bildfüllungen, Konturen, Effekte, Masken und Variablenbindungen. Das erneute Rendern eines Exports bildet sie daher nach, und `diff_jsx` zeigt Änderungen an jedem davon. Rich Text mit gemischten Stilen, Vektorpfade, Layoutraster, geteilte Stile und Definitionen von Komponenteneigenschaften werden noch nicht geschrieben. Instanzen werden als Rahmen mit ihrem Inhalt geschrieben, sodass exportiertes JSX für sich allein steht. Unterschiede können in Pull Requests geprüft und in der Versionsverwaltung gespeichert werden.
