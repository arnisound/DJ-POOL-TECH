/**
 * Analyseur XML minimal, orienté attributs.
 *
 * Les formats de playlist (Rekordbox .xml, Traktor .nml) décrivent tout par
 * attributs, sans contenu textuel significatif. Un analyseur dédié évite de
 * dépendre de `DOMParser`, absent des Workers et de Node : le même code
 * tourne donc dans le navigateur et dans les tests.
 */

const TAG = /<\/?([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTR = /([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(value) {
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function parseAttributes(source) {
  const attrs = {};
  if (!source) return attrs;
  ATTR.lastIndex = 0;
  let m;
  while ((m = ATTR.exec(source)) !== null) {
    attrs[m[1]] = decodeEntities(m[2] !== undefined ? m[2] : (m[3] || ''));
  }
  return attrs;
}

/**
 * Construit l'arbre du document.
 * @returns {{tag:string, attrs:object, children:Array, parent:object|null}}
 */
export function parseXML(text) {
  const clean = String(text || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?>/gi, '');

  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let current = root;

  TAG.lastIndex = 0;
  let m;
  while ((m = TAG.exec(clean)) !== null) {
    const [raw, tag, attrSource, selfClosing] = m;
    const closing = raw[1] === '/';

    if (closing) {
      // On remonte jusqu'à la balise correspondante, en tolérant les oublis.
      let node = current;
      while (node && node.tag !== tag) node = node.parent;
      current = node && node.parent ? node.parent : root;
      continue;
    }

    const node = { tag, attrs: parseAttributes(attrSource), children: [], parent: current };
    current.children.push(node);
    if (!selfClosing) current = node;
  }

  return root;
}

/** Tous les descendants portant ce nom de balise. */
export function findAll(node, tag, out = []) {
  for (const child of node.children) {
    if (child.tag === tag) out.push(child);
    findAll(child, tag, out);
  }
  return out;
}

/** Premier descendant portant ce nom de balise. */
export function find(node, tag) {
  for (const child of node.children) {
    if (child.tag === tag) return child;
    const deeper = find(child, tag);
    if (deeper) return deeper;
  }
  return null;
}

/** Enfants directs portant ce nom de balise. */
export function children(node, tag) {
  return node.children.filter((child) => child.tag === tag);
}

export function attr(node, name, fallback = '') {
  if (!node) return fallback;
  return node.attrs[name] ?? fallback;
}

/** Vrai si le document contient au moins une balise de ce nom. */
export function hasTag(text, tag) {
  return new RegExp(`<${tag}\\b`, 'i').test(text);
}
