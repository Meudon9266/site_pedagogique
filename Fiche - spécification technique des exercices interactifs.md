# Spécification technique des exercices interactifs en triplet

Cette fiche définit le modèle réutilisable retenu pour les exercices interactifs du site pédagogique. Elle décrit l’architecture des fichiers, leur nommage, leurs échanges, les règles de tirage et de correction, la mémorisation locale, ainsi que l’ergonomie attendue sur ordinateur et téléphone.

L’implémentation de référence est le parcours :

`Francais/conjugaison/parcours9H/exi-14-01-E1E66-aimer-finir`

La fiche décrit le fonctionnement générique. Les verbes, les temps et les contenus cités ne sont que des exemples de données remplaçables.

## 1. Principe général

Un exercice interactif complet repose sur trois fichiers placés dans le même répertoire et portant exactement le même radical :

```text
exi-<identifiant>-<nom-explicite>.html
exi-<identifiant>-<nom-explicite>.js
exi-<identifiant>-<nom-explicite>.json
```

Exemple :

```text
exi-14-01-E1E66-aimer-finir.html
exi-14-01-E1E66-aimer-finir.js
exi-14-01-E1E66-aimer-finir.json
```

Le triplet constitue une seule unité. Il doit toujours être copié, déplacé, renommé, vérifié et publié en entier.

| Fichier | Fonction principale |
|---|---|
| `.html` | Présentation, écrans, boutons, accessibilité, mise en page et adaptation au téléphone. |
| `.js` | Moteur de l’exercice : chargement des données, tirage, correction, scores, historique et interactions. |
| `.json` | Données pédagogiques et paramètres variables : contenus à apprendre, formes attendues, confusions et limites de jeu. |

Les pages de navigation, le plan du site et les cartes d’identité pointent uniquement vers le fichier `.html`. Les fichiers `.js` et `.json` sont chargés automatiquement.

## 2. Règles de nommage

Le radical commun respecte les règles suivantes :

- commencer par l’identifiant Exi attribué à l’exercice ;
- écrire cet identifiant avec des tirets uniquement, par exemple `exi-14-01-E1E66` : aucun point ne figure à l’intérieur de l’identifiant ;
- utiliser des minuscules pour la partie descriptive ;
- ne pas employer d’espace ni d’accent dans le nom du fichier ;
- séparer les mots par des tirets ;
- conserver strictement la même casse et le même radical pour les trois extensions ;
- ne jamais coder ce radical en dur à l’intérieur des liens entre les trois fichiers.

Un changement de nom doit être appliqué simultanément aux trois fichiers et à toutes les références externes : index de rubrique, plan du site, fiche des identifiants et carte d’identité.

Le nom du radical sert également d’identifiant de stockage local. Renommer un exercice crée donc un nouvel espace de scores et de paramètres dans le navigateur.

## 3. Liaison automatique entre les fichiers

### 3.1. Du HTML vers le JavaScript

Le HTML détermine sa propre adresse, retire une éventuelle recherche ou ancre, puis remplace uniquement l’extension `.html` par `.js`.

Principe :

```text
adresse de la page HTML
→ retrait de ?paramètre et de #ancre
→ remplacement de .html par .js
→ insertion dynamique du script
```

Cette méthode permet de renommer ou de déplacer le triplet sans modifier un nom de fichier dans le code.

### 3.2. Du JavaScript vers le JSON

Le JavaScript utilise l’adresse de son propre élément `<script>`, puis remplace `.js` par `.json` après avoir retiré la recherche et l’ancre.

Principe :

```text
adresse du script en cours
→ retrait de ?paramètre et de #ancre
→ remplacement de .js par .json
→ chargement des données
```

### 3.3. Ordre de chargement des données

Le bouton de chargement manuel du fichier de données porte l’attribut HTML `hidden` dès la construction de la page.

Le moteur distingue ensuite deux situations :

1. sur un site servi en `http:` ou `https:`, il charge automatiquement le JSON externe avec `fetch`, sans utiliser une ancienne copie en cache ;
2. une seconde tentative peut être effectuée avec `XMLHttpRequest` ;
3. si le chargement échoue sur le site, un message explicite est affiché, mais le bouton réservé au mode local reste masqué ;
4. lors d’une ouverture directe en `file:`, le bouton est affiché en bas de la page, car le navigateur peut bloquer la lecture automatique du JSON voisin ;
5. en mode local, le moteur recherche d’abord une copie valide précédemment mémorisée dans le navigateur et démarre automatiquement avec elle lorsqu’elle existe ;
6. le bouton reste visible en mode local afin de sélectionner ou de recharger le JSON après une modification ;
7. le fichier sélectionné est validé avant de remplacer la copie mémorisée. Un fichier invalide ne doit jamais écraser la dernière copie exploitable.

La clé de mémorisation est propre à l’exercice et repose au minimum sur son identifiant Exi et sur le nom ou la version du fichier de données. Aucune copie complète du JSON n’est intégrée au JavaScript.

## 4. Contrat de données du JSON

Le JSON contient au minimum :

```json
{
  "version": 1,
  "title": "Titre de l’exercice",
  "persons": ["je", "tu", "il", "nous", "vous", "ils"],
  "tenseGroups": {
    "simple": ["présent"],
    "compound": ["passé composé"]
  },
  "settings": {
    "defaultChallengeGoal": 10,
    "defaultWorkDurationSeconds": 300,
    "minimumChallengeGoal": 3,
    "maximumChallengeGoal": 30,
    "minimumWorkDurationMinutes": 1,
    "maximumWorkDurationMinutes": 10,
    "reviewInterval": 2
  },
  "confusions": {},
  "residualProblems": {
    "ambiguityPolicy": {},
    "ambiguousForms": []
  },
  "verbs": {}
}
```

### 4.1. Contenus pédagogiques

Chaque entrée de contenu possède ses métadonnées et ses tableaux de réponses. Dans le cas de la conjugaison :

```json
"verbe": {
  "group": "groupe pédagogique",
  "participle": "participe",
  "forms": {
    "présent": ["forme 1", "forme 2", "forme 3", "forme 4", "forme 5", "forme 6"],
    "infinitif présent": ["forme unique"]
  }
}
```

Le moteur vérifie les données avant d’afficher l’exercice :

- chaque contenu doit posséder toutes les catégories annoncées ;
- chaque temps personnel doit contenir autant de formes que le tableau `persons` ;
- un infinitif doit contenir une seule forme ;
- aucun tableau requis ne doit être vide.

Une erreur de structure bloque l’exercice et produit un message de chargement explicite au lieu de lancer un jeu incomplet.

### 4.2. Paramètres modifiables sans changer le moteur

Le JSON doit recevoir les éléments qui varient d’un exercice à l’autre :

- données à interroger ;
- groupes ou catégories ;
- liste et ordre des notions proposées ;
- associations de confusions utilisées pour fabriquer les mauvaises réponses ;
- objectif et limites du mode défi ;
- durée et limites du mode travail ;
- délai de réapparition d’une erreur ;
- problèmes résiduels connus et règle retenue pour les traiter.

Le HTML et le JavaScript restent aussi génériques que possible.

## 5. Construction du réservoir de questions

Après validation du JSON, le moteur développe les tableaux de données pour créer un réservoir de questions élémentaires.

Pour la conjugaison, chaque question contient :

- le verbe ;
- le temps ;
- la personne, sauf pour l’infinitif ;
- l’indice de la personne ;
- la forme correcte.

Chaque forme de chaque verbe et de chaque temps devient donc une entrée du réservoir. Une forme identique présente dans deux temps produit deux entrées distinctes, mais la gestion des ambiguïtés empêche une correction injuste.

## 6. Algorithme de tirage

### 6.1. Tirage ordinaire

En l’absence d’erreur à revoir, une entrée est choisie aléatoirement dans l’ensemble du réservoir avec une probabilité uniforme par entrée.

Conséquences :

- les temps personnels, qui comportent plusieurs personnes, fournissent davantage d’entrées que les infinitifs ;
- le tirage porte sur les questions complètes, et non successivement sur un verbe, un temps puis une personne ;
- aucune ancienne page par niveau n’est consultée ; les trois niveaux utilisent le même réservoir courant.

### 6.2. Mélange des propositions

Le mélange des choix utilise un mélange aléatoire de type Fisher-Yates. La bonne réponse ne doit donc pas rester à une position fixe.

### 6.3. Reprise espacée des erreurs

Une mauvaise réponse crée ou actualise une entrée dans une file de reprise :

```text
clé de la difficulté
question source
numéro de question prévu pour la reprise
```

La reprise est programmée après le nombre de questions défini par `reviewInterval`. Avec la valeur `2`, la difficulté revient après deux avancées du compteur de questions.

Lorsqu’une reprise est arrivée à échéance, elle est prioritaire sur le tirage ordinaire. Une reprise réussie retire la difficulté de la file. Une nouvelle erreur reporte sa prochaine apparition.

Les clés de reprise sont séparées par niveau afin que les logiques d’interrogation ne se mélangent pas.

## 7. Trois niveaux de difficulté dans une seule page

Les trois niveaux partagent la même page, mais leur progression, leurs paramètres et leur historique sont séparés.

### 7.1. Niveau 1 — reconnaître la catégorie

L’écran montre une forme et demande d’identifier son temps ou sa catégorie.

Les choix conservent une séparation pédagogique fixe : les temps simples sont regroupés dans la colonne de gauche et les temps composés dans la colonne de droite. Il ne faut pas alimenter une grille unique ligne par ligne, car cela mélangerait visuellement les deux familles. Sur téléphone, ces deux groupes sont empilés tout en conservant leurs titres.

Le moteur ne se contente pas du temps ayant produit le tirage. Il recherche la même forme normalisée dans tous les temps du même verbe et construit la liste réelle des réponses acceptables.

#### Règle généralisée des ambiguïtés

Pour une forme possédant plusieurs réponses valides :

1. à sa première apparition dans la session, toutes les réponses exactes sont actives et acceptées ;
2. après une réponse correcte, le choix effectué est mémorisé pour cette forme ;
3. à l’apparition suivante, ce choix est grisé et non sélectionnable ;
4. les autres réponses exactes restent disponibles ;
5. lorsque toutes les possibilités ont été utilisées, le cycle est remis à zéro à l’apparition suivante.

La clé d’ambiguïté combine le contenu interrogé et sa forme normalisée. La règle fonctionne avec deux réponses possibles ou davantage. Une réponse fausse ne consomme aucune possibilité.

L’état de ce cycle est limité à la session en cours. Il n’est pas ajouté à l’historique permanent.

### 7.2. Niveau 2 — choisir la bonne réponse

L’écran indique le contenu, la catégorie demandée et, lorsqu’elle existe, la personne. Il propose quatre réponses.

Construction des propositions :

1. ajouter la bonne réponse ;
2. consulter la liste de confusions préférentielles de la catégorie ;
3. prendre, dans ces catégories, la forme correspondant au même indice de personne ;
4. compléter si nécessaire avec les autres catégories disponibles ;
5. éliminer les doublons après normalisation ;
6. limiter la liste à quatre propositions ;
7. mélanger les propositions.

Le temps ou la catégorie étant indiqué explicitement, une forme identique présente ailleurs ne rend pas la consigne ambiguë.

### 7.3. Niveau 3 — écrire la réponse

L’écran indique le contenu, la catégorie et la personne. L’élève saisit lui-même la réponse puis valide avec le bouton ou la touche Entrée.

La correction possède trois résultats :

- `exact` : même réponse après suppression des espaces superflus, passage en minuscules et uniformisation des apostrophes ;
- `typography` : même réponse après retrait supplémentaire des apostrophes et des signes diacritiques ;
- `wrong` : différence portant encore sur le contenu après ces normalisations.

Une réponse typographiquement différente mais grammaticalement correcte est acceptée. La graphie attendue est néanmoins montrée à l’élève. Une saisie vide n’est pas validée.

## 8. Modes de jeu

Chaque niveau offre les deux mêmes modes de démarrage.

### 8.1. Mode défi

- objectif par défaut : `10` réponses justes consécutives ;
- une erreur remet la série courante à zéro ;
- le nombre de bonnes réponses total, les essais et la meilleure série restent comptés ;
- le temps écoulé est affiché ;
- la partie se termine lorsque l’objectif de série est atteint ;
- l’objectif est modifiable dans les paramètres, entre les limites définies dans le JSON.

### 8.2. Mode travail

- durée par défaut : `5 minutes` ;
- objectif : fournir le maximum de bonnes réponses pendant cette durée ;
- le temps restant, le score, le nombre d’essais et le taux de réussite sont affichés ;
- la partie se termine automatiquement à la fin du compte à rebours ;
- la durée est modifiable dans les paramètres, entre les limites définies dans le JSON.

### 8.3. Rythme d’affichage

Après une réponse :

- tous les contrôles de réponse sont immédiatement désactivés ;
- la bonne réponse apparaît en vert ;
- une mauvaise sélection apparaît en rouge ;
- une réponse déjà utilisée dans un cycle ambigu apparaît en gris ;
- la question suivante arrive après environ `650 ms` en cas de réussite et `1 350 ms` en cas d’erreur.

Ce délai laisse lire la correction sans ralentir excessivement l’exercice.

## 9. Scores, erreurs et mémoire locale

Les paramètres et les sessions sont stockés avec `localStorage` dans le navigateur.

Le radical du script devient l’identifiant de l’application. Les clés suivent ce principe :

```text
<radical>.level1.settings
<radical>.level1.sessions
<radical>.level2.settings
<radical>.level2.sessions
<radical>.level3.settings
<radical>.level3.sessions
```

Cette séparation garantit :

- un objectif et une durée propres à chaque niveau ;
- un historique indépendant pour chaque niveau ;
- aucune confusion entre deux exercices différents ;
- aucune dépendance envers les anciens fichiers séparés.

Une session terminée mémorise notamment :

- le niveau et le mode ;
- le score et le nombre d’essais ;
- la meilleure série ;
- l’objectif et la durée utilisés ;
- le temps réellement écoulé ;
- la date de fin ;
- les réponses fausses, les réponses données et les réponses attendues ;
- les difficultés encore présentes dans la file de reprise.

L’élève peut consulter l’historique du niveau courant et l’effacer après confirmation.

La mémoire est locale au navigateur et à l’appareil. Elle n’est ni publiée dans le JSON, ni synchronisée entre un ordinateur et un téléphone, ni accessible depuis un autre navigateur.

## 10. Organisation de l’interface

La page utilise quatre états principaux :

1. chargement et validation des données ;
2. menu du niveau avec choix du mode ;
3. exercice en cours ;
4. bilan de session.

Des fenêtres superposées donnent accès aux paramètres et à l’historique sans quitter la page.

Les niveaux sont présentés comme trois onglets. L’ancre d’adresse suit la forme `#niveau-1`, `#niveau-2` ou `#niveau-3`, ce qui permet d’ouvrir directement un niveau sans créer trois fichiers HTML.

Un changement de niveau pendant une partie demande confirmation afin d’éviter de perdre involontairement la session en cours.

## 11. Ergonomie et accessibilité

### 11.1. Principes communs

- boutons suffisamment grands pour être utilisés au doigt ;
- contraste net entre texte, fond, validation, erreur et réponse indisponible ;
- intitulés explicites, sans dépendre uniquement d’une couleur ;
- retour visuel immédiat après une réponse ;
- focus clavier visible ;
- titres et descriptions associés aux zones de dialogue ;
- annonce des corrections avec une zone `aria-live` ;
- échappement des textes réaffichés dans l’historique afin d’éviter l’injection de balises ;
- navigation dans les onglets avec les flèches gauche et droite ;
- validation du niveau 3 avec la touche Entrée ;
- mise au point automatique dans le champ de saisie du niveau 3.

### 11.2. Présentation sur téléphone

Le HTML doit toujours contenir :

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

La largeur principale reste fluide, avec une largeur maximale sur grand écran et une marge latérale sur petit écran.

À partir d’une largeur maximale de `680 px` :

- les trois onglets sont empilés ;
- les deux cartes de mode sont empilées ;
- les propositions de réponse passent sur une seule colonne ;
- le champ et le bouton du niveau 3 passent en colonne ;
- les statistiques restent compactes sur trois colonnes ;
- le bouton pour quitter occupe une ligne complète ;
- les marges intérieures des cartes sont réduites.

Les fenêtres superposées ont une hauteur maximale et autorisent le défilement. Les longues listes de réponses utilisent le défilement vertical normal de la page.

## 12. Gestion des erreurs techniques

Le jeu ne doit pas afficher une interface active avant la validation des données.

Les erreurs suivantes doivent produire un message lisible :

- JavaScript voisin introuvable ;
- JSON introuvable ou illisible sur le site publié ;
- JSON syntaxiquement incorrect ;
- structure de données incomplète ;
- nombre de formes incohérent.

L’exercice ne dépend d’aucune bibliothèque extérieure. Après chargement de la page et des deux fichiers voisins, il peut donc fonctionner sans service distant.

## 13. Méthode de réutilisation pour un nouvel exercice

1. attribuer un nouvel identifiant Exi ;
2. copier le triplet de référence ;
3. renommer simultanément les trois fichiers avec le nouveau radical ;
4. modifier le titre, les textes d’introduction et les éventuels liens complémentaires dans le HTML ;
5. remplacer les contenus et paramètres dans le JSON ;
6. vérifier que le bouton de chargement du JSON est masqué sur le site, visible en ouverture locale et que la copie locale validée est mémorisée sous une clé propre à l’exercice ;
7. adapter uniquement les parties du moteur qui correspondent à une logique d’interrogation réellement différente ;
8. conserver la séparation des niveaux, des paramètres et des historiques ;
9. ajouter le lien du `.html` dans l’index de la rubrique, le plan du site, la fiche des identifiants et la carte d’identité ;
10. vérifier localement avant toute publication.

Il ne faut pas créer une page HTML distincte par niveau lorsque les niveaux partagent les mêmes données et le même parcours. Les onglets servent précisément à réunir ces variantes dans une seule application.

Il ne faut pas conserver d’anciens fichiers, redirections, liens d’archives ou clés de migration lorsque leur compatibilité n’est pas explicitement demandée.

## 14. Vérifications obligatoires

### 14.1. Structure

- les trois fichiers existent dans le même répertoire ;
- leurs radicaux sont strictement identiques ;
- le HTML déduit le `.js` de son propre nom ;
- le JavaScript déduit le `.json` de son propre nom ;
- aucun radical d’exercice n’est codé en dur dans ces deux liaisons ;
- aucune copie complète du JSON n’est intégrée au JavaScript ;
- le bouton de chargement local est masqué par défaut dans le HTML ;
- une copie locale n’est mémorisée qu’après validation du fichier sélectionné ;
- le JSON est valide et passe la validation du moteur.

### 14.2. Fonctionnement pédagogique

- chaque niveau utilise la bonne logique d’interrogation ;
- les ambiguïtés du niveau 1 suivent le cycle accepté, grisé, puis réinitialisé ;
- les propositions du niveau 2 sont uniques et mélangées ;
- le niveau 3 accepte les écarts typographiques prévus sans accepter une mauvaise réponse ;
- une erreur revient après l’intervalle défini ;
- le défi se termine uniquement après la série demandée ;
- le travail se termine à la fin du temps imparti ;
- les scores et erreurs sont séparés par niveau.

### 14.3. Affichage et navigation

- la page fonctionne en ouverture locale dans Edge ;
- la page fonctionne depuis une adresse HTTP ou GitHub Pages ;
- aucun lien de retour ni fil d’Ariane ne révèle l’arborescence `accueil/` ;
- les éventuels liens directs vers des exercices ou documents complémentaires fonctionnent ;
- la navigation est vérifiée sur ordinateur ;
- l’affichage est vérifié à environ `390 px` de largeur ;
- les onglets, fenêtres, boutons, champs et messages restent utilisables au clavier ;
- aucun lien vers un ancien fichier ne subsiste.

### 14.4. Publication

La modification du miroir local n’autorise pas la publication. Le triplet, les index et les fiches associées ne sont validés et envoyés vers GitHub qu’après une demande explicite de publication.

## 15. Résumé des paramètres de référence

| Élément | Valeur retenue |
|---|---|
| Architecture | Un triplet `.html` / `.js` / `.json` de même radical |
| Niveaux | Trois onglets dans une seule page |
| Défi par défaut | 10 réponses justes de suite |
| Travail par défaut | Maximum de bonnes réponses en 5 minutes |
| Reprise d’une erreur | Après 2 questions par défaut |
| QCM | 4 propositions uniques et mélangées |
| Ambiguïté | Toutes les réponses d’abord, puis choix déjà utilisé grisé |
| Progression | Séparée pour chaque niveau |
| Mémoire | `localStorage`, séparé par exercice et par niveau |
| Adaptation mobile | Bascule principale à 680 px |
| Ouverture locale | Bouton manuel visible et copie validée mémorisée dans le navigateur |
| Source publiée | JSON externe voisin, prioritaire |
