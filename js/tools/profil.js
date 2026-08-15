/** Profil artiste : saisi une fois, réutilisé par tous les documents. */
import { h } from '../core/dom.js';
import { buildForm } from '../core/forms.js';
import { toastOk, downloadJSON, pickFile, readText, toastErr } from '../core/ui.js';
import { loadProfile, saveProfile, PROFILE_SCHEMA } from '../core/profile.js';
import { slugify } from '../core/text.js';

export default function mount(el) {
  const profile = loadProfile();
  let saveTimer = 0;

  const status = h('span.tiny.muted', { text: '' });

  const form = buildForm(PROFILE_SCHEMA, profile, () => {
    clearTimeout(saveTimer);
    status.textContent = 'Enregistrement…';
    saveTimer = setTimeout(() => {
      saveProfile(profile);
      status.textContent = 'Enregistré sur cet appareil';
    }, 400);
  });

  el.appendChild(h('div.card', null,
    h('div.card-head', null,
      h('h2', { text: 'Vos informations' }),
      h('span.spacer', { style: { marginLeft: 'auto' } }),
      status
    ),
    form
  ));

  el.appendChild(h('div.card', null,
    h('div.card-head', null, h('h2', { text: 'Et ensuite' })),
    h('div.row', null,
      h('a.btn.btn-primary', { href: '#/fiche-technique', text: 'Créer ma fiche technique' }),
      h('a.btn', { href: '#/rider', text: 'Créer mon rider' })
    ),
    h('div.row', { style: { marginTop: '.8rem' } },
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button', text: 'Exporter le profil (.json)',
        on: {
          click: () => {
            saveProfile(profile);
            downloadJSON(`profil-${slugify(profile.artistName, 'artiste')}.json`, profile);
          },
        },
      }),
      h('button.btn.btn-sm.btn-ghost', {
        type: 'button', text: 'Importer un profil',
        on: {
          click: async () => {
            const file = await pickFile('application/json,.json');
            if (!file) return;
            try {
              const data = JSON.parse(await readText(file));
              saveProfile({ ...profile, ...data });
              toastOk('Profil importé');
              location.reload();
            } catch {
              toastErr('Fichier illisible');
            }
          },
        },
      })
    ),
    h('p.tiny.muted', { style: { marginTop: '.8rem' }, text: 'Ces informations ne sont enregistrées que dans ce navigateur. Exportez-les pour les retrouver sur un autre appareil.' })
  ));

  return () => {
    clearTimeout(saveTimer);
    saveProfile(profile);
  };
}
