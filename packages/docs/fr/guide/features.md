# Fonctionnalités

## Fichiers .fig Figma

Ouvrez et enregistrez les fichiers natifs Figma directement. Le pipeline d'import/export utilise le même codec binaire Kiwi que Figma — 194 définitions de schéma, ~390 champs par nœud. Enregistrer avec <kbd>⌘</kbd><kbd>S</kbd>, Enregistrer sous avec <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Copier-coller avec Figma** — sélectionnez des nœuds dans Figma, <kbd>⌘</kbd><kbd>C</kbd>, passez à OpenPencil, <kbd>⌘</kbd><kbd>V</kbd>. Les remplissages, contours, auto-layout, texte, effets, rayons de coins et réseaux vectoriels sont préservés. Fonctionne dans les deux sens.

## Dessin et édition

- **Formes** — Rectangle (<kbd>R</kbd>), Ellipse (<kbd>O</kbd>), Ligne (<kbd>L</kbd>), Polygone, Étoile
- **Outil plume** — réseaux vectoriels (pas de simples chemins), courbes de Bézier avec poignées de tangente
- **Texte** — édition native sur le canevas avec support IME, double-clic pour entrer en mode édition
- **Texte riche** — gras (<kbd>⌘</kbd><kbd>B</kbd>), italique (<kbd>⌘</kbd><kbd>I</kbd>), souligné (<kbd>⌘</kbd><kbd>U</kbd>), barré par caractère
- **Auto-layout** — flexbox via Yoga WASM : direction, gap, padding, justify, align, dimensionnement des enfants. <kbd>⇧</kbd><kbd>A</kbd> pour activer/désactiver
- **Composants** — créer (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>), ensembles de composants (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>), instances avec support des surcharges, synchronisation en direct
- **Variables** — tokens de design avec collections, modes (Clair/Sombre), types couleur/nombre/chaîne/booléen, liaison de variables
- **Sections** — conteneurs organisationnels avec adoption automatique des enfants et pilules de titre

## Panneau de propriétés

Onglets contextuels Design | Code | IA :

- **Apparence** — opacité, rayon de coin (uniforme ou par coin), visibilité
- **Remplissage** — solide, dégradé (linéaire/radial/angulaire/diamant), image
- **Contour** — couleur, épaisseur, alignement (intérieur/centre/extérieur), épaisseurs par côté, extrémité, jointure, tirets
- **Effets** — ombre portée, ombre intérieure, flou de calque, flou d'arrière-plan, flou de premier plan
- **Typographie** — sélecteur de polices avec défilement virtuel et recherche, graisse, taille, alignement, boutons de style
- **Layout** — contrôles d'auto-layout lorsqu'activé
- **Export** — échelle, format (PNG/JPG/WEBP/SVG), aperçu en direct

## Rendu

Skia (CanvasKit WASM) — le même moteur de rendu que Figma :

- Remplissages dégradés (linéaire, radial, angulaire, diamant)
- Remplissages d'images avec modes de mise à l'échelle
- Effets avec cache par nœud
- Données d'arc (ellipses partielles, anneaux)
- Culling de viewport et réutilisation de Paint
- Guides d'accrochage avec alignement tenant compte de la rotation
- Règles du canevas avec badges de sélection
- Surbrillance au survol suivant la géométrie réelle

## Annuler/Rétablir

Chaque opération est annulable — création, suppression, déplacements, redimensionnements, changements de propriétés, re-parentage, changements de layout, opérations sur les variables. Utilise un patron de commande inverse. <kbd>⌘</kbd><kbd>Z</kbd> / <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Documents multi-pages

Ajouter, supprimer, renommer des pages. Chaque page a un état de viewport indépendant. Double-clic pour renommer en ligne.

## Onglets multi-fichiers

Ouvrez plusieurs documents en onglets. <kbd>⌘</kbd><kbd>T</kbd> nouvel onglet, <kbd>⌘</kbd><kbd>W</kbd> fermer, <kbd>⌘</kbd><kbd>O</kbd> ouvrir un fichier.

## Export

- **Image** — PNG, JPG, WEBP à échelle configurable (0,5×–4×). Via le panneau, le menu contextuel ou <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>
- **SVG** — formes, texte avec style runs, dégradés, effets, modes de fusion
- **Tailwind JSX** — HTML avec classes utilitaires Tailwind v4, prêt pour React ou Vue
- **Copier en tant que** — texte, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), ou JSX via le menu contextuel

CLI : `open-pencil export design.fig -f jsx --style tailwind`

## Chat IA

Appuyez sur <kbd>⌘</kbd><kbd>J</kbd> pour ouvrir l'assistant IA. 87 outils qui peuvent créer des formes, définir des styles, gérer le layout, travailler avec les composants et variables, exécuter des opérations booléennes, analyser les tokens de design et exporter des assets. Apportez votre propre clé API OpenRouter.

Les appels d'outils s'affichent comme des entrées de chronologie dépliables. Sélecteur de modèle avec Claude, Gemini, GPT, DeepSeek et d'autres.

## Serveur MCP

Connectez Claude Code, Cursor, Windsurf ou tout client MCP pour lire et écrire des fichiers `.fig` en mode headless. 90 outils (87 core + 3 gestion de fichiers). Deux transports : stdio et HTTP.

```sh
bun add -g @open-pencil/mcp
```

```json
{
  "mcpServers": {
    "open-pencil": {
      "command": "openpencil-mcp"
    }
  }
}
```

Voir la [référence des outils MCP](/programmable/mcp-server) pour la liste complète.

## CLI

Inspectez, exportez et analysez les fichiers `.fig` depuis le terminal :

```sh
open-pencil tree design.fig          # Arbre de nœuds
open-pencil find design.fig --type TEXT  # Recherche
open-pencil export design.fig -f png     # Rendu
open-pencil analyze colors design.fig    # Audit des couleurs
open-pencil analyze clusters design.fig  # Motifs répétés
open-pencil eval design.fig -c "..."     # API Plugin Figma
```

Lorsque l'application de bureau est lancée, omettez le fichier pour contrôler l'éditeur en direct via RPC :

```sh
open-pencil tree                     # Document en direct
open-pencil export -f png            # Capture du canevas
```

Toutes les commandes supportent `--json`. Installation : `bun add -g @open-pencil/cli`

## Collaboration en temps réel

P2P via WebRTC — aucun serveur requis. Partagez un lien et éditez ensemble.

- Curseurs en direct avec flèches colorées et pilules de nom
- Avatars de présence
- Mode suivi — cliquez sur un pair pour suivre son viewport
- Persistance locale via IndexedDB
- IDs de salle sécurisés via `crypto.getRandomValues()`

## Bureau et web

**Bureau** — Tauri v2, ~7 Mo. macOS (signé et notarisé), Windows, Linux. Menus natifs, hors ligne, sauvegarde automatique.

**Web** — disponible sur [app.openpencil.dev](https://app.openpencil.dev), installable en PWA sur mobile avec interface tactile optimisée.

**Homebrew :**

```sh
brew install open-pencil/tap/open-pencil
```

## Polices Google Fonts en secours

Lorsqu'une police n'est pas disponible localement, OpenPencil la récupère automatiquement depuis Google Fonts. Aucune installation manuelle nécessaire lors de l'ouverture de fichiers .fig avec des polices inconnues.
