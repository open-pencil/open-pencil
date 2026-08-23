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

Exportiertes JSX kann als Code verändert und erneut gerendert werden. Unterschiede können in Pull Requests geprüft und in der Versionsverwaltung gespeichert werden.
