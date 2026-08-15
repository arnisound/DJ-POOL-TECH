/**
 * Briques d'interface transverses : toasts, modales, téléchargement,
 * lecture de fichier, impression / export PDF.
 */
import { h, qs, clear } from './dom.js';

/* ------------------------------ Toasts ------------------------------ */

export function toast(message, kind = '', ms = 3200) {
  const stack = qs('#toast-stack');
  if (!stack) return;
  const t = h('div.toast', { class: kind, text: message });
  stack.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .25s';
    setTimeout(() => t.remove(), 260);
  }, ms);
}

export const toastOk = (m) => toast(m, 'ok');
export const toastErr = (m) => toast(m, 'err');

/* ------------------------------ Modale ------------------------------ */

/**
 * Ouvre une modale. `render(close)` doit retourner le contenu.
 * @returns {Promise<any>} résolue avec la valeur passée à close().
 */
export function modal(render) {
  const root = qs('#modal-root');
  return new Promise((resolve) => {
    const close = (value) => {
      root.hidden = true;
      clear(root);
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(undefined); };

    const box = h('div.modal', { role: 'dialog', 'aria-modal': 'true' });
    box.appendChild(render(close));
    clear(root);
    root.appendChild(box);
    root.hidden = false;
    root.onclick = (e) => { if (e.target === root) close(undefined); };
    document.addEventListener('keydown', onKey);
    const first = box.querySelector('input, select, textarea, button');
    if (first) first.focus();
  });
}

export function confirmDialog(message, { title = 'Confirmer', okLabel = 'Confirmer', danger = false } = {}) {
  return modal((close) => h('div', null,
    h('h2', { text: title }),
    h('p.muted', { text: message }),
    h('div.row.end', { style: { marginTop: '1rem' } },
      h('button.btn.btn-ghost', { type: 'button', text: 'Annuler', on: { click: () => close(false) } }),
      h('button.btn', { type: 'button', text: okLabel, class: danger ? 'btn-danger' : 'btn-primary', on: { click: () => close(true) } })
    )
  ));
}

export function promptDialog(label, { title = 'Saisie', value = '', placeholder = '' } = {}) {
  return modal((close) => {
    const inp = h('input', { type: 'text', value, placeholder });
    const form = h('form', { on: { submit: (e) => { e.preventDefault(); close(inp.value.trim()); } } },
      h('h2', { text: title }),
      h('div.field', null, h('label', { text: label }), inp),
      h('div.row.end', { style: { marginTop: '1rem' } },
        h('button.btn.btn-ghost', { type: 'button', text: 'Annuler', on: { click: () => close(undefined) } }),
        h('button.btn.btn-primary', { type: 'submit', text: 'Valider' })
      )
    );
    return form;
  });
}

/* ------------------------------ Fichiers ------------------------------ */

export function download(filename, content, mime = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadJSON(filename, data) {
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

/** Ouvre un sélecteur de fichier et retourne le File choisi (ou null). */
export function pickFile(accept = '*/*') {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, style: { display: 'none' } });
    document.body.appendChild(inp);
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      resolve(f || null);
    }, { once: true });
    inp.click();
  });
}

export const readText = (file) => file.text();

export function readDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

/* --------------------- Impression / export PDF --------------------- */

/**
 * Injecte le document dans #print-root et déclenche l'impression.
 * Sur mobile comme sur ordinateur, « Imprimer » permet d'enregistrer en PDF.
 * @param {string} html - contenu du document
 * @param {string} title - titre utilisé comme nom de fichier proposé
 */
export function printDocument(html, title = 'document') {
  const root = qs('#print-root');
  root.innerHTML = html;
  const previous = document.title;
  document.title = title;

  const cleanup = () => {
    document.title = previous;
    root.innerHTML = '';
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Laisse le temps aux images (logo) de se peindre avant l'ouverture du dialogue.
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 1500);
  }, 120);
}

/* ------------------------------ Divers ------------------------------ */

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toastOk('Copié dans le presse-papier');
    return true;
  } catch {
    toastErr('Copie impossible sur ce navigateur');
    return false;
  }
}

/** Empêche la mise en veille de l'écran (timer, tap tempo). */
export async function keepAwake() {
  try {
    if ('wakeLock' in navigator) return await navigator.wakeLock.request('screen');
  } catch { /* refusé ou non supporté : sans conséquence */ }
  return null;
}
