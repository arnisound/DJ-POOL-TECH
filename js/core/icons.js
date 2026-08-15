/** Bibliothèque d'icônes (chemins SVG, viewBox 0 0 24 24, trait). */
export const ICONS = {
  home:      '<path d="M3 10.6 12 3l9 7.6V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  doc:       '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  clipboard: '<path d="M9 4h6v3H9z"/><path d="M7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M8.5 12h7M8.5 16h5"/>',
  pulse:     '<path d="M2 12h3.5l2.2-6.5 3.4 13.5 2.8-9 1.8 4H22"/>',
  tap:       '<circle cx="12" cy="12" r="3"/><path d="M6.4 6.4a8 8 0 0 0 0 11.2M17.6 6.4a8 8 0 0 1 0 11.2M3.6 3.6a12 12 0 0 0 0 16.8M20.4 3.6a12 12 0 0 1 0 16.8"/>',
  note:      '<path d="M9 17V5l10-2v12"/><circle cx="6" cy="17" r="3"/><circle cx="16" cy="15" r="3"/>',
  wheel:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v5.6M21 12h-5.6M12 21v-5.6M3 12h5.6"/>',
  sliders:   '<path d="M4 7h6M14 7h6M4 12h10M18 12h2M4 17h3M11 17h9"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="9" cy="17" r="2"/>',
  list:      '<path d="M8 6h13M8 12h13M8 18h10"/><circle cx="3.8" cy="6" r=".9"/><circle cx="3.8" cy="12" r=".9"/><circle cx="3.8" cy="18" r=".9"/>',
  clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/>',
  timer:     '<path d="M10 2.5h4M12 13.5V9"/><circle cx="12" cy="14" r="8"/><path d="M18.6 7.4 20 6"/>',
  check:     '<path d="M9 11.5 12 14.5 21.5 5"/><path d="M21 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  save:      '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 20.5h16"/>',
  print:     '<path d="M7 9V3h10v6M7 19H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 15h10v6H7z"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  trash:     '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  up:        '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down:      '<path d="M12 5v14M6 13l6 6 6-6"/>',
  copy:      '<path d="M9 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/><path d="M15 5.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h.5"/>',
  upload:    '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M4 20.5h16"/>',
  speaker:   '<rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="15" r="3.4"/><circle cx="12" cy="7" r="1.6"/>',
  bolt:      '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  info:      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};

/** Renvoie le markup SVG complet pour une icône. */
export function svg(name, cls = 'ico') {
  return `<span class="${cls}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg></span>`;
}
