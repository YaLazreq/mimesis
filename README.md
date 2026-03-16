# Mimesis

Mimesis est une plateforme d'agence créative propulsée par l'Intelligence Artificielle. Elle incarne un "Senior Creative Director" virtuel capable d'accompagner les marques depuis l'idéation jusqu'à la génération d'une publicité vidéo complète (6 scènes) en s'appuyant sur un système multi-agents et les modèles avancés de Google Cloud Vertex AI.

## Liens de Déploiement

- **Frontend** : [https://mimesis-frontend-980118844637.us-central1.run.app](https://mimesis-frontend-980118844637.us-central1.run.app)
- **Backend** : [https://mimesis-backend-980118844637.us-central1.run.app](https://mimesis-backend-980118844637.us-central1.run.app)

---

## 🚀 Comment lancer le projet

Le projet est divisé en deux parties principales : un **Frontend** (Next.js) et un **Backend** (FastAPI / Google ADK).

### Lancer le Backend
Un `Makefile` est disponible à la racine du projet pour vous faciliter la tâche.
1. Assurez-vous d'avoir configuré votre fichier `backend/.env` avec vos identifiants Google Cloud.
2. À la racine du projet, lancez :
   ```bash
   make run-backend
   ```
   *Cela démarrera le serveur Uvicorn sur `http://0.0.0.0:8000`.*

3. Pour surveiller les logs des différents agents et processus en arrière-plan (très utile pour débugger les workers) :
   ```bash
   make logs-backend
   ```

### Lancer le Frontend
1. Naviguez dans le dossier frontend :
   ```bash
   cd frontend
   ```
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Démarrez le serveur de développement :
   ```bash
   npm run dev
   ```
   *L'application sera accessible sur `http://localhost:3000`.*

---

## 🧪 Comment tester

Le projet suit un pipeline créatif en 4 étapes clés. Pour tester l'intégralité du flux, voici la démarche :

1. **Step 1 - Identité de marque et Upload d'image** :
   - Connectez-vous sur l'interface et activez l'agent vocal (Gemini Live). 
   - **Action** : Uploadez une image de votre produit. 
   - L'agent visuel en arrière-plan analysera l'image pour comprendre votre produit et ses couleurs dominantes. Parlez ensuite avec l'agent vocal de vos valeurs, votre mission et de "l'ennemi commun" de votre marque.

2. **Step 2 - Le Séquencier (Génération narratrice)** :
   - Une fois l'identité établie, l'agent génèrera une séquence maître (*Master Sequence*) constituée de 6 actes émotionnels (Hook, Context, Product Entry, Transformation, Climax, Resolution).
   - **Action** : Observez la séquence apparaître sur l'UI. Vous pouvez demander à l'agent (à la voix) de modifier certains détails (par ex: "Je préfère que la scène 3 se passe en ville"). La séquence s'adaptera en temps réel.

3. **Step 3 - Enrichissement et Keyframes (Direction Artistique)** :
   - L'agent va déclencher la création des visuels *Keyframes* (Imagen 3).
   - **Action** : Vous verrez popper deux images de référence (start/end) pour chaque scène, confirmant la direction esthétique tout en gardant l'image du produit comme référence visuelle (ancrage).

4. **Step 4 - Génération Média (Veo)** :
   - Le système lance la génération vidéo finale.
   - **Action** : Patientez pendant que les clips vidéos sont générés et assemblés. Une fois terminé, la publicité complète s'affichera à l'écran.

---

## ⚙️ Comment ça fonctionne (Toute l'histoire des Workers)

Mimesis repose sur une architecture "Event-Driven" robuste. Pendant que l'agent vocal (ADK) converse avec vous, il délègue les tâches lourdes à des *Workers* (travailleurs asynchrones) via un serveur MCP (Model Context Protocol).

Voici l'enchaînement exact des opérations :

1. **Worker 6 (Image Analysis)** : 
   - *Déclencheur* : Upload d'une image par l'utilisateur.
   - *Rôle* : Utilise Gemini Vision pour disséquer l'image, extraire les codes couleurs HEX, l'ambiance visuelle, et la stocker sur Cloud Storage. Il met à jour l'état de l'application sans interrompre la conversation vocale.

2. **Worker 7 (Sequence Generator)** : 
   - *Déclencheur* : Validation du brief par l'agent.
   - *Rôle* : Combine l'identité de marque (Brand Intelligence) et le brief pour générer une séquence en 6 scènes via Gemini 2.5 Flash. Il respecte une courbe émotionnelle stricte et envoie le résultat au Frontend via WebSocket.

3. **Step 3 Workers (Director & Scene Worker)** : 
   - *Rôle* : Le `director.py` traduit la séquence maître en prompts ultra-détaillés esthétiquement. Ensuite, le `scene_worker.py` prend le relais en appelant Imagen 3 pour générer les Keyframes. Il utilise l'image du produit initial comme "Anchor" pour garantir la consistance du produit d'une scène à l'autre.

4. **Worker 8 (Video Generator Pipeline)** : 
   - C'est le chef d'orchestre final, composé de 3 sous-étapes :
     1. **Prompt Génération** : Gemini traduit les scripts des scènes en requêtes spécifiques pour Veo.
     2. **Veo 3.1** : Génère les clips. Il utilise intelligemment soit l'interpolation de Keyframes (pour les scènes principales), soit l'extension de vidéo (pour les *insert shots*) en contournant les contraintes de Veo (qui interdit d'avoir une image de référence textuelle combinée avec une image de départ).
     3. **FFmpeg Stitching** : Assemble tous les `.mp4` générés par Veo en un seul fichier publicitaire de 30 secondes, lissé et prêt à être diffusé.

---

## 🧠 APIs Vertex et Modèles Utilisés

Pour fonctionner, le projet fait appel aux fleurons de l'IA Google Cloud :

- **Gemini Live (Voice API / ADK)** : Gère le streaming bidirectionnel audio/texte entre l'utilisateur et l'agent, garantissant une communication fluide et réactive en temps réel, avec des modalités vocales natives.
- **Gemini 2.5 Flash / Pro (`gemini-2.5-flash`)** : Le modèle central utilisé par les Workers pour l'analyse structurelle (Génération de séquences, Analyse visuelle d'images produit, orchestration de prompts complexes).
- **Imagen 3 (`gemini-2.5-flash-image`)** : Appelé dans le Step 3 métier pour générer les visuels (Keyframes) nécessaires à la pré-visualisation des scènes.
- **Veo 3.1 (`veo-3.1-generate-preview`)** : Le puissant modèle vidéo. Utilisé au Step 4 pour la génération de vidéos hyper-réalistes temporelles via `generate_videos()`.

### Endpoints (Points API) et Mécanique de fond à connaître
L'architecture Backend expose plusieurs "points off" essentiels qui relient l'IA au Frontend et à la base de données :

- **WebSocket streaming (`/ws/{user_id}/{session_id}`)** : Le canal de communication direct pour la voix et les événements live.
- **WebSocket State (`/ws/state/{session_id}`)** : Canal dédié pour pousser instantanément les changements d'interface graphique (Layout) et d'état au frontend, sans requête HTTP manuelle du client.
- **`POST /api/state/update`** & **`POST /api/state/layout`** : Endpoints internes utilisés par les outils (Tools) de l'agent pour modifier ce que l'utilisateur voit (ex: faire apparaître le séquenceur).
- **`POST /api/session/notify`** : Très important. Permet aux Workers asynchrones d'injecter une notification système directement dans "le cerveau" de Gemini Live (ex: "[WORKER NOTIFICATION] La vidéo est prête, annonce-le à l'utilisateur !").
- **`POST /api/session/upload-image`** : Le point d'entrée pour les images dropées sur le Frontend, qui lance le processus sur GCS.
- **`GET /api/gcs-proxy`** : Un proxy indispensable pour envoyer les images sécurisées de Google Cloud Storage vers le Frontend sans avoir à ouvrir le bucket publiquement.

---

## 💾 Données stockées (State & Repo Data)

Le projet gère les données sur deux plans distincts :

1. **State Store (Mémoire applicative / Base de données)**
   Tout l'état courant d'une "Session" est stocké en mémoire de l'application (et prêt à basculer sur Cloud SQL ou Firestore). On y trouve :
   - Les informations de la marque : `brand_name`, `brand_slogan`, `brand_mission`, `brand_common_enemy`.
   - La direction artistique : `creative_angles`, `brand_symbols`, `style_keywords`.
   - Le brief : `ad_objective`, `audience_persona`, `ad_tone`.
   - L'état de l'UI : Quels composants sont actuellement `visible_components`.

2. **Google Cloud Storage (Fichiers Binaires)**
   Tous les médias lourds sont envoyés vers un bucket GCS spécifique, organisé par session : `gs://[BUCKET_NAME]/[PREFIX]/[SESSION_ID]/`. On y retrouve :
   - Les uploads utilisateurs (ex: la fameuse `"anchor_image_uri"`).
   - Toutes les _Keyframes_ générées au format PNG (`scene_1_keyframe_start.png`).
   - Tous les extraits vidéos bruts issus de Veo (`clip_01_main_scene.mp4`).
   - Le rendu de la vidéo finale (`final_commercial.mp4`).
