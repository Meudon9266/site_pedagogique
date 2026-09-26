# Spécification des échanges - Vocabulaire allemand 9H, leçon 1

## 1. Objectif

Cette spécification définit le contrat entre :

- `mots-a-apprendre.html`, qui permet à l'élève de choisir ses mots ;
- les futurs fichiers HTML d'interrogation placés dans le même répertoire ;
- `vocabulaire-lecon1.js`, qui contient la liste de référence et l'API commune.

Les pages d'interrogation ne doivent pas dupliquer la liste des mots ni lire directement la structure interne du stockage. Elles doivent charger `vocabulaire-lecon1.js` et utiliser `window.VocabulaireLecon1`.

## 2. Fichiers de référence

| Fichier | Rôle |
|---|---|
| `vocabulaire-lecon1.js` | Liste des mots, stockage et API partagée |
| `mots-a-apprendre.html` | Interface de sélection de l'élève |
| `SPECIFICATION-ECHANGES.md` | Contrat à respecter par les autres pages |

## 3. Identifiant de stockage

Les choix sont enregistrés dans `localStorage` sous la clé :

```text
site_pedagogique:allemand:9H:vocabulaire:lecon-1:selection:v1
```

`localStorage` est commun aux pages du même site et du même navigateur. Les choix ne sont donc pas synchronisés entre deux appareils, deux navigateurs ou deux profils différents.

Pour que le partage entre fichiers soit fiable, les pages doivent être consultées sur GitHub Pages ou depuis un serveur local. L'ouverture directe en `file://` peut isoler le stockage selon le navigateur.

## 4. Structure stockée

```json
{
  "version": 1,
  "updatedAt": "2026-09-26T12:00:00.000Z",
  "items": {
    "ecole": {
      "choisi": true,
      "prioritaire": false
    },
    "apprendre": {
      "choisi": true,
      "prioritaire": true
    }
  }
}
```

Seuls les éléments cochés sont conservés dans `items`. Un élément prioritaire est toujours considéré comme choisi.

## 5. Structure d'un élément fourni aux interrogations

```json
{
  "id": "apprendre",
  "allemand": "lernen",
  "francais": "apprendre",
  "categorie": "verbe",
  "choisi": true,
  "prioritaire": true
}
```

L'attribut `id` est stable et sert de référence technique. Le texte allemand ou français peut être corrigé ultérieurement sans perdre les choix déjà enregistrés.

## 6. Chargement dans un fichier d'interrogation

Le fichier d'interrogation doit se trouver dans le même répertoire et charger le script partagé :

```html
<script src="vocabulaire-lecon1.js"></script>
<script>
  const api = window.VocabulaireLecon1;
  const motsChoisis = api.getItems({
    choisisSeulement: true,
    prioritesEnPremier: true
  });
</script>
```

## 7. API publique

### `getItems(options)`

Retourne une nouvelle liste combinant les mots de référence et les choix locaux.

Options disponibles :

- `choisisSeulement: true` : ne retourne que les éléments à apprendre ;
- `prioritairesSeulement: true` : ne retourne que les priorités ;
- `prioritesEnPremier: true` : place les priorités au début.

Exemple pour une interrogation portant uniquement sur les priorités :

```js
const questions = VocabulaireLecon1.getItems({
  prioritairesSeulement: true
});
```

### `setItemState(id, modification)`

Modifie les coches d'un élément :

```js
VocabulaireLecon1.setItemState("ecole", { choisi: true });
VocabulaireLecon1.setItemState("ecole", { prioritaire: true });
```

Règles automatiques :

- cocher `prioritaire` coche aussi `choisi` ;
- décocher `choisi` décoche aussi `prioritaire` ;
- un identifiant inconnu provoque une erreur.

### `readSelection()`

Retourne la sélection brute normalisée, principalement utile pour le diagnostic.

### `resetSelection()`

Efface toutes les coches de cette leçon.

### `subscribe(callback)`

Prévient une page déjà ouverte lorsqu'un choix change dans la même page ou dans un autre onglet :

```js
const unsubscribe = VocabulaireLecon1.subscribe((items) => {
  console.log("Nouvelle sélection", items);
});

// À appeler si la page détruit son interface :
unsubscribe();
```

## 8. Règles pour construire les interrogations

1. Charger `vocabulaire-lecon1.js` avant le code de l'interrogation.
2. Utiliser `getItems()` ; ne pas lire directement la clé `localStorage`.
3. Si aucun mot n'est choisi, afficher un message et un lien vers `mots-a-apprendre.html`.
4. Utiliser `id` pour suivre les résultats, jamais le texte affiché.
5. Donner davantage de fréquence aux priorités sans exclure les autres mots choisis.
6. Ne jamais modifier les coches depuis une interrogation sans action explicite de l'élève.
7. Échapper le texte ou l'insérer avec `textContent`, jamais avec du HTML non contrôlé.

## 9. Exemple de tirage pondéré

Cet exemple donne trois fois plus de chances aux éléments prioritaires :

```js
const selected = VocabulaireLecon1.getItems({ choisisSeulement: true });

if (selected.length === 0) {
  // Afficher : "Choisis d'abord des mots à apprendre."
} else {
  const pool = selected.flatMap((item) =>
    item.prioritaire ? [item, item, item] : [item]
  );
  const question = pool[Math.floor(Math.random() * pool.length)];
  console.log(question.allemand, question.francais);
}
```

## 10. Évolution du contrat

- La version actuelle est `1`.
- Toute modification incompatible doit utiliser une nouvelle clé terminée par `:v2` et augmenter `VocabulaireLecon1.version`.
- Ajouter de nouveaux mots avec de nouveaux `id` est compatible avec la version 1.
- Un `id` existant ne doit pas être réutilisé pour un autre mot.
