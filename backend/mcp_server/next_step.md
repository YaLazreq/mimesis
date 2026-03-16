Step 3: The Production Workshop — Flow Définitif
Phase A — Scenario + Visual Style Guide + Image d'Ancrage

Gemini Live dit: "Ok, je profile le scénario et je t'envoie les premiers visuels"
Worker Director (Gemini 2.5 Pro) reçoit tout le contexte et produit:

Le scénario complet découpé en 6 scènes
Le Visual Style Guide (palette, grain, style, format, direction artistique)


Worker Director génère l'image d'ancrage via Imagen — une frame qui définit le DNA visuel du spot
L'image d'ancrage est affichée sur le front
Gemini Live présente l'image: "Voilà la direction visuelle que je propose pour ton spot. C'est ce mood-là qu'on va suivre. Qu'est-ce que t'en penses?"
On attend la validation de l'utilisateur. Rien ne se passe tant qu'il n'a pas dit "ok, j'aime bien" ou demandé un ajustement
Si l'utilisateur veut changer → Worker Director régénère une nouvelle image d'ancrage → retour à l'étape 4
Si l'utilisateur valide → passage à la Phase B

Phase B — 6 Scene Workers (parallèle)

Gemini Live dit: "Ok, je fais générer les scènes, je te ping quand c'est prêt"
L'interface change — passage en mode Production Workshop, avec 6 emplacements de scènes visibles (vides pour l'instant)
Worker Director dispatche les 6 scènes simultanément. Chaque Scene Worker reçoit:

Le Visual Style Guide
L'image d'ancrage validée comme référence visuelle
Le JSON de sa scène spécifique


Chaque Scene Worker:

Query Vertex AI Vector Search pour trouver des références pertinentes (optionnel, skip si rien de pertinent)
Construit les prompts Imagen en intégrant: style guide + image d'ancrage + description de scène + références
Génère 2 keyframes (start + end)
Envoie les images au front via WebSocket


Les images apparaissent petit à petit sur le front — chaque scène se remplit au fur et à mesure que son worker termine
Gemini Live ne parle pas pendant la génération — elle attend que les 6 workers aient tous terminé

Phase C — Présentation du Scénario

Une fois les 12 images (6×2) toutes reçues, Gemini Live reçoit la notification
Gemini Live commence à dérouler le scénario: "Ok, voilà, le scénario c'est ça — scène 1, on ouvre sur..., scène 2, on enchaîne avec..." — elle marche l'utilisateur à travers la narration avec les images déjà en place
L'utilisateur écoute, regarde, réagit

Phase D — Itération Ciblée

L'utilisateur donne son feedback: "La scène 4 est trop sombre" ou "Je veux plus d'énergie dans la scène 2" ou "Change le cadrage de la scène 6"
Gemini Live capture le feedback et trigger uniquement le worker de la scène concernée — pas de regénération globale
Le Scene Worker ciblé reçoit: le même style guide + image d'ancrage + le JSON de scène mis à jour avec les ajustements
Il régénère les 2 keyframes → les nouvelles images remplacent les anciennes sur le front
Gemini Live confirme: "C'est mis à jour, regarde la scène 4 maintenant"
Boucle jusqu'à ce que l'utilisateur soit satisfait de toutes les scènes

Phase E — Validation + Output

Une fois les 6 scènes validées → scene_locked: true pour toutes