---
pageClass: guide
title: Stockage cloud
description: Conservez vos documents et bibliothèques de composants dans votre propre bucket compatible S3 — AWS S3, Backblaze B2, Cloudflare R2, MinIO et d’autres.
---

# Stockage cloud

OpenPencil peut conserver vos documents dans un bucket qui vous appartient, sur n’importe quel service compatible S3 : AWS S3, Backblaze B2, Cloudflare R2, MinIO et d’autres. Aucun serveur OpenPencil ne s’intercale : l’éditeur communique directement avec votre bucket, avec vos propres clés d’accès.

## Connecter un bucket

Ouvrez **Paramètres → Stockage**, sélectionnez **Stockage S3** et remplissez :

| Champ                 | Ce qu’il faut saisir                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| **Point de terminaison** | L’URL de l’API S3 du fournisseur, avec le chemin éventuellement requis. Voir les exemples ci-dessous. |
| **Bucket**            | Le nom du bucket.                                                                 |
| **Région**            | Facultatif. Laissé vide, il est déduit du point de terminaison, ou vaut `us-east-1` quand c’est impossible. |
| **ID de clé d’accès** | Une clé d’accès avec les droits de lecture, d’écriture, de listage et de suppression sur le bucket. |
| **Clé d’accès secrète** | Le secret de la clé.                                                            |

Exemples de points de terminaison :

- AWS S3 : `https://s3.eu-west-1.amazonaws.com`
- Backblaze B2 : `https://s3.eu-central-003.backblazeb2.com`
- Cloudflare R2 : `https://<account-id>.r2.cloudflarestorage.com`
- MinIO : `http://localhost:9000`, ou l’adresse où écoute votre serveur

Sélectionnez **Tester la connexion** pour vérifier le point de terminaison, les clés et le bucket avant d’enregistrer, puis **Enregistrer**. OpenPencil ajoute lui-même le bucket au point de terminaison, sous la forme `{endpoint}/{bucket}/{key}` : n’incluez donc pas le nom du bucket dans le point de terminaison.

Dans l’app de bureau, les clés d’accès sont conservées dans le gestionnaire d’identifiants du système. Dans le navigateur, elles sont chiffrées dans le stockage du navigateur, ou conservées seulement jusqu’à la fin de la session quand **Paramètres → Général → Mémoriser les clés API sur cet appareil** est désactivé.

## Autoriser l’app web dans CORS

Le navigateur ne peut joindre qu’un bucket qui accepte les requêtes provenant de l’origine de la page : l’app web a donc besoin d’une règle CORS sur le bucket. L’app de bureau envoie ses requêtes de façon native et n’en a pas besoin.

Ajoutez une règle comme celle-ci, avec les origines depuis lesquelles vous ouvrez OpenPencil :

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["https://cloud.openpencil.dev"],
    "ExposeHeaders": ["ETag", "Content-Range", "x-amz-request-id", "x-amz-id-2", "x-amz-version-id"],
    "MaxAgeSeconds": 3600
  }
]
```

L’app web passe de app.openpencil.dev à cloud.openpencil.dev : à une règle créée pour l’ancienne adresse, il faut ajouter la nouvelle. Définissez-la dans la console AWS, dans **Permissions → Cross-origin resource sharing** du bucket, dans le tableau de bord Cloudflare, dans **Settings → CORS policy** du bucket R2, ou avec la CLI de votre fournisseur. Quand la règle manque, **Tester la connexion** indique que le navigateur n’a pas pu joindre le bucket depuis le site actuel.

## Enregistrer un document dans le stockage

Ouvrez ou créez un document, puis choisissez **Fichier → Enregistrer dans…**. S’il n’y a aucun espace de travail Cloud parmi lequel choisir, le document est enregistré directement dans le bucket ; sinon, choisissez le bucket dans la liste. L’onglet y reste lié : **Enregistrer** et l’enregistrement automatique écrivent désormais dans le stockage au lieu d’un fichier local. Un `.fig` local que vous aviez ouvert garde son dernier contenu enregistré.

Pour ouvrir les documents stockés, sélectionnez votre bucket dans la barre latérale de l’Accueil. **Nouveau design**, avec le bucket sélectionné, y crée un document. L’Accueil liste tous les documents du bucket avec un aperçu lu dans le document lui-même : lister un gros fichier ne télécharge donc que sa miniature intégrée.

## Comment fonctionne l’enregistrement

L’enregistrement écrit d’abord le document sur cet appareil, puis l’envoie en arrière-plan : l’édition n’attend donc jamais le réseau. Si un envoi échoue ou que vous êtes hors ligne, il est relancé avec des délais croissants, et le travail en attente reprend quand vous vous reconnectez ou modifiez les paramètres de stockage.

Chaque document est envoyé en entier. Quand deux appareils enregistrent le même document, le dernier envoi l’emporte.

Les documents que vous avez ouverts restent en cache sur l’appareil pour se rouvrir plus vite, jusqu’à 500 Mo. Quand le cache est plein, seules les copies entièrement envoyées sont supprimées, et elles sont téléchargées à nouveau la prochaine fois que vous les ouvrez.

## Bibliothèques de composants

Le bucket peut aussi contenir des bibliothèques de composants. Dans **Ressources → Gérer les bibliothèques**, choisissez **Stockage** comme source pour y publier et y activer des bibliothèques au lieu de le faire sur cet appareil. La publication utilise des écritures conditionnelles : deux personnes qui publient la même bibliothèque en même temps ne peuvent donc pas écraser la révision de l’autre. Voir [Bibliothèques de composants](./component-libraries) pour publier et mettre à jour des bibliothèques.

## Contenu du bucket

OpenPencil n’écrit que sous deux préfixes et ne touche pas au reste du bucket :

- `open_pencil_storage/canvases/` — chaque document sous la forme `<id>.fig`, avec son nom et sa date de modification dans `<id>.meta.json`.
- `open-pencil/libraries/` — le `manifest.json` de chaque bibliothèque et ses révisions publiées.

## Remarques par fournisseur

- **Cloudflare R2** exige l’origine exacte de l’app web dans sa règle CORS ; il n’accepte pas les origines génériques comme `https://*.example.com`.
- **MinIO** répond aux requêtes CORS de n’importe quelle origine, sauf configuration contraire.
- **`rclone serve s3`** fonctionne, avec deux limites. Il rejette les requêtes CORS préliminaires (preflight) : l’app web a donc besoin d’un proxy inverse placé devant lui qui y répond, contrairement à l’app de bureau. Il ignore aussi les écritures conditionnelles : les publications simultanées d’une bibliothèque ne sont donc pas détectées.
