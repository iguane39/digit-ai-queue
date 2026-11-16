# Gabarit de ticket

Un **ticket** demande un *résultat*, pas une réponse. Il porte une definition of
done testable, ses propres sources, et les limites de ce que l'agent peut
toucher. Règle fondatrice : un ticket doit être compréhensible par l'agent le
plus pauvre en contexte — toute convention y est inlinée ou pointée vers un
fichier de la file, jamais supposée connue.

- **Format** : frontmatter YAML (**6 champs obligatoires**) + corps libre en
  Markdown.
- **Nom de fichier** : `<id>.md` (l'`id` du frontmatter).
- **Emplacement** : le dossier fait foi pour le statut — voir
  [`../README.md`](../README.md).

## Gabarit commenté

```markdown
---
id: T-2026-0712-001
# Identifiant unique. Format : T-{YYYY}-{MMDD}-{seq}

resultat: >
  Le fichier X existe, passe le validateur Y, et contient Z.
# Definition of done TESTABLE. On doit pouvoir vérifier, sans demander à
# l'agent, si c'est atteint. Champ NON VIDE obligatoire.

sources:
  - chemin/vers/fichier.md
  - https://exemple/lien
# Chemins et liens nécessaires pour que le ticket soit autoportant. Un agent
# sans contexte doit pouvoir tout retrouver à partir d'ici.

assigne: <agent>
# À qui revient le ticket. Une des valeurs déclarées dans la configuration
# locale (voir local/routage.md), ou le rôle réservé « humain » pour ce qui
# n'est pas délégable (validation finale, envoi vers un tiers).

statut: a-faire
# Rappel du statut. Le DOSSIER fait foi (a-faire / en-cours / attente-input /
# termine). Ce champ n'est qu'indicatif.

limites: >
  Ne modifie aucun fichier hors du répertoire prévu. Pas de push sur la
  branche principale.
# Ce que l'agent ne touche PAS. Ne peut que RESTREINDRE (jamais élargir les
# permissions — voir la règle de sécurité du protocole).
---
## Contexte
(2-5 lignes : pourquoi ce ticket existe, ce qui a été décidé en amont)

## Détail
(instructions, critères ; extraits inlinés si l'agent cible ne connaît pas les
conventions ; où déposer le reçu)
```

## Champs optionnels tolérés

`priorite`, `echeance`, `parent`, plus les trois champs d'un livrable d'images
générées (ci-dessous). **Aucun autre** — le validateur rejette tout champ hors
de cet ensemble (frugalité).

- `parent` : `id` du ticket dont celui-ci découle. Sert à mesurer la profondeur
  des chaînes créées par les agents (garde-fou anti-boucle).

## Livrable d'images générées : les données et la commande de rendu

Quand le résultat attendu est un lot d'images produites par un générateur
(carrousels, vignettes, schémas rendus), l'image seule ne se corrige pas : pour
changer un texte, il faudrait le recopier depuis l'image. Le ticket déclare donc
d'où viennent les images, et le validateur refuse un ticket d'images sans ces
trois champs :

```yaml
livrable: images-generees
donnees: carrousels/diapositives.json
# Le fichier qui porte le contenu des images (textes, valeurs, ordre) : celui
# qu'on édite pour corriger une image. Chemin dans le dépôt, non vide.
rendu: node scripts/rendre.mjs carrousels/diapositives.json
# La commande qui rend les images à partir des données. Non vide ; une commande
# qui contient « : » s'écrit en bloc (`rendu: |` puis la commande indentée).
```

- `livrable` : seule valeur admise, `images-generees`. Une autre valeur (faute
  de frappe comprise) est refusée, jamais ignorée.
- `donnees` et `rendu` n'existent que sous `livrable: images-generees`.
- L'agent qui livre cite ces deux éléments dans les `preuves` de son reçu
  (voir [`recu.md`](recu.md)), et la relecture rejoue la commande de rendu sur
  le fichier de données.

## Les 6 champs obligatoires en un coup d'œil

| Champ | Question à laquelle il répond |
|---|---|
| `id` | Comment référencer ce ticket de façon unique ? |
| `resultat` | Comment saura-t-on que c'est fini, sans demander ? |
| `sources` | Où l'agent trouve-t-il tout ce dont il a besoin ? |
| `assigne` | Qui doit le traiter ? |
| `statut` | Où en est-il ? (rappel — le dossier fait foi) |
| `limites` | Qu'est-ce que l'agent ne doit surtout pas toucher ? |

## Test de suffisance — checklist avant de créer un ticket

Un ticket doit être traitable par l'agent **le plus pauvre en contexte**, qui
ne connaît ni ton organisation, ni tes conventions, ni tes projets. Avant de
déposer le ticket, coche mentalement :

- [ ] Le `resultat` est **testable** : on peut vérifier objectivement s'il est
      atteint, sans redemander à l'agent.
- [ ] Toute convention, tout format, tout critère non évident est **inliné**
      dans le corps du ticket **ou pointé** par un chemin/lien dans `sources`.
      Rien n'est supposé connu.
- [ ] Les `sources` suffisent : un agent parti de zéro retrouve tout à partir
      d'elles.
- [ ] Les `limites` disent explicitement ce qu'il ne faut pas toucher.
- [ ] Où déposer le reçu est indiqué (`recus/<id>-recu.md`).
- [ ] Si le résultat est un lot d'images générées : `livrable`, `donnees` et
      `rendu` sont renseignés (section ci-dessus).

Si une seule case ne peut être cochée, le ticket n'est pas suffisant : complète-le.
Un ticket insuffisant finira en `attente-input/` et coûtera un aller-retour.
