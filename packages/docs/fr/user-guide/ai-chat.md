---
pageClass: guide
title: Chat IA
description: Demandez à l’IA de créer et de modifier des designs, annulez ce qu’elle a fait, obtenez des revues et apprenez-lui des choses avec des compétences.
---

# Chat IA

Décrivez ce que vous voulez, et l’IA le crée sur le canevas : un écran, un composant, une modification de tous les boutons de la page. Appuyez sur <Keys mac="⌘ J" other="Ctrl J" /> pour ouvrir le chat, ou cliquez sur l’onglet **IA** à côté de **Design**.

## Configurer l’IA

La première fois, la configuration guidée vous demande pour quoi vous aimeriez que l’IA vous aide et ce que vous utilisez déjà :

- un [agent de code](./coding-agents) que vous avez, comme Claude Code ou Codex, dans l’app de bureau ;
- un compte chez un fournisseur d’IA, comme OpenRouter, Anthropic, OpenAI ou Google, ou votre abonnement ChatGPT ;
- un modèle qui tourne sur votre ordinateur ou sur le serveur de votre entreprise ;
- votre compte [OpenPencil Cloud](/cloud/ai).

[Modèles et fournisseurs](./models-and-providers) indique ce dont chacun a besoin. Pour relancer la configuration, ouvrez **Paramètres → Modèles → Lancer la configuration guidée**.

L’IA utilise un modèle pour chaque type de travail ; vous pouvez le changer dans le menu des modèles sous le champ de message, dans **Gérer les modèles et les rôles…** :

| Rôle | Rôle joué |
| ---- | ---- |
| **Agent de design** | Le chat lui-même. |
| **Vision** | Lit les images que vous joignez. |
| **Révision** | Rédige les [revues de design](#demander-une-revue). Utilise l’Agent de design, sauf si vous en choisissez un autre. |
| **Tâches rapides** | Nomme les conversations et, s’il s’agit d’un modèle d’API, rédige les résumés des longues conversations ; sinon, c’est l’Agent de design qui les rédige. Pi ne nomme pas les conversations. Sans modèle qui le fait, une conversation prend son premier message pour nom. |

## Demander un design

Tapez ce que vous voulez et appuyez sur <Keys mac="Enter" other="Enter" />. L’IA voit quels calques sont sélectionnés : sélectionnez donc ce dont vous parlez avant de demander une modification.

<GuideImage name="ai-chat/reply" alt="Le chat IA à côté du canevas : une demande de carte de voyage, la modification faite par l’IA, sa réponse et la nouvelle carte sur le canevas" />

- Tapez **@** pour nommer un calque, une page ou une compétence. Les calques nommés s’affichent sous forme de puces ; cliquez sur l’une d’elles pour trouver le calque sur le canevas. Le bouton pointeur nomme les calques sélectionnés.
- Joignez des images, comme un croquis ou un site que vous aimez, avec le bouton d’image. Il faut pour cela un modèle Vision.
- Chaque modification faite par l’IA apparaît dans sa réponse. Cliquez dessus pour voir ce qu’elle a fait.

Quelques idées à essayer :

- « Crée une carte avec un titre, une description et un bouton bleu. »
- « Fais en sorte que tous les boutons de cette page aient le même rayon d’angle. »
- « Transforme le fond de ce cadre en dégradé du bleu au violet. »
- « Fais de ce composant un interrupteur que je peux essayer en aperçu. »

Avec un modèle qui lit les images, l’IA vérifie son travail en regardant une image de ce qu’elle a créé, ce qui lui permet de corriger ses erreurs.

## Pendant que l’IA travaille

- Continuez à travailler : l’IA reste sur la page où le message a commencé. Le chat indique où elle travaille, avec **Aller à la page** pour y revenir.
- Pour la regarder faire, activez **Suivre les agents**, le bouton cible en haut du chat. Votre vue suit l’IA, y compris vers une autre page. Cliquer, faire défiler ou appuyer sur <Keys mac="Esc" other="Esc" /> arrête le suivi.
- Tapez un autre message et appuyez sur <Keys mac="Enter" other="Enter" /> pour l’envoyer dès que l’étape en cours est terminée, afin que l’IA puisse changer de cap. <Keys mac="⌥ Enter" other="Alt Enter" /> attend qu’elle ait tout terminé. Les messages en attente s’affichent en grisé sous la réponse.
- **Arrêter** met fin à la réponse. Une modification déjà en cours se termine ; le message suivant indique à l’IA ce qui a changé.

**Nombre maximal d’étapes par message**, dans **Discussion** sous **Paramètres → Modèles**, limite la durée de travail d’une réponse de l’IA intégrée : 50 étapes, sauf si vous changez cette valeur. Les agents de code fixent leurs propres limites. Quand une réponse atteint la limite, **Continuer** reprend le travail.

## Annuler ce que l’IA a fait

Chaque modification faite par l’IA correspond à une étape de <Keys mac="⌘ Z" other="Ctrl Z" />, et le chat signale les modifications annulées.

- **Annuler les modifications**, sous une réponse, annule toutes ses modifications, et **Rétablir les modifications** les remet en place.
- **Annuler et régénérer** les annule et redemande.

Votre message suivant indique à l’IA ce que vous avez annulé, pour qu’elle ne s’appuie pas sur des modifications qui n’existent plus.

## Demander une revue

Tapez **/review** pour que le modèle de Révision examine la sélection, ou la page si rien n’est sélectionné, comme le ferait un directeur artistique : alignement, espacement, contraste, hiérarchie et tout ce qui semble cassé.

- Précisez ce qu’il faut examiner, par exemple `/review typography`.
- Joignez des images de comparaison, comme une capture d’écran d’un site que vous admirez. Il faut pour cela un modèle qui lit les images.
- Sous une modification faite par l’IA, **Réviser ce changement** demande si elle a amélioré le design.

La revue s’affiche sous forme de carte, et chaque remarque renvoie à son calque. **Corriger** envoie les remarques à l’IA comme votre message.

## Apprendre des choses à l’IA avec des compétences

Une compétence est un ensemble d’instructions pour un type de travail, comme les règles de marque de votre équipe, au format [Agent Skills](https://agentskills.io/specification) : un dossier contenant un `SKILL.md` et les fichiers auxquels il fait référence. L’IA lit une compétence quand une demande en a besoin. Pour en utiliser une vous-même, tapez **/** et choisissez-la.

Ajoutez des compétences dans **Paramètres → Compétences** :

- **Importer une compétence** : un ZIP du dossier d’une compétence, ou un seul `SKILL.md`.
- Dans l’app de bureau, les compétences des dossiers `.agents/skills` et `.claude/skills` situés à côté du fichier ouvert sont aussi trouvées. Elles restent désactivées tant que vous n’avez pas choisi **Faire confiance au dossier**, car une compétence donne des instructions à l’IA.
- Les compétences installées par d’autres agents de code, dans `~/.agents/skills` et `~/.claude/skills`, sont listées désactivées. Activez celles qui aident pour le design.

Les agents de code comme Claude Code chargent leurs propres compétences.

## Longues conversations

L’IA ne peut lire qu’une certaine quantité de conversation à la fois. La jauge en haut du chat indique à quel point elle est remplie ; cliquez dessus pour plus de détails.

Quand la conversation est presque pleine, l’IA la compacte : elle rédige un résumé qui remplace les anciens messages, que vous pouvez toujours lire. **Compacter automatiquement**, dans **Discussion** sous **Paramètres → Modèles**, le fait quand c’est nécessaire. Tapez **/compact** pour le faire tout de suite, en précisant ce qu’il faut garder, par exemple `/compact keep the color decisions`.

**Historique des discussions**, en haut à gauche du chat, ouvre vos conversations précédentes, enregistrées sur cet ordinateur. **Nouvelle discussion** repart de zéro.

## Choisir ce que l’IA peut faire

**Paramètres → Accès aux outils** liste les outils que l’IA peut utiliser, comme modifier des calques, exporter ou exécuter des scripts. Désactivez des outils ou des groupes entiers pour empêcher l’IA de s’en servir. Le changement s’applique à partir du message suivant. Un outil de script peut quand même faire ce que font les outils désactivés : ces interrupteurs ne sont donc pas un bac à sable.

L’onglet **Local MCP** règle les outils des [agents de code et autres clients MCP](/developers/mcp-server).

## Modifier les instructions de l’IA

::: v-pre

**Paramètres → Prompts** contient ce qu’OpenPencil dit à l’IA :

- **Agent de design** : vos instructions pour le chat, ajoutées après celles d’OpenPencil. **Remplacer celles d’OpenPencil** utilise les vôtres à la place ; sans celles d’OpenPencil, l’IA risque de mal utiliser ses outils.
- **Révision**, **Titres des discussions** et **Résumés de compactage** : les prompts de ces tâches. Ce sont des modèles [Knap](https://knap.md), dans lesquels `{{ focus }}` insère une valeur. L’éditeur signale les erreurs et affiche un aperçu du résultat.

:::

**Rétablir les valeurs par défaut** remet ceux d’OpenPencil.

## Connecter d’autres outils {#external-mcp-connections}

Dans l’app de bureau, les agents de code peuvent aussi utiliser d’autres serveurs [MCP](https://modelcontextprotocol.io/), comme votre outil de suivi des tickets. Dans **Paramètres → MCP**, sous **Connexions MCP**, ajoutez l’adresse du serveur et, s’il en a besoin, son jeton, puis activez la connexion : les agents n’ont pas accès aux connexions désactivées. N’ajoutez que des serveurs de confiance : leurs outils agissent avec les accès que vous leur donnez.

## Recevoir des notifications

Quand l’IA demande une autorisation et que vous ne répondez pas dans les secondes qui suivent, OpenPencil envoie une notification : vous pouvez donc travailler dans une autre app en attendant. **Paramètres → Notifications** peut aussi vous avertir quand une réponse est terminée. Dans le navigateur, cliquez d’abord sur **Autoriser les notifications** à cet endroit.
