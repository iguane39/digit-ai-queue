# Cycle de vie d'un ticket — résumé

Un ticket naît dans `a-faire/`, où il attend d'être pris en charge. Un agent le
réclame en le déplaçant dans `en-cours/` et en committant ce déplacement : ce
commit vaut verrou (claim = commit = lock). Une fois le résultat produit et
prouvé par un reçu, le ticket passe dans `termine/` et son reçu est déposé dans
`recus/`. Si l'agent rencontre une ambiguïté ou une information manquante, il ne
devine pas : il déplace le ticket dans `attente-input/` avec sa question exacte,
puis reprend en `en-cours/` une fois la réponse fournie. Le dossier fait foi
pour le statut à chaque étape.
