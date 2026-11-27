---
title: Confidentialité et statistiques d’utilisation
description: Ce qu’OpenPencil envoie sur le réseau, pourquoi il envoie des statistiques d’utilisation anonymes, et comment désactiver chacun de ces envois.
---

<script setup>
import {
  describeBuildFields,
  describePingFields,
  describeReportFields,
  describeUsageEvents
} from '@open-pencil/feedback/contract'

const columns = [
  { key: 'name', label: 'Field', kind: 'code' },
  { key: 'values', label: 'Values', kind: 'description' }
]

function rows(fields, freeForm = 'A version number') {
  return fields.map((field) => ({
    name: field.name,
    description: field.description,
    values: field.values.length > 0 ? field.values.join(', ') : freeForm
  }))
}

const pingRows = rows(describePingFields())
const buildFields = describeBuildFields()
  .map((field) => field.name)
  .join(', ')
const events = describeUsageEvents()
const reportRows = rows(describeReportFields(), 'Free-form')
</script>

# Confidentialité et statistiques d’utilisation

- Vos designs, noms de fichiers, noms de calques, textes, prompts et clés ne quittent jamais votre appareil, sauf si vous les partagez ou les synchronisez vous-même, ou si vous joignez un design à un rapport que vous envoyez.
- Les versions officielles envoient un ping anonyme par jour, sans identifiant. Vous pouvez le désactiver.
- Des statistiques d’utilisation détaillées ne sont envoyées que si vous acceptez lorsque la question vous est posée, et vous pouvez arrêter à tout moment.

## Pourquoi nous collectons des données

OpenPencil est développé par une petite équipe. Nous avons besoin de savoir quelles plateformes, quels formats de fichiers et quelles fonctionnalités les gens utilisent pour décider de ce que nous développerons ensuite. Nous devons aussi montrer qu’OpenPencil est utilisé, car c’est ce qui permet de financer le projet. Un décompte des installations actives et une idée des fonctionnalités qui comptent répondent à ces deux questions sans rien savoir de vous ni de votre travail.

## Le ping quotidien

Une fois par jour, une version officielle envoie ceci à `feedback.openpencil.dev` :

```http
POST https://feedback.openpencil.dev/ping

{ "version": "0.17.0", "platform": "macos", "arch": "arm64", "app": "desktop", "browser": "unknown", "usageStats": "denied", "pingDays": "5-8", "enteredStep": false }
```

<SdkDataTable :columns="columns" :rows="pingRows" />

Il ne contient aucun identifiant : les pings d’une même installation ne peuvent donc pas être reliés entre eux. La réponse à la question sur les statistiques d’utilisation est notre seul moyen de savoir combien de personnes refusent, puisque refuser signifie que rien d’autre n’est jamais envoyé. L’application ne stocke que la date de son dernier ping, pour n’envoyer qu’un ping par jour, et le nombre de jours où elle en a envoyé un. Seul le palier dans lequel tombe ce nombre est envoyé : 1, 2, 3–4, 5–8, et ainsi de suite en doublant, jamais le nombre lui-même. Chaque installation passe par les paliers dans l’ordre, ce qui permet au serveur de distinguer les installations qui reviennent des copies d’un même état enregistré lancées encore et encore, qui répètent le même palier, sans distinguer les installations entre elles. Le serveur ajoute un à un compteur pour ce jour et cette version, et un à un compteur pour ce jour, cette application et ce palier. Il ajoute aussi un à un compteur pour ce jour, l’application et la plateforme, et le réseau d’où vient le ping : le numéro et le nom de l’opérateur du réseau tels que Cloudflare les indique, par exemple un fournisseur d’accès à internet, une université ou un hébergeur cloud. Cela permet de distinguer les vraies personnes des installations automatisées qui tournent dans des centres de données, sans rien qui identifie un appareil. Le serveur ne conserve rien d’autre. Il n’enregistre pas les adresses, et il rejette tout ping qui contient un autre champ.

La réponse au ping liste les messages que l’application peut afficher, comme un appel aux dons ou une proposition d’essayer OpenPencil Cloud : leur texte, l’endroit de l’application où ils apparaissent, leur fréquence et les versions concernées. Une version qui les affiche décide sur l’appareil si l’un d’eux doit apparaître, d’après la durée depuis son installation, sa version, sa plateforme et le fait que vous soyez connecté ou non à Cloud, et garde aussi sur l’appareil ce que vous avez fait de chacun, par exemple **Plus tard**. Rien de tout cela ne repart avec le ping. Si vous partagez les statistiques d’utilisation, elles indiquent quand l’un de ces messages a été affiché, reporté ou suivi, avec le nom du message et l’endroit où il est apparu (les événements ci-dessous) ; le serveur ne les conserve que pour les messages qu’il diffuse encore ou que l’application intègre, comme son appel aux dons. Le bouton d’un message ouvre sa page avec le nom du message dans l’adresse, ce qui permet aux statistiques de visite du site de savoir quel message a amené quelqu’un, sans rien sur vous ni sur votre appareil. Un message venant du serveur est du texte : il ne peut pas exécuter de code, afficher d’images ni mener ailleurs qu’à openpencil.dev. L’appel aux dons propre à l’application renvoie vers la page de dons indiquée par le projet. Les versions que vous compilez vous-même ne reçoivent aucun message du serveur.

Le ping est activé par défaut. Désactivez-le dans **Paramètres → Confidentialité** ; l’application n’affiche alors plus aucun message venant du serveur.

## Statistiques d’utilisation

Les statistiques d’utilisation sont désactivées tant que vous n’avez pas donné votre accord. OpenPencil vous pose la question une seule fois, dans une petite invite qui apparaît après l’écran d’accueil au premier lancement, ou lors d’un lancement ultérieur si vous n’avez pas répondu, avec deux choix équivalents : **Non merci** et **Partager les statistiques**. Rien n’est présélectionné, et vous pouvez changer votre réponse plus tard dans **Paramètres → Confidentialité**.

Lorsque vous acceptez, l’application crée sur votre appareil un identifiant d’installation aléatoire. Il n’est lié ni à un compte, ni à une adresse e-mail, ni à quoi que ce soit d’autre qui vous concerne. Les événements d’utilisation sont envoyés avec cet identifiant, accompagnés des champs de version ci-dessus (<code>{{ buildFields }}</code>). Lorsque vous arrêtez le partage, l’application supprime l’identifiant ; accepter à nouveau en crée un nouveau.

Voici tous les événements que l’application peut envoyer. Le service `feedback.openpencil.dev` vérifie chaque événement par rapport à cette liste et rejette tout événement, toute propriété ou toute valeur qui n’y figure pas : une application modifiée ne peut donc rien envoyer d’autre par ce biais non plus.

<template v-for="event in events" :key="event.name">
  <h3><code>{{ event.name }}</code></h3>
  <p>{{ event.description }}</p>
  <SdkDataTable v-if="event.properties.length" :columns="columns" :rows="rows(event.properties)" />
</template>

Les événements acceptés sont transmis à [PostHog](https://posthog.com), un service d’analyse produit, sur son cloud européen. La requête part de notre serveur, pas de votre appareil : PostHog ne voit donc jamais votre adresse. Les événements ne créent aucun profil de personne et ne donnent lieu à aucune géolocalisation. Nous conservons les statistiques d’utilisation pendant 12 mois.

## Rapports d’erreur et de problème

Lorsque le code d’OpenPencil lui-même déclenche une erreur inattendue, une version officielle ajoute **Signaler…** à la notification d’erreur ; les erreurs venant d’extensions du navigateur ou sans trace d’appels n’en ont pas. Si OpenPencil s’est fermé de manière inattendue après une erreur, ou si l’application de bureau a rencontré une erreur interne, le lancement suivant propose la même chose, une seule fois. **Aide → Signaler un problème…** est toujours disponible. Les deux ouvrent un formulaire, et rien n’est envoyé tant que vous n’avez pas choisi **Envoyer le rapport**. **Ce qui sera envoyé** affiche le rapport exact avant son envoi. Il contient :

- Pour une erreur : son type et son message, débarrassés des clés, des jetons, des adresses e-mail et de votre nom d’utilisateur dans les chemins de dossiers, et l’endroit du code d’OpenPencil où elle s’est produite. Les erreurs venant des fournisseurs d’IA, qui peuvent citer vos prompts, sont envoyées sans message.
- Ce que vous écrivez, et une adresse e-mail si vous en indiquez une pour que nous puissions vous répondre.
- Les champs de version ci-dessus (<code>{{ buildFields }}</code>), et votre identifiant d’installation si vous partagez les statistiques d’utilisation.
- Si vous laissez **Inclure l’activité récente** activé : les 50 derniers événements de **Paramètres → Diagnostics**, comme les erreurs, les durées et les formats de fichiers. Ils n’incluent jamais les messages du chat ni la sortie des outils.
- Si vous activez **Joindre ce document** : le design ouvert, sous forme de fichier `.fig`.

En plus des champs de version, un rapport contient ces champs :

<SdkDataTable :columns="columns" :rows="reportRows" />

Les rapports sont envoyés à `feedback.openpencil.dev`, qui les transmet au suivi des erreurs de PostHog sur son cloud européen, sans votre adresse, sans profil de personne ni géolocalisation, et n’en conserve rien lui-même. Un design joint est stocké dans Cloudflare R2 dans l’UE ; seule l’équipe OpenPencil peut l’ouvrir, et il est supprimé au bout de 90 jours.

## Tout désactiver

- **Paramètres → Confidentialité** propose un interrupteur pour le ping et un autre pour les statistiques d’utilisation.
- Dans l’application de bureau, lancer OpenPencil avec `OPENPENCIL_TELEMETRY=0` ou `DO_NOT_TRACK=1` dans son environnement désactive les deux.
- Seules les versions officielles envoient quoi que ce soit. Les serveurs de développement, les applications compilées soi-même et les forks n’envoient rien, car l’option qui active l’envoi n’est définie que lorsque nous compilons une version officielle.

## Autres requêtes réseau

OpenPencil fonctionne d’abord en local, mais certaines fonctionnalités accèdent au réseau. L’application de bureau recherche des mises à jour au démarrage, sauf si vous désactivez cette option dans **Paramètres → Général**. **Aide → Rechercher des mises à jour…** fonctionne toujours. Tout le reste ci-dessous ne se connecte que lorsque vous utilisez la fonctionnalité concernée, et uniquement au service indiqué.

| Fonctionnalité | Où elle se connecte |
| --- | --- |
| Recherche de mises à jour (bureau) | GitHub Releases, pour connaître le dernier numéro de version |
| Chat IA et outils d’image | Le fournisseur que vous configurez, avec votre propre clé ; la liste des modèles provient de models.dev. Avec **OpenPencil Cloud** comme fournisseur, le service d’IA indiqué par votre serveur Cloud, avec un jeton pour votre espace de travail |
| Salles de collaboration | Directement les autres personnes de la salle ; des courtiers publics mettent les pairs en relation, et un relais TURN transporte le trafic lorsqu’une connexion directe est impossible |
| Stockage cloud | Le fournisseur de stockage que vous configurez |
| Polices | Google Fonts, qui peut fournir une police utilisée par un document mais non installée |
| Icônes | L’API Iconify, lorsque vous recherchez ou insérez des icônes |
| Icônes dans le HTML importé | jsDelivr, pour un index d’icônes, et l’API Iconify, pour les icônes candidates auxquelles un SVG intégré est comparé, par leur nom (le SVG n’est jamais envoyé), lorsque vous importez du HTML ; désactivez-le dans **Paramètres → Éditeur**, ou passez `--no-icon-names` à `openpencil import` |
| Ouvrir depuis une URL | L’adresse que vous ouvrez, ainsi que les feuilles de style, polices et images liées par sa page, récupérées depuis votre appareil |
| Photos libres de droits | Unsplash ou Pexels, avec votre propre clé, lorsque vous y faites une recherche ou placez l’une de leurs photos |

L’application, le service de feedback et cette page sont open source. La liste des événements se trouve dans [`packages/feedback/src/contract`](https://github.com/open-pencil/open-pencil/tree/master/packages/feedback/src/contract), et les tableaux ci-dessus sont générés à partir de celle-ci.
