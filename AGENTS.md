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

- **Racine publique (page « Site en construction ») :** <https://meudon9266.github.io/site_pedagogique/>
- **Accueil pédagogique :** <https://meudon9266.github.io/site_pedagogique/accueil/>
- **Plan du site public :** <https://meudon9266.github.io/site_pedagogique/accueil/plan-du-site.html>
- **Fichier local correspondant au plan :** `C:\Obsidian\Publication de sites\Site_pedagogique\github\accueil\plan-du-site.html`

GitHub Pages construit le site public à partir du contenu envoyé sur la branche `main`. Une modification du miroir local n’est donc pas visible publiquement tant qu’elle n’a pas été validée par un commit puis envoyée sur GitHub.

## Principe impératif

Une demande de modification du site autorise uniquement la modification du miroir local. Elle n’autorise pas la publication.

La publication commence seulement après un ordre explicite tel que :

> Publie les modifications validées.

Sans cet ordre, ne créer aucun commit de publication et ne faire aucun envoi vers GitHub.

## Architecture stable du site

- `index.html`, à la racine, affiche uniquement la page « Site en construction ». Cette page ne contient aucun lien vers l’accueil pédagogique.
- `accueil/` contient la page d’accueil réelle, le plan du site et toute l’arborescence des pages de navigation par matière, programme, domaine, thème et niveau.
- `pages/` contient les exercices et autres contenus pédagogiques à adresse stable. Les fichiers y sont rangés à plat et sont retrouvés grâce à leur identifiant unique.
- Un changement de classement pédagogique modifie les pages sous `accueil/` et leurs liens, mais ne déplace pas les fichiers déjà placés dans `pages/`.
- Les triplets HTML, JavaScript et JSON d’un exercice restent ensemble dans `pages/`, avec exactement le même radical.
- Une page d’exercice accessible directement ne doit contenir ni fil d’Ariane ni lien de retour révélant le dossier `accueil/`. Les liens directs entre exercices et vers leurs documents associés restent permis.
- Chaque page HTML comporte `<meta name="robots" content="noindex, nofollow">` afin de limiter l’indexation fortuite. Cette balise réduit la découverte par les moteurs de recherche, mais ne constitue ni un mot de passe ni une protection d’accès.
- Le dépôt GitHub restant public, une personne qui connaît son adresse peut toujours consulter ou télécharger les fichiers. L’organisation `accueil/` / `pages/` vise la stabilité des adresses et la discrétion ordinaire, pas la confidentialité.

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
- Modifier le fichier d’index de la rubrique concernée sous `accueil/`.
- Ajouter une page `index.html` dans chaque nouveau sous-répertoire pédagogique de `accueil/`.
- Placer tout nouvel exercice identifié dans `pages/` sans recréer l’arborescence pédagogique autour de lui.
- Employer des noms de fichiers en minuscules, sans espace ni accent.
- Ne pas créer une arborescence parallèle dans une copie de travail temporaire.

#### Feuille de style commune des pages de navigation

- La feuille `styles/navigation.css` centralise les couleurs et les comportements d’affichage communs aux pages de navigation.
- Toute nouvelle page `index.html` sous `accueil/` et toute nouvelle page générale de navigation doivent charger cette feuille avec un chemin relatif adapté à leur profondeur.
- Les variables communes, notamment `--blue` et `--blue-dark`, doivent être réglées en priorité dans cette feuille plutôt que recopiées différemment dans chaque nouvelle page.
- Les pages d’exercices dont le nom commence par `exi-` ne chargent pas automatiquement cette feuille : elles conservent leurs styles propres jusqu’à ce qu’une analyse individuelle ait confirmé quels éléments peuvent être mutualisés sans altérer leur fonctionnement ni leur identité visuelle.

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

#### Chargement manuel d’un fichier de données en mode local

Cette règle est obligatoire pour toute nouvelle application utilisant un fichier de données externe, notamment un fichier `.json`, ainsi que lors de l’adaptation d’une application existante qui possède déjà un bouton de chargement manuel.

- Le bouton de chargement manuel doit porter l’attribut HTML `hidden` dès la construction de la page afin qu’il n’apparaisse jamais brièvement sur le site web avant l’exécution du JavaScript.
- Sur le site servi en `http:` ou `https:`, l’application charge automatiquement son fichier de données, démarre directement et ne révèle jamais le bouton de chargement manuel.
- Si le chargement automatique échoue sur le site web, afficher un message d’erreur explicite ; ne pas faire apparaître le bouton réservé au fonctionnement local.
- Lorsque la page est ouverte directement avec le protocole `file:`, afficher le bouton de chargement manuel en bas de la page, car le navigateur peut bloquer la lecture automatique du fichier externe.
- En mode local, rechercher d’abord une copie valide des données déjà mémorisée dans le navigateur. Si elle existe, démarrer automatiquement l’application avec cette copie tout en laissant le bouton affiché.
- Le bouton local doit permettre de sélectionner à nouveau le fichier de données après sa modification. Après validation de son contenu, remplacer la copie mémorisée et relancer ou actualiser l’application.
- Identifier la copie mémorisée avec une clé propre à l’exercice, fondée au minimum sur son identifiant Exi et le nom ou la version du fichier de données, afin d’éviter toute confusion entre exercices.
- Ne jamais remplacer une copie valide mémorisée par un fichier illisible ou invalide. Afficher l’erreur et conserver la dernière version exploitable.
- Si le navigateur refuse également la mémorisation pour une page en `file:`, conserver le chargement manuel à chaque ouverture comme solution de repli.

Le comportement à vérifier est donc le suivant :

1. **Site web :** aucun bouton de chargement local ; chargement automatique des données et démarrage direct.
2. **Première ouverture locale sans copie mémorisée :** bouton visible en bas de page ; l’utilisateur sélectionne le fichier de données.
3. **Ouvertures locales suivantes :** démarrage automatique depuis la copie mémorisée ; bouton toujours visible en bas pour recharger une version modifiée.

Cette règle s’applique également aux autres formats de données externes lorsque leur lecture automatique peut être bloquée en ouverture locale.

### 4. Mettre à jour les fichiers de navigation et d’inventaire

Lorsqu’une page pédagogique est ajoutée :

1. placer la page dans `pages/` et ajouter son lien dans l’index de sa rubrique sous `accueil/` ;
2. ajouter l’entrée dans `accueil/plan-du-site.html` ;
3. attribuer un identifiant dans `accueil/Fiche - identifiants Exi du plan du site.md` ;
4. prendre le premier numéro disponible dans `C:\Obsidian\Publication de sites\numéros d'identification des Exi.md` ;
5. préfixer ce numéro par `exi-`, puis supprimer le numéro consommé de la liste des disponibilités ;
6. commencer le nom du fichier par cet identifiant, sous la forme `exi-<numéro>-<nom-explicite>.html` ou `exi-<numéro>-<nom-explicite>.pdf` ;
7. créer sa carte dans `accueil/Fiche - cartes d'identité des exercices.md`, avec le fichier, le titre, les tags, la description, les étoiles, le niveau et le libellé du bouton ;
8. mettre à jour le nombre de numéros encore disponibles dans l’en-tête de cette liste.

### 4 bis. Synchroniser les cartes d’identité

`accueil/Fiche - cartes d'identité des exercices.md` est la source de référence des pavés de présentation.

Au début de chaque modification du site :

1. lire cette fiche ;
2. repérer les cartes dont le champ **À synchroniser** vaut `Oui` ou `O`, sans tenir compte des majuscules ;
3. répercuter exactement leurs informations dans les pages de navigation, dans `accueil/plan-du-site.html` et, lorsque les champs existent, dans le titre, la description ou l’en-tête de la page d’exercice ;
4. vérifier les liens, l’affichage et la cohérence des informations ;
5. remettre le champ à `Non` seulement après une synchronisation réussie.

Ne jamais modifier l’identifiant d’une carte existante. Si un nom de fichier change, mettre à jour simultanément tous les liens, la fiche des identifiants, la carte d’identité et le plan du site.

Les fichiers `Index.md` produits automatiquement par Obsidian restent exclus, sauf demande explicite. Les fiches Markdown nommément demandées font exception.

### 5. Vérifier localement

Avant toute proposition de publication :

- vérifier tous les liens relatifs ;
- pour toute application utilisant des données externes, vérifier séparément son comportement sur le site web et par ouverture locale directe ;
- confirmer que le bouton de chargement manuel est absent sur le site web, visible en mode local et encore disponible après un démarrage depuis les données mémorisées ;
- vérifier que la racine affiche seulement « Site en construction » et ne révèle aucun lien vers `accueil/` ;
- vérifier qu’une page ouverte directement depuis `pages/` ne propose aucun retour vers l’arborescence de navigation ;
- vérifier les scripts des exercices interactifs ;
- pour chaque jeu en triplet, vérifier la présence conjointe du `.html`, du `.js` et du `.json`, avec un radical et une casse identiques ;
- contrôler la navigation `accueil/` → matière → niveau → thème → activité ;
- ouvrir les pages principales sur ordinateur et, si nécessaire, en affichage étroit ;
- vérifier le plan du site ;
- vérifier que chaque identifiant Exi est unique ;
- vérifier que chaque fichier d’exercice commence par son identifiant Exi ;
- vérifier que chaque entrée du plan possède une carte d’identité et que son chemin correspond ;
- traiter toutes les cartes marquées `Oui` ou `O` dans `accueil/Fiche - cartes d'identité des exercices.md` ;
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
