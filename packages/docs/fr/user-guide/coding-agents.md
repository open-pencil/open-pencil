---
pageClass: guide
title: Agents de code
description: Utilisez Claude Code, Codex, Cursor ou un autre agent de code que vous avez déjà comme IA dans l’app de bureau OpenPencil.
---

# Agents de code

L’app de bureau peut utiliser comme IA un agent de code que vous avez déjà : Claude Code, Codex, [Antigravity CLI](#antigravity), Gemini CLI, [Cursor](#cursor), [Grok Build](#grok-build) ou [Pi](#pi). L’agent tourne sur votre ordinateur avec votre propre abonnement, et OpenPencil lui donne les outils pour travailler sur le canevas.

Les agents de code nécessitent l’[app de bureau](/fr/download) : le navigateur ne peut pas lancer de programmes sur votre ordinateur.

## Configurer un agent

1. Installez le connecteur de l’agent, comme l’indique sa section ci-dessous. Claude Code et Codex n’ont besoin d’aucun autre programme.
2. Installez le serveur MCP d’OpenPencil, qui donne à l’agent les outils du canevas :

   ```sh
   npm install -g @open-pencil/mcp
   ```

3. Ouvrez **Paramètres → Modèles → Lancer la configuration guidée** et choisissez l’agent sous **Agents de code sur cet ordinateur**.
4. Vérifiez que l’agent et le serveur MCP apparaissent comme installés. **Installer l’adaptateur** installe le connecteur pour vous.
5. Si l’agent n’est pas connecté, cliquez sur **Se connecter**. La configuration guidée affiche le compte utilisé par l’agent, par exemple son abonnement et son adresse e-mail.

**Outils d’OpenPencil** indique si l’agent peut accéder aux outils du canevas. **Vérifier à nouveau** relance la vérification après une installation ou une connexion.

Si vous utilisez déjà l’agent dans un terminal, il peut se configurer lui-même : cliquez sur **Copier le prompt de configuration** sur sa carte et collez le prompt dans l’agent.

## Choisir le modèle et le mode

Un agent est un modèle comme un autre dans **Paramètres → Modèles** : il peut donc être l’**Agent de design**, s’occuper des **Tâches rapides**, rédiger les **Révisions** ou, s’il lit les images, servir de modèle **Vision**. Pour les **Tâches rapides**, un agent nomme les conversations, mais c’est toujours l’Agent de design qui rédige les résumés, et Pi ne fait ni l’un ni l’autre. Vous pouvez ajouter deux fois le même agent avec des réglages différents.

Dans les réglages d’un agent :

- **Modèle** : **Valeur par défaut de l’agent** laisse le choix à l’agent ; vous pouvez aussi choisir l’un des modèles qu’il propose. Si la liste ne se charge pas, choisissez **Modèle personnalisé…** et tapez l’identifiant d’un modèle.
- **Niveau de réflexion** : les niveaux propres à l’agent pour le modèle choisi, comme Max pour Claude Code ou Ultra pour Codex.
- **Mode** : ce que l’agent peut faire avant de vous demander, avec les noms propres à l’agent, comme Manual, Accept edits, Plan, Auto et Bypass permissions pour Claude Code, ou de Read-only à Full access pour Codex.
- **Entrée d’images** : désactivez-la quand le modèle choisi ne sait pas lire les images.

Le menu à côté du bouton d’envoi change le modèle, le niveau de réflexion et le mode de la discussion en cours, à partir du message suivant.

## Claude Code

```sh
npm install -g @agentclientprotocol/claude-agent-acp
```

Connectez-vous depuis la configuration guidée, ou lancez `claude` et tapez `/login`. Si le navigateur ne parvient pas à renvoyer la connexion, la page de connexion affiche un code à coller dans la configuration guidée.

## Codex

```sh
npm install -g @agentclientprotocol/codex-acp
```

Connectez-vous avec ChatGPT depuis la configuration guidée, ou lancez `codex login`.

Un ancien connecteur, `@zed-industries/codex-acp`, installe un programme du même nom mais ne peut pas se connecter. La configuration guidée vous demande de le supprimer.

## Antigravity CLI {#antigravity}

Antigravity CLI est l’agent de Google pour Gemini. Il n’a pas besoin de connecteur. Installez-le depuis le [site d’Antigravity](https://antigravity.google) :

```sh
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Sous Windows, lancez plutôt ceci dans PowerShell :

```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

Lancez `agy` une fois et choisissez comment vous connecter. La configuration guidée l’affiche comme installé, mais ne peut pas afficher son compte.

Avant de commencer, l’agent demande parfois à lister son propre dossier, `~/.gemini/antigravity-cli/mcp`. Autorisez-le : refuser met fin à son tour.

## Gemini CLI

```sh
npm install -g @google/gemini-cli
```

Il n’a pas besoin de connecteur. Lancez `gemini` une fois et choisissez comment vous connecter. Les comptes Google personnels ne peuvent plus se connecter à Gemini CLI : utilisez [Antigravity CLI](#antigravity) avec ces comptes.

## Cursor

La CLI de Cursor n’a pas besoin de connecteur. Installez-la depuis le [guide d’installation de la CLI](https://cursor.com/docs/cli/installation) :

```sh
curl https://cursor.com/install -fsS | bash
```

Sous Windows, utilisez la commande PowerShell de cette page. Lancez `cursor-agent login` une fois pour vous connecter. Les modèles de Cursor incluent leur niveau de réflexion dans leur nom.

## Grok Build

Grok Build n’a pas besoin de connecteur. Installez-le depuis le [guide de Grok Build](https://docs.x.ai/build/overview) :

```sh
curl -fsSL https://x.ai/cli/install.sh | bash
```

Sous Windows, utilisez la commande PowerShell de cette page. Lancez `grok login` une fois pour vous connecter.

## Pi

Pi passe par le programme compagnon d’OpenPencil, qui nécessite Node.js 22.15 ou une version ultérieure, ou Bun. La configuration guidée l’installe en un clic ; vous pouvez aussi l’installer vous-même :

```sh
npm install -g @open-pencil/harness
```

Pi utilise les fournisseurs auxquels vous vous êtes connecté dans Pi : il n’y a donc aucune clé à coller. Lancez `pi`, connectez-vous avec `/login` et choisissez un modèle par défaut avec `/model`. Pour utiliser un autre modèle dans OpenPencil, saisissez-le sous la forme `provider/model` dans les réglages de Pi dans OpenPencil. Avec une clé [AI Gateway](https://vercel.com/ai-gateway), Pi passe par la passerelle à la place.

Pi ne sait pas lire les images. Après un redémarrage de Pi ou d’OpenPencil, une conversation se poursuit dans une nouvelle session Pi.

## Dépannage

- **Introuvable après l’installation.** Les apps lancées depuis le Dock ou le menu Démarrer ne voient pas tous les dossiers que voit votre terminal. OpenPencil cherche dans les dossiers habituels de npm, Bun, Volta, mise et Homebrew. Si le vôtre est ailleurs, ajoutez-le au `PATH` de votre shell de connexion et redémarrez OpenPencil.
- **Mise à jour nécessaire.** Le serveur MCP ou le compagnon de Pi ne correspond pas à la version de l’app. Cliquez sur le bouton de mise à jour, ou lancez la commande affichée par la configuration guidée, puis sur **Vérifier à nouveau**.
- **L’agent n’accède pas aux outils d’OpenPencil** ou ne peut pas modifier le canevas. Vérifiez que le serveur MCP apparaît comme installé dans la configuration guidée et qu’il tourne dans **Paramètres → MCP**. Codex ignore le serveur d’OpenPencil quand son propre `config.toml` contient un serveur nommé `open-pencil` : supprimez cette entrée.
- **L’agent vous demande de vous connecter.** Cliquez sur **Se connecter** dans la configuration guidée, ou connectez-vous avec la commande propre à l’agent, puis renvoyez votre message.

L’agent travaille dans un dossier qui lui est propre, dans les données de l’app OpenPencil : il ne récupère donc pas les réglages de projet de votre dossier personnel. Il utilise toutefois ses propres réglages, comme les serveurs MCP et les règles de `~/.codex` ou `~/.claude`.
