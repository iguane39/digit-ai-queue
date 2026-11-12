# Instances de la file

Une instance est une copie de `protocole/` posée dans le projet où les agents
travaillent, avec ses dossiers `tickets/` et `recus/`. Elle se pose et se
vérifie par `scripts/installer-instance.mjs`. Les projets se nomment ici par
leur pseudonyme : la garde de publication refuse leur nom réel, et leur dossier
se lit dans la table des pseudonymes du canal confidentiel.

| Projet | Dossier de l'instance | Agents | Posée le | Transport |
|---|---|---|---|---|
| Produit-79 | `queue/` | `claude`, `codex`, `humain` | 12/11/2026 | même arbre de travail local ; aucun push requis ; relais par `queue/local/relais.mjs` |

## Mettre une instance à niveau

Après toute modification de `protocole/` ici, rejouer pour chaque instance :

```bash
node scripts/installer-instance.mjs <projet>              # remet la copie à niveau
node scripts/installer-instance.mjs <projet> --verifier   # exit 0 si conforme
```

La couche `local/` de l'instance (config, routage, lanceur de garde) n'est
jamais écrasée : elle appartient au projet.

## Ce que l'instance ne fait pas

Aucun agent n'est lancé automatiquement. L'humain dit « traite la file » à
l'agent concerné ; l'appel automatique de Codex par Claude (`codex exec`)
n'est pas câblé, parce qu'il consomme l'abonnement de l'utilisateur sans
geste de sa part.
