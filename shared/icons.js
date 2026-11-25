// Fixed icon set for scene nodes. 24x24 grid, stroke-based (stroke = currentColor).
// Authors reference icons by name only. To add an icon, add one entry here; the
// validator and the renderer both read this file.
const dot = (x, y) => `<path d="M${x} ${y}h.01" stroke-width="2.6"/>`;

export const ICONS = {
  // people & devices
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.3c2.2.6 3.5 2.6 3.5 5.7"/>',
  incognito: '<path d="M3 11h18"/><path d="M6 11l1.5-6.5h9L18 11"/><circle cx="7.5" cy="16" r="3"/><circle cx="16.5" cy="16" r="3"/><path d="M10.5 16c1-.7 2-.7 3 0"/>',
  browser: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18"/>' + dot(6.5, 6.5) + dot(9, 6.5),
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10.5" rx="1.5"/><path d="M2.5 19h19"/>',
  // infrastructure
  server: '<rect x="3.5" y="3.5" width="17" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="17" height="7" rx="1.8"/>' + dot(7, 7) + dot(7, 17),
  database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.4 9.2 4.7 4.7 0 0 0 7 18.5z"/>',
  function: '<path d="M14.5 4.5c-2.5 0-3 1.5-3.4 4L9.5 19.5c-.3 1.6-1.2 2-2.5 2"/><path d="M8 10h7"/>',
  api: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.3 11l7.4-4M8.3 13l7.4 4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  queue: '<rect x="2.5" y="8" width="5" height="8" rx="1"/><rect x="9.5" y="8" width="5" height="8" rx="1"/><rect x="16.5" y="8" width="5" height="8" rx="1"/>',
  bolt: '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12l1-8z"/>',
  box: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
  layers: '<path d="M12 3.5l9 4.5-9 4.5-9-4.5z"/><path d="M3 12l9 4.5 9-4.5M3 16l9 4.5 9-4.5"/>',
  rocket: '<path d="M12 15l-3-3c1.5-5 5-8.5 10.5-8.5 0 5.5-3.5 9-8.5 10.5z"/><path d="M9 12H5.5l2.5-3.5h3.5M12 15v3.5l3.5-2.5v-3.5"/><path d="M5.5 18.5c.5-1.5 1.5-2.5 3-2.5"/>',
  // security & identity
  key: '<circle cx="8" cy="15" r="4.5"/><path d="M11.2 11.8L20 3M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5"/>',
  shield: '<path d="M12 2.8l7.5 3v5.7c0 4.6-3.1 8.2-7.5 9.7-4.4-1.5-7.5-5.1-7.5-9.7V5.8z"/>',
  cookie: '<path d="M20.8 12.6A9 9 0 1 1 11.4 3.2a3 3 0 0 0 3.6 3.6 3 3 0 0 0 3.6 3.6 3 3 0 0 0 2.2 2.2z"/>' + dot(8.5, 9.5) + dot(8, 14.5) + dot(12.5, 16) + dot(15.5, 13),
  token: '<path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v2.5A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4z"/><path d="M14 6.5v11" stroke-dasharray="1.6 2"/>',
  'id-card': '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5 16c.6-1.6 2-2.4 3.5-2.4s2.9.8 3.5 2.4M14.5 10h4M14.5 13.5h3"/>',
  eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  // files & data
  file: '<path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z"/><path d="M14 3v4.5h4.5M9 12.5h6M9 16h4"/>',
  folder: '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.2l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>',
  list: '<path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h8"/>' + dot(4, 6.5) + dot(4, 12) + dot(4, 17.5),
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
  chart: '<path d="M4 4v16h16"/><path d="M8 15l3.5-4 3 2.5L19 8"/>',
  // dev tools
  code: '<path d="M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
  git: '<circle cx="6.5" cy="5.5" r="2.2"/><circle cx="6.5" cy="18.5" r="2.2"/><circle cx="17.5" cy="8.5" r="2.2"/><path d="M6.5 7.7v8.6M17.5 10.7c0 4-4 4.5-9.4 6.6"/>',
  bug: '<rect x="7.5" y="7.5" width="9" height="12" rx="4.5"/><path d="M9.5 7.5a2.5 2.5 0 0 1 5 0M12 11v8.5M7.5 12H4M20 12h-3.5M7.6 16H4.5M19.5 16h-3.1M8.3 9L5.5 6.5M15.7 9l2.8-2.5"/>',
  log: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7 8h2M11 8h6M7 12h2M11 12h6M7 16h2M11 16h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  flask: '<path d="M9.5 3h5M10.5 3v6L5 18.5A1.7 1.7 0 0 0 6.5 21h11a1.7 1.7 0 0 0 1.5-2.5L13.5 9V3"/><path d="M7.5 15h9"/>',
  pencil: '<path d="M15.5 4.5l4 4L8.5 19.5 4 20l.5-4.5z"/>',
  // AI
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  brain: '<path d="M12 5.5a3 3 0 0 0-5.6-1.3A3 3 0 0 0 4 8.5a3.2 3.2 0 0 0 .3 5.6A3 3 0 0 0 7 19a2.8 2.8 0 0 0 5 1z"/><path d="M12 5.5a3 3 0 0 1 5.6-1.3A3 3 0 0 1 20 8.5a3.2 3.2 0 0 1-.3 5.6A3 3 0 0 1 17 19a2.8 2.8 0 0 1-5 1z"/><path d="M12 5.5V20"/>',
  chat: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4H5.5A1.5 1.5 0 0 1 4 14.5z"/>',
  robot: '<rect x="4.5" y="8" width="15" height="11.5" rx="3"/><path d="M12 8V5M2.5 13v2.5M21.5 13v2.5"/><circle cx="12" cy="4" r="1"/>' + dot(9, 13.5) + dot(15, 13.5),
  vector: '<path d="M4 4v16h16"/><path d="M8 16l8-8M12.5 8H16v3.5"/>',
  // status & time
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M10.3 4.2L2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5V14"/>' + dot(12, 17),
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21h4"/>',
  refresh: '<path d="M20 11.5A8 8 0 0 0 5.5 7M4 12.5A8 8 0 0 0 18.5 17"/><path d="M5 3v4.5h4.5M19 21v-4.5h-4.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3.6-3.6a4 4 0 0 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-3.6 3.6a4 4 0 0 0 5.7 5.7l1.2-1.2"/>',
  upload: '<path d="M12 15V3.5M7.5 8L12 3.5 16.5 8M4 15v4.5h16V15"/>',
  download: '<path d="M12 3.5V15M7.5 10.5L12 15l4.5-4.5M4 15v4.5h16V15"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14"/>',
  // business
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  cart: '<path d="M3 4h2.5l2.2 11h10.8l2-7.5H6.4"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
};

export const ICON_NAMES = Object.keys(ICONS);
