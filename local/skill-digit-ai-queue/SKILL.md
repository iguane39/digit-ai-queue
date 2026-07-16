---
name: digit-ai-queue
description: Façade Claude Code pour la file de tickets multi-agents digit-ai-queue. À déclencher quand l'utilisateur veut interagir avec la file — « prends un ticket », « qu'y a-t-il dans la queue / la file », « claim T-… », « traite le ticket … », ou à la fin d'une tâche issue d'un ticket (déposer le reçu, déplacer le ticket). Adaptateur mince : la logique vit dans le protocole du repo queue, ce skill n'y ajoute que les déclencheurs et le pointeur.
---

# digit-ai-queue — façade Claude Code

Ce skill est un **adaptateur mince**. Il ne recopie aucune règle du protocole :
il pointe vers lui et ajoute les déclencheurs en langage naturel côté Claude
Code. Toute la logique (cycle de vie, claim par commit, reçus, sécurité, locks)
vit dans le repo de la file, pas ici.

## Où est le protocole

Le repo de la file est configuré dans `local/config.env` (variable `QUEUE_DIR`).
Par défaut sur cette machine : `c:/dev/digit-ai-queue`.

**Avant toute action sur la file, lis, dans le repo queue :**
- `protocole/AGENTS.md` — la marche à suivre opérationnelle (claim, traiter,
  bloquer, livrer) ;
- `protocole/README.md` — la référence (règle de sécurité, locks orphelins) ;
- `protocole/schemas/ticket.md` et `protocole/schemas/recu.md` — les gabarits.

Applique ces fichiers **tels quels**. Ce skill ne les résume pas et ne les
remplace pas — s'ils changent, c'est eux qui font foi.

## Déclencheurs → action

| L'utilisateur dit… | Tu fais… |
|---|---|
| « qu'y a-t-il dans la queue / la file » | Listes `tickets/a-faire/` et donnes id + `assigne` + `resultat` en une ligne chacun |
| « prends un ticket » / « claim T-… » | Suis §2 d'AGENTS.md : `git mv` vers `en-cours/` + commit `claim: <id> par claude`, puis traite |
| « traite le ticket … » | Vérifie la suffisance, traite dans les `limites`, puis livre |
| (fin d'une tâche issue d'un ticket) | Dépose le reçu dans `recus/<id>-recu.md`, `git mv` vers `termine/`, commit `done: <id> — …` |
| (ambiguïté / information manquante) | Ne devine pas : `git mv` vers `attente-input/`, écris la question exacte, reçu partiel, arrête-toi |

## Rôle concret côté Claude Code

Ici, l'agent réclamant est `claude`. Les messages de commit portent
`par claude`. Le travail spécifique à un domaine (chartes, runners, gabarits
d'un projet) n'est PAS dans ce skill : il vient du ticket lui-même (ses
`sources` et son `détail`) ou d'un autre skill invoqué pour ce travail. Ce
skill ne gère que la mécanique de la file.

## Garde-fou

Le hook `protocole/scripts/guard-claim.sh` (câblé dans `settings.json`, voir
`local/hook-claude-settings.md`) refuse toute édition de livrable tant qu'un
claim n'est pas commité. Respecte-le : commit ton claim avant de produire.
