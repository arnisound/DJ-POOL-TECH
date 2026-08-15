# DJ Pool Tech

**La boîte à outils du DJ** — une application web qui réunit les outils du quotidien :
génération de fiche technique et de rider, plan de câblage, analyse du tempo et de
la tonalité, import de playlists, tap tempo, roue Camelot, préparation de setlist.

Elle fonctionne sur téléphone comme sur ordinateur, s'installe sur l'écran d'accueil
et reste utilisable **hors ligne**, en cabine comme en sous-sol.

---

## Ce que contient l'application

### Analyse & mix

| Outil | Ce qu'il fait |
|---|---|
| **Analyse BPM & clef** | Déposez un ou plusieurs morceaux : tempo, position du premier temps, tonalité, code Camelot et Open Key. Traitement par lot, forme d'onde avec grille de temps, chromagramme, export CSV. |
| **Tap tempo** | Mesure du tempo au doigt ou à la barre d'espace, avec rejet des taps aberrants, indicateur de régularité et métronome de contrôle. |
| **Roue Camelot** | Roue interactive des 24 clefs : enchaînements sûrs, boost d'énergie, diagonales, notes de la gamme et table des trois notations. |
| **Pitch & tempo** | Pitch nécessaire pour caler deux morceaux, transposition induite, clef obtenue sans master tempo, plage atteignable selon la platine. |
| **Delay & LFO** | Toutes les divisions rythmiques en millisecondes et en hertz, réglages de reverb calés sur le tempo, durées des phrasés de 8 / 16 / 32 mesures. |

### Préparation du set

| Outil | Ce qu'il fait |
|---|---|
| **Setlist** | Plusieurs sets, **import depuis Rekordbox, Serato, Engine DJ, Traktor et M3U**, réordonnancement, contrôle automatique de la compatibilité harmonique et de l'écart de tempo entre chaque titre, courbe d'énergie, export CSV et PDF. |
| **Timer de set** | Compte à rebours plein écran, alertes à 10 / 5 / 1 minute, heure de fin prévue, écran maintenu allumé. |
| **Checklist matériel** | Listes types (club, prestation mobile, festival, radio), personnalisables, imprimables. |

### Scène & câblage

| Outil | Ce qu'il fait |
|---|---|
| **Plan de câblage** | Deux vues d'une même installation : le **plan de cabine** (la disposition physique, telle qu'elle apparaît sur un rider professionnel) et le **schéma de câblage** (port par port). L'application vérifie la cohérence des branchements et dresse la liste des câbles à emporter. Huit configurations types prêtes à l'emploi. |
| **Performeurs** | Saxophoniste, chanteur, percussionniste, VJ… Chaque performeur apporte ses besoins (micro, DI, retour, pied, 48 V, espace) et sa ligne dans la patch list. |

### Documents

| Outil | Ce qu'il fait |
|---|---|
| **Profil artiste** | Saisi une fois, réutilisé partout : identité, contacts, booking, contact technique, logo. |
| **Fiche technique** | Cinq configurations pré-remplies (CDJ, contrôleur, vinyle/DVS, hybride, mobile), aperçu en direct, export PDF A4. |
| **Rider technique** | Rider complet — son, cabine, éclairage, personnel, planning, loges, transport, hébergement, sécurité, captation — avec presets club / festival / mariage / bar et sections activables. Le schéma de câblage, les performeurs et la liste des lignes s'y ajoutent automatiquement. |

---

## Points importants

**Rien ne quitte votre appareil.** Les morceaux sont décodés et analysés dans le
navigateur, via l'API Web Audio. Aucun fichier n'est téléversé, aucun compte n'est
demandé, aucune requête réseau n'est faite pendant l'analyse. Les fiches, riders et
setlists sont stockés dans le `localStorage` du navigateur ; la fonction
« Sauvegarde / Restauration » permet de les exporter en JSON pour les transférer.

**Les playlists sont reconnues au contenu, pas à l'extension.** L'importeur
identifie seul un XML Rekordbox, un NML Traktor, un CSV Serato, un export
tabulé Engine DJ ou un M3U, détecte le séparateur et l'encodage (Rekordbox
exporte en UTF-16), fait correspondre les colonnes en français comme en anglais
et convertit toutes les notations de tonalité vers le Camelot. Un aperçu
s'affiche avant d'écrire quoi que ce soit.

**L'export PDF passe par l'impression du navigateur.** Les documents sont mis en page
en A4 par une feuille de style dédiée ; il suffit de choisir « Enregistrer en PDF »
dans le dialogue d'impression. C'est ce qui donne le meilleur rendu sans embarquer de
bibliothèque PDF.

---

## Installation et développement

Aucune dépendance, aucune étape de construction : ce sont des modules ES natifs
servis tels quels.

```bash
# Servir en local (n'importe quel serveur statique fait l'affaire)
npx http-server -p 8080 -c-1 .
# puis ouvrir http://localhost:8080

# Lancer les tests
npm test
```

> Le service worker et les Web Workers exigent `http://localhost` ou `https://` :
> ouvrir `index.html` directement en `file://` désactive le mode hors ligne
> et bascule l'analyse sur le fil principal.

### Déploiement

N'importe quel hébergement statique convient (GitHub Pages, Netlify, un simple
dossier sur un serveur). Il n'y a rien à compiler : poussez le dépôt tel quel.

---

## Organisation du code

```
index.html              coquille de l'application
manifest.webmanifest    métadonnées PWA
sw.js                   service worker (mode hors ligne)
css/
  app.css               interface, thèmes clair et sombre
  print.css             mise en page A4 des documents
js/
  app.js                routeur, navigation, thème, sauvegarde
  core/
    dom.js              création d'éléments, champs de formulaire
    store.js            persistance locale, export/import
    ui.js               toasts, modales, téléchargement, impression
    forms.js            constructeur de formulaires déclaratif
    text.js             échappement, listes, CSV, nombres à la française
    music.js            Camelot, Open Key, compatibilité, pitch, tempo
    doc.js              briques de mise en page des documents
    profile.js          profil artiste partagé
    setlists.js         modèle de setlist
    gear.js             catalogue du matériel et de sa connectique
    patch.js            plan de câblage : modèle, contrôles, rendu SVG
    stageplot.js        plan de cabine : disposition physique et rendu
    booth-doc.js        page « l'organisateur doit fournir »
    performers.js       performeurs et liste des lignes
    playlist-import.js  import Rekordbox, Traktor, Serato, Engine, M3U
    xml.js              analyseur XML minimal, sans DOMParser
    icons.js            jeu d'icônes SVG
  audio/
    fft.js              FFT radix-2
    analyze.js          tempo et tonalité (fonctions pures)
    analyzer.js         orchestration, Worker et repli
    decode.js           décodage et ré-échantillonnage
    worker.js           analyse hors du fil principal
  tools/
    index.js            catalogue, chargement à la demande
    …                   un module par outil
tests/
  dsp.test.mjs          tests du DSP et de la théorie musicale
  playlist.test.mjs     tests de l'import de playlists
  gear.test.mjs         tests du catalogue, du câblage et du plan de cabine
```

---

## Le plan de cabine

C'est la page que l'on envoie à l'organisateur : un encadré de titre, la liste
de ce qu'il doit fournir, celle de ce que l'artiste apporte, puis la vue
physique de l'installation — la rangée de matériel, la silhouette du DJ, les
retours de part et d'autre, le réseau au-dessus, le micro devant.

Chaque appareil du plan porte deux informations qui alimentent ce document :
son **emplacement** dans la cabine (sur la table, à gauche, devant…), déduit de
sa catégorie et rectifiable d'un menu ; et **qui le fournit**, l'organisateur ou
l'artiste, ce qui répartit automatiquement les deux listes.

Le schéma est vectoriel : il reste net à l'impression, et le PDF tient sur une
page.

---

## Le catalogue de matériel

Une soixantaine d'appareils, dont la connectique est relevée sur les
documentations constructeur — panneaux arrière des DJM-A9, DJM-900NXS2,
DJM-V10, Xone:96, X1850, XDJ-XZ, CDJ-3000 et consorts. Un DJM-A9 déclare bien
ses quatre entrées ligne, ses quatre phono, ses quatre entrées numériques
coaxiales, son micro à alimentation fantôme, sa boucle send/return, ses deux
sorties casque et ses deux interfaces USB.

Cette précision n'est pas décorative : c'est elle qui permet de brancher une
sortie SEND sur le bon retour, de savoir qu'une embase combo accepte le XLR
comme le jack, ou qu'un master en XLR représente deux cordons et pas un.

---

## Les contrôles de câblage

Chaque appareil du catalogue déclare ses ports : type de connecteur, sens du
signal, caractère stéréo. L'application s'en sert pour trois choses.

**Refuser l'impossible.** Deux sorties ne se raccordent pas entre elles, un
signal de puissance n'entre pas dans une entrée ligne : la liaison est
simplement refusée, avec la raison.

**Prévenir sur ce qui passe mais se paie.** Une sortie ligne dans une entrée
phono, un master dans une entrée micro sans pad, un micro dans une entrée
ligne : la liaison est créée, mais signalée en pointillés avec le réglage à
vérifier. Ce sont les trois causes les plus fréquentes de saturation en
prestation. À l'inverse, une embase combo qui reçoit un XLR ou un jack, ou un
jack TS branché dans une embase TRS, ne déclenchent aucun avertissement : ce
sont des branchements normaux.

**Compter les câbles.** Une liaison XLR stéréo, ce sont deux cordons ; un
cordon RCA double n'en fait qu'un. La liste tient compte de la longueur saisie
pour chaque liaison, et se retrouve telle quelle dans le PDF.

Un contrôle d'ensemble signale enfin les appareils reliés à rien, ceux qui
attendent une prise 230 V, et les entrées alimentées par deux sources — ce qui
n'est pas possible sans splitter.

---

## Comment fonctionne l'analyse

**Tempo.** Le signal est ramené en mono à 22 050 Hz, puis découpé en trames de
1024 échantillons. Le flux spectral (somme des augmentations d'énergie par bande)
donne une enveloppe d'attaques, débarrassée de sa tendance locale. Une
autocorrélation en peigne — le décalage candidat *et* ses harmoniques — cherche la
période, pondérée par un a priori centré sur 125 BPM qui limite les erreurs
d'octave. Le décalage est ensuite affiné au centième de trame, ce qui donne une
précision d'environ 0,05 BPM.

**Phase des temps.** Une seconde enveloppe, limitée aux fréquences sous 220 Hz,
suit la grosse caisse : c'est elle qui donne la position du premier temps. Sans
cette bande basse, la grille se cale volontiers sur les charleys, à un demi-temps
près.

**Tonalité.** Un chromagramme est construit par sélection de pics spectraux
(FFT de 8192 points, interpolation parabolique pour la fréquence exacte). Une
première passe mesure le désaccord moyen du morceau et corrige le diapason —
utile sur les vieux vinyles numérisés. Le profil obtenu est corrélé aux 24 clefs
possibles selon les profils de Shaath (calibrés sur la musique électronique),
avec Krumhansl et Temperley en alternative.

**Limites, dites franchement.** Un morceau à tempo variable, très ambiant ou sans
percussions donnera un résultat moins fiable : l'indicateur de confiance affiché
sert précisément à ça, et les boutons ×2 / ÷2 permettent de corriger une erreur
d'octave en un geste. Pour la tonalité, la confusion entre une clef et son relatif
(par exemple 8A et 8B) est inhérente à la méthode — ces deux clefs contiennent
exactement les mêmes notes. Vérifiez toujours au casque avant de jouer.

---

## Tests

```bash
npm test
```

`tests/dsp.test.mjs` vérifie sur des signaux synthétiques : la table complète
des 24 correspondances Camelot, les règles de compatibilité, les calculs de
pitch, la détection du tempo entre 90 et 174 BPM, le calage de la grille sur la
grosse caisse, la reconnaissance d'une tonalité majeure et mineure, et la mesure
du désaccord.

`tests/gear.test.mjs` vérifie l'intégrité du catalogue (identifiants et ports
uniques, types de connecteurs connus, chaque mixeur DJ doté d'une sortie
générale et d'une sortie cabine), la connectique relevée sur les documentations,
les règles de branchement, la construction des huit configurations types, le
comptage des câbles et la composition du plan de cabine.

`tests/playlist.test.mjs` vérifie l'import sur des échantillons reproduisant la
structure réelle des exports : XML Rekordbox (avec entités et ordre de
playlist), NML Traktor (valeurs MUSICAL_KEY), CSV Serato (ligne de session avant
l'en-tête), export tabulé Engine DJ, M3U, fichier sans en-tête, ainsi que toutes
les notations de tonalité — « Am », « La mineur », « 8A », « 1m », « F#m »,
« Gbm ».

---

## Licence

Voir le fichier [LICENSE](LICENSE).
