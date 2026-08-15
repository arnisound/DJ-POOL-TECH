/**
 * Tests de l'import de playlists : `node tests/playlist.test.mjs`
 *
 * Les échantillons reproduisent la structure réelle des exports de
 * Rekordbox, Traktor, Serato et Engine DJ.
 */
import { parsePlaylist, summarize, splitArtistTitle } from '../js/core/playlist-import.js';
import { parseAnyKey, keyFromTraktorValue } from '../js/core/music.js';
import { parseXML, findAll, attr, decodeEntities } from '../js/core/xml.js';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

/* ------------------------------------------------------------------ *
 * Échantillons
 * ------------------------------------------------------------------ */

const REKORDBOX = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.7.4" Company="AlphaTheta"/>
  <COLLECTION Entries="3">
    <TRACK TrackID="101" Name="Nuit Blanche" Artist="Camille &amp; Jo" Album="Aurore"
           Genre="House" TotalTime="384" AverageBpm="124.00" Tonality="Am" Comments="Intro longue" Year="2024">
      <TEMPO Inizio="0.025" Bpm="124.00" Metro="4/4" Battito="1"/>
    </TRACK>
    <TRACK TrackID="102" Name="Vertige" Artist="Léa Moreau" Album="Nord"
           Genre="Techno" TotalTime="412" AverageBpm="131.50" Tonality="F#m"/>
    <TRACK TrackID="103" Name="Sous la pluie" Artist="Duo Kepler" TotalTime="298" AverageBpm="120.00" Tonality="C"/>
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="2">
      <NODE Name="Warm-up" Type="1" KeyType="0" Entries="2">
        <TRACK Key="103"/>
        <TRACK Key="101"/>
      </NODE>
      <NODE Name="Peak time" Type="1" KeyType="0" Entries="1">
        <TRACK Key="102"/>
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

const TRAKTOR = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<NML VERSION="19">
  <HEAD COMPANY="www.native-instruments.com" PROGRAM="Traktor"/>
  <COLLECTION ENTRIES="2">
    <ENTRY MODIFIED_DATE="2024/9/3" TITLE="Ligne de fuite" ARTIST="Sarah Vidal">
      <LOCATION DIR="/:Musique/:" FILE="ligne.mp3" VOLUME="Macintosh HD"/>
      <ALBUM TITLE="Horizon"/>
      <INFO BITRATE="320000" GENRE="Deep House" PLAYTIME="367" KEY="Dm" COMMENT="à jouer tôt"/>
      <TEMPO BPM="122.000000" BPM_QUALITY="100.000000"/>
      <MUSICAL_KEY VALUE="14"/>
    </ENTRY>
    <ENTRY TITLE="Orage" ARTIST="Nils B.">
      <LOCATION DIR="/:Musique/:" FILE="orage.mp3"/>
      <INFO PLAYTIME="288" GENRE="Techno"/>
      <TEMPO BPM="138.500000"/>
      <MUSICAL_KEY VALUE="7"/>
    </ENTRY>
  </COLLECTION>
  <PLAYLISTS>
    <NODE TYPE="FOLDER" NAME="$ROOT">
      <SUBNODES COUNT="1">
        <NODE TYPE="PLAYLIST" NAME="Set du samedi">
          <PLAYLIST ENTRIES="2" TYPE="LIST"/>
        </NODE>
      </SUBNODES>
    </NODE>
  </PLAYLISTS>
</NML>`;

// Serato : l'historique exporté place le nom de session au-dessus de l'en-tête.
const SERATO = `"Session du 12 octobre"
"name","artist","album","bpm","key","length","played"
"Nuit Blanche","Camille","Aurore","124.00","Am","6:24","yes"
"Vertige","Léa Moreau","Nord","131.50","F#m","6:52","yes"
"Sous la pluie","Duo Kepler","","120.00","C","4:58","no"`;

// Engine DJ : export tabulé, colonnes en anglais.
const ENGINE = `Title\tArtist\tAlbum\tGenre\tBPM\tKey\tTime\tComment
Ligne de fuite\tSarah Vidal\tHorizon\tDeep House\t122.0\t7A\t6:07\t
Orage\tNils B.\t\tTechno\t138.5\t9B\t4:48\tpeak`;

const M3U = `#EXTM3U
#EXTINF:384,Camille - Nuit Blanche
/Users/dj/Musique/nuit-blanche.mp3
#EXTINF:412,Léa Moreau - Vertige
/Users/dj/Musique/vertige.mp3
/Users/dj/Musique/Duo Kepler - Sous la pluie.mp3`;

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

console.log('\nAnalyseur XML');
{
  const doc = parseXML(REKORDBOX);
  check('les balises imbriquées sont retrouvées', findAll(doc, 'TRACK').length === 6);
  check('les attributs sont lus', attr(findAll(doc, 'TRACK')[0], 'Name') === 'Nuit Blanche');
  check('les entités sont décodées', attr(findAll(doc, 'TRACK')[0], 'Artist') === 'Camille & Jo');
  check('les entités numériques aussi', decodeEntities('caf&#233; &amp; th&#xe9;') === 'café & thé');
  check('les balises auto-fermantes ne cassent pas l’arbre', findAll(doc, 'PRODUCT').length === 1);
}

console.log('\nNormalisation des clefs');
{
  const cases = [
    ['Am', '8A'], ['A minor', '8A'], ['Amin', '8A'], ['La mineur', '8A'],
    ['C', '8B'], ['Cmaj', '8B'], ['C major', '8B'], ['Do majeur', '8B'],
    ['F#m', '11A'], ['Gbm', '11A'], ['8A', '8A'], ['08A', '8A'], ['8a', '8A'],
    ['1m', '8A'], ['1d', '8B'], ['12A', '12A'], ['Ebm', '2A'], ['D#m', '2A'],
  ];
  const bad = cases.filter(([input, expected]) => parseAnyKey(input) !== expected);
  check('toutes les notations reconnues', bad.length === 0,
    bad.map(([i, e]) => `${i} → ${parseAnyKey(i)} au lieu de ${e}`).join(', '));
  check('une valeur absurde est ignorée', parseAnyKey('Hmm') === '' && parseAnyKey('') === '' && parseAnyKey('99Z') === '');
  check('valeur Traktor 14 = Ré mineur (7A)', keyFromTraktorValue(14) === '7A');
  check('valeur Traktor 7 = Sol majeur (9B)', keyFromTraktorValue(7) === '9B');
}

console.log('\nRekordbox (XML)');
{
  const r = parsePlaylist(REKORDBOX, 'collection.xml');
  check('format reconnu', r.source === 'Rekordbox');
  check('la playlist la plus fournie est retenue', r.name === 'Warm-up', `obtenu « ${r.name} »`);
  check('l’ordre de la playlist est respecté',
    r.tracks.map((t) => t.title).join(' | ') === 'Sous la pluie | Nuit Blanche',
    r.tracks.map((t) => t.title).join(' | '));
  check('tempo lu', r.tracks[1].bpm === 124);
  check('tonalité convertie en Camelot', r.tracks[1].key === '8A');
  check('durée lue', r.tracks[1].duration === 384);
  check('esperluette décodée', r.tracks[1].artist === 'Camille & Jo');
  check('la présence de plusieurs playlists est signalée', r.warnings.some((w) => w.includes('2 playlists')));
}

console.log('\nTraktor (NML)');
{
  const r = parsePlaylist(TRAKTOR, 'set.nml');
  check('format reconnu', r.source === 'Traktor');
  check('nom de playlist repris', r.name === 'Set du samedi', `obtenu « ${r.name} »`);
  check('deux entrées lues', r.tracks.length === 2);
  check('tempo décimal lu', r.tracks[0].bpm === 122);
  check('MUSICAL_KEY prioritaire sur INFO/KEY', r.tracks[0].key === '7A', `obtenu ${r.tracks[0].key}`);
  check('durée lue', r.tracks[0].duration === 367);
  check('album lu dans la balise fille', r.tracks[0].album === 'Horizon');
  check('deuxième titre en Sol majeur', r.tracks[1].key === '9B');
}

console.log('\nSerato (CSV avec ligne de session)');
{
  const r = parsePlaylist(SERATO, 'historique.csv');
  check('trois titres lus', r.tracks.length === 3, `${r.tracks.length} lus`);
  check('nom de session repris', r.name === 'Session du 12 octobre', `obtenu « ${r.name} »`);
  check('artiste et titre séparés', r.tracks[0].title === 'Nuit Blanche' && r.tracks[0].artist === 'Camille');
  check('tempo lu', r.tracks[1].bpm === 131.5);
  check('clef convertie', r.tracks[1].key === '11A');
  check('durée « 6:24 » convertie en secondes', r.tracks[0].duration === 384);
}

console.log('\nEngine DJ (tabulations)');
{
  const r = parsePlaylist(ENGINE, 'playlist-engine.txt');
  check('format tabulé reconnu', r.tracks.length === 2, `${r.tracks.length} lus`);
  check('titre lu', r.tracks[0].title === 'Ligne de fuite');
  check('clef déjà en Camelot conservée', r.tracks[0].key === '7A');
  check('tempo lu', r.tracks[1].bpm === 138.5);
  check('durée lue', r.tracks[1].duration === 288);
}

console.log('\nM3U');
{
  const r = parsePlaylist(M3U, 'ma-liste.m3u');
  check('trois titres lus', r.tracks.length === 3, `${r.tracks.length} lus`);
  check('artiste et titre séparés depuis #EXTINF', r.tracks[0].artist === 'Camille' && r.tracks[0].title === 'Nuit Blanche');
  check('durée lue', r.tracks[0].duration === 384);
  check('titre déduit du nom de fichier', r.tracks[2].title === 'Sous la pluie' && r.tracks[2].artist === 'Duo Kepler');
  check('absence de tempo signalée', r.warnings.some((w) => w.includes('tempo')));
}

console.log('\nCas limites');
{
  check('« Artiste - Titre » séparé', splitArtistTitle('Nils B. - Orage').join('|') === 'Nils B.|Orage');
  check('un titre contenant un tiret reste entier', splitArtistTitle('Orage').join('|') === '|Orage');
  check('tiret cadratin accepté', splitArtistTitle('Nils B. — Orage').join('|') === 'Nils B.|Orage');

  const empty = parsePlaylist('', 'vide.csv');
  check('fichier vide traité proprement', empty.tracks.length === 0 && empty.warnings.length > 0);

  const noHeader = parsePlaylist('Camille;Nuit Blanche;124;8A\nLéa;Vertige;131;11A', 'sans-entete.csv');
  check('colonnes devinées sans en-tête', noHeader.tracks.length === 2 && noHeader.tracks[0].bpm === 124,
    JSON.stringify(noHeader.tracks[0]));

  const s = summarize(parsePlaylist(SERATO, 'h.csv'));
  check('synthèse cohérente', s.count === 3 && s.withBpm === 3 && s.withKey === 3 && s.totalDuration > 1000,
    JSON.stringify(s));
}

console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s).\n`);
process.exit(failed ? 1 : 0);
