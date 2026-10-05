---
layout: doc
title: Automatisation et API
description: AI, MCP, CLI, JSX et Figma Plugin API pour automatiser les designs.
---

# Automatisation et API

OpenPencil traite les fichiers de design comme des données structurées. Les opérations de l’éditeur — créer des formes, modifier des remplissages, configurer la disposition automatique ou exporter des ressources — sont aussi disponibles via la CLI, des agents AI et des API.

## Chat avec l’AI

L’assistant intégré exécute plus de 90 outils. Une instruction peut modifier les ombres de plusieurs boutons, créer un composant avec une variante sombre ou exporter tous les cadres d’une page à l’échelle 2×.

[Chat avec l’AI →](./ai-chat)

## MCP

Claude Code, Cursor, Windsurf et d’autres clients MCP peuvent utiliser les mêmes outils. Le serveur prend en charge stdio et HTTP avec des sessions indépendantes.

[Serveur MCP →](/programmable/mcp-server)

## CLI

La CLI examine, exporte et analyse les fichiers `.fig` sans ouvrir l’éditeur. Elle peut lister pages et objets, rechercher du contenu, extraire des variables de design et générer des PNG. `--json` facilite l’intégration avec la CI.

La CLI se connecte aussi à l’application de bureau en cours d’exécution via RPC, ce qui permet de piloter l’éditeur par script pendant que vous l’utilisez : ouvrir, enregistrer et changer de document, annuler, modifier les réglages et appeler n’importe quel outil MCP.

[CLI →](./cli/inspecting) · [Piloter l’application](/programmable/cli/app-control)

## JSX

Une interface peut être décrite de manière déclarative en JSX. Un seul appel crée un arbre complet de cadres, textes, dispositions, remplissages et contours.

Dans l’autre sens, OpenPencil exporte une sélection en JSX ou HTML avec des classes Tailwind, comme point de départ pour l’implémentation ou la revue de code.

[Moteur JSX →](./jsx-renderer)

## Figma Plugin API

La commande `eval` exécute JavaScript avec un objet global `figma` compatible. Elle permet d’interroger et modifier des documents, puis d’enregistrer le résultat.

[Scripting avec `eval` →](./cli/scripting)

## Schéma d’URL {#url-scheme}

L’application de bureau enregistre `openpencil://` : une page publiée — une story Storybook, une revue de design, un README — peut ainsi pointer directement vers un calque :

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` est un chemin relatif au dépôt se terminant par `.pen` ou `.fig` ; les chemins absolus et les segments `.` ou `..` sont refusés. `node` est facultatif. Les deux valeurs sont encodées en URL — les séparateurs de chemin peuvent rester littéraux, mais un `+` littéral doit être envoyé sous la forme `%2B` — et une clé répétée prend sa dernière valeur.

L’application compare `file` aux chemins des onglets ouverts, comme une séquence complète de segments finaux, et active cet onglet sans relire le document ; un fichier déplacé ou devenu illisible depuis son ouverture voit donc tout de même son calque sélectionné. Le premier onglet ouvert dont le chemin se termine par le chemin demandé l’emporte, ce qui compte lorsque deux copies de travail ont le même fichier ouvert. Les segments sont comparés comme le fait le système de fichiers de la plateforme : sans tenir compte de la casse ASCII sous macOS et Windows, exactement sous Linux ; `Web/Design/hikyo.pen` et `web/design/hikyo.pen` désignent donc le même fichier sur un Mac et deux fichiers différents sous Linux. Si aucun onglet ouvert ne correspond, un sélecteur de fichier demande une seule fois le fichier ; le fichier choisi doit se terminer par le même chemin relatif, sinon le lien est annulé. Aucun chemin n’est joint à une racine et aucun accès au système de fichiers n’est accordé au-delà de ce que renvoie le sélecteur. Un fichier réellement ouvert par le lien — celui qui a été choisi — rejoint la liste des fichiers récents comme tout autre fichier que vous ouvrez ; activer un onglet déjà ouvert ne touche pas à la liste, car rien n’a été ouvert.

Avec un nom d’objet, l’application sélectionne tous les calques portant exactement ce nom sur la page courante et zoome sur l’ensemble de la sélection. Si la page courante n’en contient aucun, elle bascule sur la première page qui en contient, en chargeant les pages si nécessaire. Un nom inconnu affiche un avis et laisse le document ouvert. Ouvrir un fichier et sélectionner des calques est tout ce que le schéma sait faire.

L’application web accepte le même lien depuis sa propre barre d’adresse :

```
https://app.openpencil.dev/?file=https://raw.githubusercontent.com/open-pencil/open-pencil/master/tests/fixtures/pencil_button.pen&node=Button/Large/Default
```

Ici, `file` est une URL `https:` absolue se terminant par `.pen` ou `.fig` — l’application web n’a pas de système de fichiers ; un chemin relatif, une URL `http:` ou toute autre extension est donc refusé avec un avertissement dans la console, sans autre effet. `node` se comporte exactement comme ci-dessus. Le navigateur récupère le fichier d’une autre origine : l’hôte doit l’autoriser (`raw.githubusercontent.com` envoie `Access-Control-Allow-Origin: *` et convient). La requête n’envoie aucun identifiant et refuse de suivre les redirections ; une URL `https://github.com/<owner>/<repo>/raw/...` est donc refusée, et il faut pointer directement vers l’hôte brut. `file` et `node` sont retirés de la barre d’adresse dès leur lecture, de sorte qu’un rechargement ne rouvre pas le document. Un document lié est limité à 64 Mio. Un déploiement qui sert l’application avec une Content-Security-Policy doit autoriser l’hôte lié dans `connect-src`.

Sous macOS, le schéma appartient au bundle de l’application installée : les liens atteignent donc une version installée et non un processus `tauri dev`. Sous Windows et Linux, le lien arrive par le plugin de liens profonds, y compris lorsque l’application n’est pas encore lancée : il est mis en file d’attente au démarrage et traité dès que l’éditeur est prêt.

OpenPencil est sous licence MIT et conserve les documents localement. Les fichiers `.fig` peuvent être examinés, transformés, traités en CI ou fournis comme contexte à un modèle sans dépendre d’un hébergeur particulier.
