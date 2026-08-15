/** Profil artiste : socle commun à la fiche technique et au rider. */
import * as store from './store.js';
import { escapeHtml } from './text.js';

export const PROFILE_KEY = 'profil';

export const DEFAULT_PROFILE = {
  artistName: '',
  realName: '',
  genres: '',
  city: '',
  country: 'France',
  website: '',
  instagram: '',
  soundcloud: '',
  email: '',
  phone: '',
  bookingName: '',
  bookingEmail: '',
  bookingPhone: '',
  techName: '',
  techEmail: '',
  techPhone: '',
  logo: '',
  bio: '',
};

export const PROFILE_SCHEMA = [
  { type: 'section', label: 'Identité' },
  { name: 'artistName', label: 'Nom d’artiste', placeholder: 'DJ Nom' },
  { name: 'realName', label: 'Nom civil', placeholder: 'Facultatif — utile pour les contrats' },
  { name: 'genres', label: 'Styles joués', placeholder: 'House, disco, afro house' },
  { name: 'city', label: 'Ville de départ', placeholder: 'Paris', hint: 'Sert au calcul des frais de déplacement dans le rider.' },
  { name: 'country', label: 'Pays' },
  { name: 'logo', label: 'Logo', type: 'image', width: 'full', hint: 'Apparaît en haut de la fiche technique et du rider. PNG ou SVG, 900 Ko maximum.' },
  { name: 'bio', label: 'Présentation courte', type: 'textarea', rows: 3, width: 'full', placeholder: 'Deux ou trois phrases reprises en tête de la fiche technique.' },

  { type: 'section', label: 'Contact direct' },
  { name: 'email', label: 'E-mail', type: 'email' },
  { name: 'phone', label: 'Téléphone', type: 'tel' },
  { name: 'website', label: 'Site web', type: 'url', placeholder: 'https://' },
  { name: 'instagram', label: 'Instagram', placeholder: '@compte' },
  { name: 'soundcloud', label: 'SoundCloud / Mixcloud', placeholder: 'https://' },

  { type: 'section', label: 'Booking', hint: 'Laissez vide si vous gérez vos dates vous-même.' },
  { name: 'bookingName', label: 'Contact booking' },
  { name: 'bookingEmail', label: 'E-mail booking', type: 'email' },
  { name: 'bookingPhone', label: 'Téléphone booking', type: 'tel' },

  { type: 'section', label: 'Contact technique le jour J', hint: 'Personne à joindre par le régisseur. Souvent vous-même.' },
  { name: 'techName', label: 'Nom' },
  { name: 'techEmail', label: 'E-mail', type: 'email' },
  { name: 'techPhone', label: 'Téléphone', type: 'tel' },
];

export function loadProfile() {
  return { ...DEFAULT_PROFILE, ...(store.load(PROFILE_KEY, {}) || {}) };
}

export function saveProfile(profile) {
  store.save(PROFILE_KEY, profile);
  return profile;
}

/** En-tête HTML commun aux documents générés. */
export function documentHeader(profile, subtitle, title) {
  const logo = profile.logo ? `<img src="${profile.logo}" alt="">` : '';
  const lines = [
    profile.genres,
    [profile.city, profile.country].filter(Boolean).join(', '),
  ].filter(Boolean).join(' — ');

  return `<div class="doc-header">
    ${logo}
    <div class="doc-title">
      <div class="doc-sub">${escapeHtml(subtitle)}</div>
      <h1>${escapeHtml(title || profile.artistName || 'Artiste')}</h1>
      ${lines ? `<div>${escapeHtml(lines)}</div>` : ''}
    </div>
  </div>`;
}

/** Bloc « contacts » commun aux documents. */
export function contactSection(profile) {
  const kv = [];
  if (profile.techName || profile.techPhone || profile.techEmail) {
    kv.push(['Technique (jour J)', [profile.techName, profile.techPhone, profile.techEmail].filter(Boolean).join(' · ')]);
  }
  if (profile.bookingName || profile.bookingEmail || profile.bookingPhone) {
    kv.push(['Booking', [profile.bookingName, profile.bookingPhone, profile.bookingEmail].filter(Boolean).join(' · ')]);
  }
  if (profile.phone || profile.email) {
    kv.push(['Artiste', [profile.phone, profile.email].filter(Boolean).join(' · ')]);
  }
  if (profile.website) kv.push(['Web', profile.website]);
  if (profile.instagram || profile.soundcloud) {
    kv.push(['Réseaux', [profile.instagram, profile.soundcloud].filter(Boolean).join(' · ')]);
  }
  if (!kv.length) return '';

  return `<div class="doc-section">
    <h2>Contacts</h2>
    <div class="doc-grid">
      ${kv.map(([k, v]) => `<div class="doc-kv"><b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span></div>`).join('')}
    </div>
  </div>`;
}
