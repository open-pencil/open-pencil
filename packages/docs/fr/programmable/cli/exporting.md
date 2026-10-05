---
title: Exporter avec la CLI
description: Générer images, SVG, HTML, stories Storybook et autres sorties sans ouvrir l’éditeur.
---

# Exporter avec la CLI

`export` produit le rendu d’une page ou d’un objet depuis un fichier compatible.

```sh
bun open-pencil export design.fig -o preview.png
```

## Choisir le contenu

Les options de la commande permettent de sélectionner une page, un identifiant ou un objet trouvé. Le format est déduit de l’extension ou indiqué explicitement.

## Échelle et dimensions

L’échelle contrôle la résolution. Une largeur ou une hauteur peut aussi être fixée ; les proportions sont conservées lorsqu’une seule dimension est fournie.

## SVG

SVG préserve la géométrie vectorielle et convient aux icônes, à la revue et aux modifications ultérieures.

## HTML

L’exportation HTML crée un document autonome avec la structure et les styles disponibles. Elle vise la transmission, l’inspection et les traitements ultérieurs, pas le remplacement à l’identique du rendu CanvasKit. Elle n’est disponible qu’en mode fichier.

## JSX Tailwind

Exportez en JSX avec des classes utilitaires Tailwind :

```sh
openpencil export design.fig -f tailwind-jsx    # or: -f jsx --style tailwind
```

## Export Storybook

Génère un fichier CSF3 `.stories.ts` par ensemble de composants ou par composant :

```sh
openpencil export design.fig -f storybook                      # React stories in ./design-stories/
openpencil export design.fig -f storybook --framework vue -o src/stories
openpencil export design.fig -f storybook --framework html --page "Components"
openpencil export design.pen -f storybook -o src/stories --watch  # re-export on every save
openpencil export 'src/**/*.pen' -f storybook --beside --watch    # stories next to each design
```

### Designs à côté de leurs stories

Gardez le fichier de design de chaque composant dans le dossier du composant et exportez avec `--beside` : les stories, les images de design et le manifeste `.openpencil-stories.json` de chaque document vont dans le dossier de ce document, à côté du code du composant. Un glob `stories` de Storybook tel que `../src/**/*.stories.ts` dans `.storybook/main.ts` les prend alors en compte sans autre configuration.

Passez plusieurs documents, ou un glob entre guillemets tel que `'src/**/*.pen'` que OpenPencil développe lui-même (Node.js 22 ou version ultérieure). Plusieurs documents nécessitent `--beside` ou `--output` ; `--page` ne fonctionne qu’avec un seul document. Les documents sont exportés l’un après l’autre, et lorsqu’un export échoue, les autres sont tout de même exportés avant que la commande ne se termine par une erreur. `--watch` surveille tous les documents correspondants ; un document créé après le début de la surveillance nécessite une nouvelle exécution.

Chaque variante d’un ensemble de composants devient une story, et ses propriétés de variante deviennent des contrôles `select` : changer un contrôle affiche la variante correspondante. Les composants autonomes dont le nom contient des barres obliques, comme `Button/Primary` et `Button/Secondary`, sont regroupés dans un seul fichier `Button` avec un contrôle `Variant`. Une combinaison pour laquelle le design n’a pas de variante déclenche dans Storybook une erreur nommée au lieu d’afficher une autre variante.

Les stories affichent le composant en HTML avec des styles en ligne, comme `-f html`, et n’ont donc besoin d’aucun runtime OpenPencil ; `--framework` (`react`, `vue` ou `html`) ne change que l’enveloppe et l’import de `Meta`/`StoryObj` depuis `@storybook/react-vite`, `@storybook/vue3-vite` ou `@storybook/html-vite`. Le texte utilise les familles de polices du document, que Storybook doit charger lui-même. Les propriétés de texte, booléennes et d’échange d’instance ne sont pas encore exportées.

Les stories comportent des entrées `parameters.design` pour [`@storybook/addon-designs`](https://github.com/storybookjs/addon-designs) :

- **OpenPencil :** lorsque le chemin du document se trouve dans le répertoire courant, un [lien `openpencil://`](../index#url-scheme) qui ouvre le document dans l’application de bureau et sélectionne la variante, ou son ensemble de composants lorsqu’un autre calque porte le même nom que la variante. Le schéma adresse les calques par nom : une story dont les noms de variante et de composant sont tous deux partagés par d’autres calques n’a donc pas de lien.
- **Design :** un PNG 2× de la variante, écrit dans `<Name>.design/` à côté de la story et référencé avec `new URL(…, import.meta.url)`, de sorte que Vite l’intègre. Copiez le paramètre sur la story de votre propre composant pour comparer l’implémentation au design. `--no-design-images` ignore le rendu ; la substitution de polices suit `--font-policy` comme pour l’export raster.

`-o` désigne le répertoire de sortie. Un manifeste `.openpencil-stories.json` y indique quel document, sous forme de chemin relatif au répertoire de sortie, et quelle page ont généré chaque story et chaque image de design ; versionnez-le avec les stories. Un export remplace les fichiers générés là par un export précédent du même document, y compris ceux de composants supprimés ou renommés depuis ; avec `--page`, seulement ceux de cette page. Il refuse, avant toute modification, d’écraser un autre fichier — une story écrite à la main, celle d’un autre document ou une image isolée. Un export d’une seule page dont les noms de fichiers se sont décalés sur les stories d’une autre page demande à la place un export complet. Sans le manifeste, les stories existantes sont considérées comme appartenant à quelqu’un d’autre : supprimez-les avant d’exporter de nouveau. `--watch` garde la commande active et réexporte à chaque enregistrement du document, afin que le rechargement à chaud de Storybook suive le design ; un enregistrement illisible est signalé et la surveillance continue. Un `--page` introuvable ou une substitution `--font-policy strict` met toujours fin à la commande.

## Mode application en direct

Omettez le fichier pour exporter depuis l’application en cours d’exécution :

```sh
openpencil export -f png                       # export the selection in the active document
openpencil export --page "Components" -f png   # export every layer of a page
openpencil export --node 1:23 -f png           # export one layer, on any page
```

`--page` prend un nom de page et `--page-id` un identifiant de page issu de `openpencil documents list` ; l’un comme l’autre exporte cette page sans y basculer l’application. Ajoutez `--document-id` pour exporter depuis un document autre que le document actif.

Le mode application en direct prend en charge PNG, JPG, WEBP, SVG et PDF. Les exports PowerPoint, JSX, HTML, Storybook et `.fig` nécessitent un fichier en argument. L’export de vignettes en mode fichier n’est pas pris en charge pour l’instant.

## Chemin de sortie

`-o` ou `--output` définit le chemin. La CLI signale les erreurs de format, les objets introuvables et les chemins invalides au lieu de produire silencieusement un résultat incomplet.

Consultez `bun open-pencil export --help` pour les formats et options de la version installée.
