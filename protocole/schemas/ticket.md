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

`priorite`, `echeance`, `parent`. **Aucun autre** — le validateur rejette tout
champ hors de cet ensemble (frugalité).

- `parent` : `id` du ticket dont celui-ci découle. Sert à mesurer la profondeur
  des chaînes créées par les agents (garde-fou anti-boucle).

## Les 6 champs obligatoires en un coup d'œil

| Champ | Question à laquelle il répond |
|---|---|
| `id` | Comment référencer ce ticket de façon unique ? |
| `resultat` | Comment saura-t-on que c'est fini, sans demander ? |
| `sources` | Où l'agent trouve-t-il tout ce dont il a besoin ? |
| `assigne` | Qui doit le traiter ? |
| `statut` | Où en est-il ? (rappel — le dossier fait foi) |
| `limites` | Qu'est-ce que l'agent ne doit surtout pas toucher ? |
