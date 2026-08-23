# Fonctionnalités

## Fichiers Figma

OpenPencil ouvre et enregistre directement les fichiers `.fig`. L’import et l’export utilisent le même codec binaire Kiwi que Figma : 194 définitions de schéma et environ 390 champs par objet. Enregistrer : <kbd>⌘</kbd><kbd>S</kbd>. Enregistrer sous : <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Copier et coller avec Figma :** sélectionnez des objets dans Figma, appuyez sur <kbd>⌘</kbd><kbd>C</kbd>, passez à OpenPencil puis utilisez <kbd>⌘</kbd><kbd>V</kbd>. Remplissages, contours, disposition automatique, texte, effets, rayons des coins et réseaux vectoriels sont conservés dans les deux sens.

## Dessin et édition

- **Formes :** rectangle (<kbd>R</kbd>), ellipse (<kbd>O</kbd>), ligne (<kbd>L</kbd>), polygone et étoile.
- **Plume :** réseaux vectoriels, courbes de Bézier et poignées tangentes.
- **Texte :** édition directe sur le canevas et prise en charge des IME.
- **Texte enrichi :** gras, italique, souligné et barré sur des plages de caractères.
- **Disposition automatique :** Flexbox et CSS Grid via Yoga WASM, avec direction, espacement, marges internes, distribution, alignement, dimensionnement et pistes de grille.
- **Composants :** création de composants et d’ensembles, instances, substitutions et synchronisation.
- **Variables :** jetons de design organisés en collections et modes, avec les types Color, Float, String et Boolean et des liaisons.
- **Sections :** conteneurs d’organisation qui intègrent automatiquement les objets superposés.

## Panneau de propriétés

Les onglets Design, Code et AI s’adaptent à la sélection :

- **Apparence :** opacité, rayon uniforme ou par coin et visibilité.
- **Remplissage :** couleur unie, dégradés linéaire, radial, angulaire et diamant, et images.
- **Contour :** couleur, épaisseur, alignement, épaisseur par côté, extrémités, jointures et tirets.
- **Effets :** ombre portée et intérieure, flou de calque, d’arrière-plan et de premier plan.
- **Typographie :** choix de police avec recherche et défilement virtuel, style, taille, alignement et mise en forme.
- **Disposition :** réglages de la disposition automatique.
- **Export :** échelle, PNG/JPG/WEBP/SVG et aperçu.

## Rendu

OpenPencil utilise Skia via CanvasKit WASM, le même moteur graphique que Figma :

- dégradés linéaires, radiaux, angulaires et diamant ;
- remplissages d’image avec plusieurs modes d’échelle ;
- cache des effets par objet ;
- arcs, ellipses partielles et anneaux ;
- exclusion des objets hors champ et réutilisation des outils de peinture ;
- guides d’accrochage tenant compte de la rotation ;
- règles avec plage de sélection ;
- surbrillance suivant la géométrie réelle.

## Annuler et rétablir

La création, la suppression, les déplacements, le redimensionnement, les propriétés et la hiérarchie, la disposition et les variables peuvent être annulés. Raccourcis : <kbd>⌘</kbd><kbd>Z</kbd> et <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Pages et documents

Vous pouvez créer, supprimer et renommer des pages ; chacune conserve sa position et son échelle d’affichage. Plusieurs documents peuvent être ouverts dans des onglets.

## Export

- **Images :** PNG, JPG et WEBP de 0,5× à 4×.
- **SVG :** formes, texte avec plages de style, dégradés, effets et modes de fusion.
- **Tailwind JSX :** HTML avec classes Tailwind v4 pour React ou Vue.
- **Copier comme :** texte, SVG, PNG ou JSX depuis le menu contextuel.

```sh
openpencil export design.fig -f jsx --style tailwind
```

## Chat AI

<kbd>⌘</kbd><kbd>J</kbd> ouvre l’assistant. Plus de 90 outils créent des formes, modifient styles et dispositions, travaillent avec les composants et variables, exécutent des opérations booléennes, analysent les jetons de design et exportent des ressources. Anthropic, OpenAI, Google AI, OpenRouter et les points d’accès compatibles sont pris en charge.

Les appels d’outils apparaissent sur une chronologie repliable. Pour vérifier les modifications, l’assistant rend le résultat et le compare à la demande. Toutes les modifications réalisées par l’AI peuvent être annulées.

## Serveur MCP

Claude Code, Cursor, Windsurf et les autres clients MCP peuvent lire et modifier des fichiers `.fig` grâce à plus de 90 outils. stdio et HTTP sont disponibles.

```sh
npm install -g @open-pencil/mcp
```

## CLI

La CLI examine, exporte et analyse les fichiers `.fig` :

```sh
openpencil tree design.fig              # Arbre du document
openpencil find design.fig --type TEXT  # Recherche
openpencil export design.fig -f png     # Export
openpencil analyze colors design.fig    # Analyse des couleurs
openpencil analyze clusters design.fig  # Structures répétées
openpencil eval design.fig -c "..."     # Figma Plugin API
```

Toutes les commandes acceptent `--json`. Installation : `npm install -g @open-pencil/cli` ou `bun add -g @open-pencil/cli`.

## Collaboration en temps réel

La collaboration fonctionne directement entre participants via WebRTC et ne nécessite aucun serveur central. Il suffit de partager un lien. Elle comprend les curseurs, la présence et le suivi de la vue d’un autre participant.

## Bureau et Web

**Bureau :** Tauri v2, environ 7 Mo, pour macOS, Windows et Linux, avec menus natifs, fonctionnement hors ligne et enregistrement automatique.

**Web :** [app.openpencil.dev](https://app.openpencil.dev), installable comme PWA et adapté aux écrans tactiles.

## Chargement de secours depuis Google Fonts

Si une police n’est pas disponible localement, OpenPencil la télécharge automatiquement depuis Google Fonts. Aucune installation manuelle n’est nécessaire.
