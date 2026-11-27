---
pageClass: guide
title: Exportation
description: Enregistrez des calques en images, en PDF ou en diapositives, ou copiez-les dans une autre application.
---

# Exportation

Enregistrez un calque dans un fichier, ou copiez-le directement dans une autre application. Pour continuer à travailler sur un design plus tard, [enregistrez plutôt le document](./files).

## Exporter un calque

1. Sélectionnez un ou plusieurs calques. Si rien n’est sélectionné, vous exportez la page.
2. Dans le panneau **Design**, cliquez sur **+** à côté de **Export**.
3. Choisissez une taille et un format.
4. Cliquez sur **Export**.

<GuideLegend>

<GuideImage name="exporting/panel" alt="Les réglages d’export avec quatre commandes numérotées" />

1. **Mettre à l’échelle** définit la taille de l’image. Choisissez une valeur ou saisissez la vôtre, comme `2.5`.
2. **Format** définit le type de fichier.
3. **Export** enregistre chaque ligne dans un fichier. Plusieurs fichiers arrivent dans un seul ZIP.
4. **Aperçu** montre ce que vous allez obtenir.

</GuideLegend>

Pour obtenir un calque en plusieurs tailles, cliquez de nouveau sur **+**. Chaque nouvelle ligne double l’échelle de la précédente.

## Choisir un format

| Pour | Utilisez |
| --- | --- |
| Captures d’écran et images avec transparence | PNG |
| Photos, quand la transparence n’a pas d’importance | JPG |
| Images plus légères pour le web | WEBP |
| Icônes et illustrations qui restent nettes à toutes les tailles | SVG |
| Impression et partage de pages | PDF |
| Présentations | PPTX |
| Diagrammes | draw.io |

L’échelle ne s’applique qu’aux formats PNG, JPG et WEBP.

**Fichier → Exporter la sélection** enregistre aussi un fichier `.fig` contenant uniquement les calques sélectionnés.

## Copier dans une autre application

Faites un clic droit sur un calque et choisissez **Copier/Coller en tant que**.

<GuideLegend>

<GuideImage name="exporting/copy-as" other="exporting/copy-as-other" alt="Le menu Copier/Coller en tant que" />

- **Copier en PNG** sert pour les discussions et les documents. Appuyez sur <Keys mac="⇧ ⌘ C" other="Ctrl Shift C" />.
- **Copier en SVG** sert pour le code et les éditeurs vectoriels.
- **Copier en JSX** sert pour le code.
- **Copier en texte** copie le texte d’un calque de texte.

</GuideLegend>
