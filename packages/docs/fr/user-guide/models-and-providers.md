---
pageClass: guide
title: Modèles et fournisseurs
description: Les fournisseurs d’IA compatibles avec le chat, ce qui fonctionne dans le navigateur et dans l’app de bureau, et que faire quand un fournisseur est injoignable.
---

<script setup>
import ModelProviders from '#docs/theme/components/ModelProviders.vue'
</script>

# Modèles et fournisseurs

Le [chat IA](./ai-chat) utilise un modèle que vous connectez : un [agent de code](./coding-agents) que vous avez déjà, une clé d’API d’un fournisseur, votre compte [OpenPencil Cloud](/cloud/ai) ou votre propre serveur. Avec une clé d’API ou votre propre serveur, les requêtes vont directement de l’app au fournisseur, et un agent de code utilise sa propre connexion. L’IA d’OpenPencil Cloud passe par le service de Cloud, qui transmet chaque requête au fournisseur de modèles qu’il utilise.

Ajoutez un modèle depuis **Paramètres → Modèles**, ou laissez la configuration guidée s’en charger. Sur une nouvelle installation, se connecter à OpenPencil Cloud avec un abonnement qui inclut l’IA la configure automatiquement ; un modèle que vous avez déjà configuré reste tel quel.

La configuration guidée attribue aussi à chaque type de travail le modèle que le fournisseur recommande, sauf si ce que vous avez déjà attribué fonctionne encore : l’**Agent de design** fait tourner le chat, **Révision** critique les designs à partir de captures d’écran, **Tâches rapides** s’occupe des petites tâches comme nommer les discussions, et **Vision** lit les images. Vision n’est configuré que si vous indiquez vouloir travailler avec des images. Un fournisseur dont le modèle principal ne lit pas les images, comme DeepSeek ou Z.ai, révise les designs, et lit les images quand vous le demandez, avec l’un de ses modèles qui en est capable, s’il en a un. Vous pouvez tous les changer dans **Affectations**, sous **Paramètres → Modèles**.

## Fournisseurs

<ModelProviders />

**OpenAI-compatible** convient à la plupart des autres services et serveurs locaux, avec un choix entre les API Completions et Responses. **Anthropic-compatible** convient aux services qui parlent l’API Messages d’Anthropic. Saisissez l’URL de base, la clé et l’identifiant de modèle qu’attend votre serveur.

Avec **OpenRouter**, vous pouvez aussi vous connecter au lieu de coller une clé.

**ChatGPT** utilise votre abonnement ChatGPT au lieu d’une clé d’API, et ses réponses sont décomptées des limites de l’abonnement. Il n’est disponible que dans l’app de bureau. La connexion ouvre le navigateur et revient dans l’app sur `localhost:1455`, la seule adresse qu’accepte OpenAI : fermez donc d’abord un `codex login` en cours. La connexion se renouvelle d’elle-même, et la liste des modèles vient de votre compte.

## Dans le navigateur et dans l’app de bureau

L’app de bureau peut joindre n’importe quel fournisseur et conserve les clés dans le gestionnaire d’identifiants de votre système. Elle offre aussi ce que le navigateur ne peut pas : les agents de code et la connexion avec ChatGPT.

L’app web envoie les requêtes depuis le navigateur ; le fournisseur doit donc l’autoriser (CORS). Les fournisseurs intégrés le font ; pour votre propre serveur ou un autre service, vérifiez avant de compter dessus.

Quand l’app web affiche **« Impossible d’atteindre ce point de terminaison depuis le navigateur »**, la requête n’a jamais reçu de réponse acceptable pour le navigateur. Soit le fournisseur n’autorise pas les requêtes du navigateur, soit il les autorise mais omet cette autorisation dans ses réponses d’erreur : une clé ou un nom de modèle erroné produit alors le même résultat. Essayez les mêmes réglages dans l’app de bureau : s’ils y fonctionnent, c’est que le fournisseur bloque le navigateur. [Testing a Model Provider](/development/testing-model-providers) explique comment vérifier un fournisseur vous-même.

## Choisir un modèle

Le chat fonctionne en appelant des outils : un modèle doit donc prendre en charge l’**appel d’outils** et le diffuser de façon fiable ; les modèles diffèrent sur ce point, même chez un même fournisseur. Ajoutez la **vision** pour que le chat puisse regarder des images et vérifier son propre travail.

Les modèles de raisonnement peuvent consacrer tout leur budget de sortie à réfléchir. Si un modèle s’arrête sans rien faire, augmentez ses **Jetons de sortie maximum** ou baissez son **Niveau de réflexion**.

Chaque étape d’une réponse renvoie la conversation et la description des outils : les longues réponses consomment donc beaucoup de jetons d’entrée. **Nombre maximal d’étapes par message**, dans **Discussion** sous **Paramètres → Modèles**, plafonne cela pour l’IA intégrée, tandis que les agents de code fixent leurs propres limites ; voir [Pendant que l’IA travaille](./ai-chat#pendant-que-l-ia-travaille).

## Protéger vos clés

Dans le navigateur, les clés sont conservées dans un stockage chiffré du navigateur pour que vous n’ayez pas à les saisir à nouveau ; les Paramètres permettent de ne les garder que pour la session. L’app de bureau utilise le gestionnaire d’identifiants de votre système. Une clé stockée dans le navigateur reste utilisable par les scripts qui tournent sur la page : préférez donc des clés à portée limitée, avec des plafonds de dépenses, quand le fournisseur en propose.
