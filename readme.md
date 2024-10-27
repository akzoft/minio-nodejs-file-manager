# Minio Node File Manager

**Minio Node File Manager** est une bibliothèque Node.js pour gérer les fichiers dans un serveur MinIO. Elle utilise `minio` pour l'intégration avec le serveur MinIO, et `multer` pour le traitement des fichiers dans les requêtes HTTP. Ce package est conçu pour être flexible et peut être configuré pour activer la compression des fichiers avant leur envoi sur le serveur.

## Table des matières

1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Utilisation](#utilisation)
   - [Upload de Fichiers](#upload-de-fichiers)
   - [Mise à Jour de Fichiers](#mise-à-jour-de-fichiers)
   - [Suppression de Fichiers](#suppression-de-fichiers)
   - [Middleware pour la Capture de Fichiers](#middleware-pour-la-capture-de-fichiers)
4. [Fonctionnalités](#fonctionnalités)
5. [Exemple de Code](#exemple-de-code)

---

## Installation

```bash
npm install minio multer path

```

## Configuration

Avant d'utiliser le FileManager, vous devez configurer votre client MinIO en fournissant les informations de connexion.

```
import { FileManager } from "minio-node-file-manager";

const config = {
endpoint: "localhost",
port: 9000,
useSSL: false,
accessKey: process.env.MINIO_ACCESS_KEY,
secretKey: process.env.MINIO_SECRET_KEY,
};

FileManager.configure(config);

```

## Utilisation

1. Upload de Fichiers:
   Pour uploader des fichiers vers MinIO, utilisez la méthode Upload :

```
const files = FileService.get_files_from_route_middleware(req);
const uploadedFiles = await FileService.Upload(files, "nom-du-bucket");

```

2. Mise à Jour de Fichiers
   Vous pouvez également mettre à jour des fichiers en ajoutant des données utilisateur :

```
const updatedFiles = await FileService.Upload(files, "nom-du-bucket", user);
```

3. Suppression de Fichiers
   Pour supprimer des fichiers existants dans un bucket MinIO :

const filesToDelete = FileService.pick_attribut_list_from_object_by_keys(user, ["photo", "cin", "video"]);
await FileService.Delete(filesToDelete, "nom-du-bucket");

4. Middleware pour la Capture de Fichiers
   Pour capturer des fichiers provenant de requêtes HTTP, définissez les noms de champs de fichier dans le middleware :

FileService.Capture(["photo", "cin", "video"]);

## Fonctionnalités

- Upload de fichiers : Télécharge des fichiers vers un bucket MinIO.
- Compression : Active la compression des fichiers (peut être configuré).
- Mise à jour de fichiers : Met à jour les fichiers existants en remplaçant les anciens fichiers par les nouveaux.
- Suppression de fichiers : Supprime des fichiers spécifiques d'un bucket MinIO.
- Gestion de Buckets : Crée et configure automatiquement les buckets s'ils n'existent pas.
  Politique d'accès : Assigne une politique d'accès de type Public pour chaque bucket.

Exemple de Code

```
import * as express from "express";
import { FileService } from "minio-node-file-manager";

const app = express();

app.post("/upload", async (req, res) => {
    try {
        const files = FileService.get_files_from_route_middleware(req);
        const result = await FileService.Upload(files, "mon-bucket");

        if (result) res.status(200).json({ message: "Fichiers uploadés avec succès", result });
        else res.status(500).json({ message: "Erreur lors de l'upload des fichiers" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialiser le serveur
app.listen(3000, () => {
    console.log("Serveur démarré sur http://localhost:3000");
});

```

## Licence

Ce projet est sous licence MIT.

# Contributions

Les contributions sont les bienvenues ! Veuillez soumettre une issue pour les suggestions d'améliorations ou les bogues que vous rencontrez.

# Remarques

Assurez-vous que MinIO est en cours d'exécution et accessible avec les informations de configuration fournies.
Si l'option de compression est activée, elle utilise la méthode compressor.Compress (qui doit être définie dans files-settings-manager).

Auteur: Akougnon Pierre DOLO

Ce `README.md` fournit une documentation complète pour le package, incluant les fonctionnalités, l'utilisation et un exemple de code d’implémentation.
