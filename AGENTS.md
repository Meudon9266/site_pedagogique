# Fiche de référence — mise à jour et publication du site pédagogique

Cette fiche décrit l’emplacement exact du site, la manière de le modifier et la procédure à suivre avant toute publication. Elle reprend et complète la fiche de principe située dans `C:\Obsidian\Publication de sites\Fiche - procédure de publication du site.md`.

## Adresses et emplacements de référence

### Miroir local officiel

- **Chemin Windows :** `C:\Obsidian\Publication de sites\Site_pedagogique\github`
- **Rôle :** copie de travail locale de référence et clone Git du site publié.
- **Dossier Git :** `C:\Obsidian\Publication de sites\Site_pedagogique\github\.git`
- **Branche de travail et de publication :** `main`
- **Branche distante suivie :** `origin/main`

Toutes les modifications du site doivent être effectuées dans ce miroir. Les copies placées dans les dossiers de travail de Codex ou ailleurs dans le coffre Obsidian ne sont ni la source officielle ni le miroir de publication.

### Dépôt GitHub

- **Dépôt :** `Meudon9266/site_pedagogique`
- **Adresse de consultation :** <https://github.com/Meudon9266/site_pedagogique>
- **Adresse Git du remote `origin` :** `https://github.com/meudon9266/site_pedagogique.git`
- **Branche publiée :** `main`

### Site public

- **Adresse :** <https://meudon9266.github.io/site_pedagogique/>
- **Plan du site public :** <https://meudon9266.github.io/site_pedagogique/plan-du-site.html>
- **Fichier local correspondant au plan :** `C:\Obsidian\Publication de sites\Site_pedagogique\github\plan-du-site.html`

GitHub Pages construit le site public à partir du contenu envoyé sur la branche `main`. Une modification du miroir local n’est donc pas visible publiquement tant qu’elle n’a pas été validée par un commit puis envoyée sur GitHub.

## Principe impératif

Une demande de modification du site autorise uniquement la modification du miroir local. Elle n’autorise pas la publication.

La publication commence seulement après un ordre explicite tel que :

> Publie les modifications validées.

Sans cet ordre, ne créer aucun commit de publication et ne faire aucun envoi vers GitHub.

## Procédure de mise à jour locale

### 1. Identifier le bon dossier

Toujours travailler dans :

`C:\Obsidian\Publication de sites\Site_pedagogique\github`

Vérifier que ce dossier contient `.git` et que le remote `origin` correspond au dépôt officiel.

### 2. Contrôler l’état du miroir

Avant de modifier :

- vérifier la branche active ;
- vérifier les modifications locales déjà présentes ;
- comparer `main` avec `origin/main` ;
- synchroniser seulement si cela ne risque pas d’écraser un travail local ;
- en cas de conflit ou de fichiers non suivis importants, interrompre la synchronisation et examiner les différences.

### 3. Modifier l’arborescence existante

- Respecter exactement les noms, la casse et les niveaux déjà utilisés.
- Modifier le fichier d’index de la rubrique concernée.
- Ajouter une page `index.html` dans chaque nouveau sous-répertoire pédagogique.
- Employer des noms de fichiers en minuscules, sans espace ni accent.
- Ne pas créer une arborescence parallèle dans une copie de travail temporaire.

#### Triplets HTML, JavaScript et JSON

Certains jeux utilisent trois fichiers associés dont le radical commun sert de liaison automatique :

La spécification réutilisable complète de ces exercices est décrite dans `Fiche - spécification technique des exercices interactifs.md`.

```text
<radical>.html
<radical>.js
<radical>.json
```

Pour ces jeux, les trois fichiers constituent une seule unité de déplacement et de publication.

- Conserver les trois fichiers dans le même répertoire.
- Conserver exactement le même radical et la même casse pour les trois extensions.
- Copier, déplacer, renommer, archiver et publier les trois fichiers simultanément.
- Ne jamais effectuer l’une de ces opérations sur un seul fichier du triplet.
- Lors de l’attribution d’un identifiant Exi, préfixer les trois fichiers avec le même `exi-<numéro>-`.
- Faire pointer les pages de navigation, le plan du site et la carte d’identité vers le `.html` ; le `.js` et le `.json` restent associés automatiquement par leur nom.

Exemple valide :

```text
exi-123-calcul-mental-10ans.html
exi-123-calcul-mental-10ans.js
exi-123-calcul-mental-10ans.json
```

Après tout déplacement ou renommage, vérifier dans le navigateur que le HTML charge bien le JavaScript et que le JavaScript charge bien le JSON.

### 4. Mettre à jour les fichiers de navigation et d’inventaire

Lorsqu’une page pédagogique est ajoutée :

1. ajouter son lien dans l’index de sa rubrique ;
2. ajouter l’entrée dans `plan-du-site.html` ;
3. attribuer un identifiant dans `Fiche - identifiants Exi du plan du site.md` ;
4. prendre le premier numéro disponible dans `C:\Obsidian\Publication de sites\numéros d'identification des Exi.md` ;
5. préfixer ce numéro par `exi-`, puis supprimer le numéro consommé de la liste des disponibilités ;
6. commencer le nom du fichier par cet identifiant, sous la forme `exi-<numéro>-<nom-explicite>.html` ou `exi-<numéro>-<nom-explicite>.pdf` ;
7. créer sa carte dans `Fiche - cartes d'identité des exercices.md`, avec le fichier, le titre, les tags, la description, les étoiles, le niveau et le libellé du bouton ;
8. mettre à jour le nombre de numéros encore disponibles dans l’en-tête de cette liste.

### 4 bis. Synchroniser les cartes d’identité

`Fiche - cartes d'identité des exercices.md` est la source de référence des pavés de présentation.

Au début de chaque modification du site :

1. lire cette fiche ;
2. repérer les cartes dont le champ **À synchroniser** vaut `Oui` ou `O`, sans tenir compte des majuscules ;
3. répercuter exactement leurs informations dans les pages de navigation, dans `plan-du-site.html` et, lorsque les champs existent, dans le titre, la description ou l’en-tête de la page d’exercice ;
4. vérifier les liens, l’affichage et la cohérence des informations ;
5. remettre le champ à `Non` seulement après une synchronisation réussie.

Ne jamais modifier l’identifiant d’une carte existante. Si un nom de fichier change, mettre à jour simultanément tous les liens, la fiche des identifiants, la carte d’identité et le plan du site.

Les fichiers `Index.md` produits automatiquement par Obsidian restent exclus, sauf demande explicite. Les fiches Markdown nommément demandées font exception.

### 5. Vérifier localement

Avant toute proposition de publication :

- vérifier tous les liens relatifs ;
- vérifier les scripts des exercices interactifs ;
- pour chaque jeu en triplet, vérifier la présence conjointe du `.html`, du `.js` et du `.json`, avec un radical et une casse identiques ;
- contrôler la navigation accueil → matière → niveau → thème → activité ;
- ouvrir les pages principales sur ordinateur et, si nécessaire, en affichage étroit ;
- vérifier le plan du site ;
- vérifier que chaque identifiant Exi est unique ;
- vérifier que chaque fichier d’exercice commence par son identifiant Exi ;
- vérifier que chaque entrée du plan possède une carte d’identité et que son chemin correspond ;
- traiter toutes les cartes marquées `Oui` ou `O` dans `Fiche - cartes d'identité des exercices.md` ;
- contrôler la liste exacte des fichiers modifiés et nouveaux ;
- confirmer qu’aucun fichier extérieur à la demande n’a été modifié.

## Procédure de publication

Cette partie n’est exécutée qu’après l’ordre explicite de publication.

1. Relire la liste complète des changements Git.
2. Vérifier que les modifications correspondent exactement aux éléments validés.
3. Vérifier qu’aucun triplet `.html` / `.js` / `.json` n’est incomplet dans les changements à publier.
4. Créer un commit au message clair décrivant le lot publié.
5. Envoyer le commit vers `origin/main`.
6. Vérifier que `main` et `origin/main` désignent le même commit.
7. Attendre la mise à jour de GitHub Pages.
8. Ouvrir le site public et contrôler les pages concernées ainsi que le plan du site.
9. Communiquer le commit publié et les adresses publiques vérifiées.

## Que faire en cas de problème

- **Miroir non propre :** préserver les changements existants et déterminer leur origine avant toute synchronisation.
- **Conflit avec GitHub :** ne rien écraser ; comparer les deux versions et demander une décision si nécessaire.
- **Lien cassé :** corriger le chemin relatif dans l’index ou le plan avant publication.
- **Triplet incomplet :** ne pas publier ; retrouver ou recréer le fichier manquant et rétablir le radical commun avant de poursuivre.
- **Fichier placé dans une mauvaise copie :** ne pas le publier ; refaire la modification dans le miroir officiel.
- **Publication non demandée :** laisser les changements uniquement dans le miroir local.

## Résultat attendu avant publication

- les pages sont présentes dans le miroir officiel ;
- les index et le plan du site sont à jour ;
- les identifiants Exi sont attribués et retirés de la liste des disponibilités ;
- les liens et exercices ont été vérifiés ;
- Git indique clairement les changements locaux ;
- aucun commit ni envoi n’a été effectué sans ordre explicite.
