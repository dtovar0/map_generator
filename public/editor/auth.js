// ════════════════════════════════════════════════════
// AUTH: current user, logout, viewer read-only mode
// ════════════════════════════════════════════════════
// toggleUserMenu/authLogout are resolved by the data-click delegation set up
// in core.js (runDataAction looks them up as window[...]), same as
// togglePresentationExportMenu; openUsersModal is a no-op until Task 14 lands
// since runDataAction silently ignores handlers that aren't functions yet.
let currentUser = null;

const ROLE_LABELS = { admin: 'Administrador', editor: 'Editor', viewer: 'Solo lectura' };

async function loadCurrentUser() {
  try {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    const data = await response.json();
    currentUser = data.user || null;
  } catch { currentUser = null; }
  window.currentUser = currentUser;
  applyCurrentUser();
}

function applyCurrentUser() {
  if (!currentUser) { window.location.replace('/login'); return; }
  const shortName = currentUser.displayName || currentUser.username;
  const chip = document.getElementById('user-chip-name');
  const name = document.getElementById('user-menu-name');
  const role = document.getElementById('user-menu-role');
  if (chip) chip.textContent = shortName;
  if (name) name.textContent = shortName;
  if (role) role.textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
  document.body.classList.toggle('role-admin', currentUser.role === 'admin');
  document.body.classList.toggle('role-viewer', currentUser.role === 'viewer');
  const adminButton = document.getElementById('btn-admin-users');
  if (adminButton) adminButton.hidden = currentUser.role !== 'admin';
  // Viewers land straight in presentation mode; edit chrome is hidden by CSS
  // and every write is rejected server-side anyway.
  if (currentUser.role === 'viewer' && typeof togglePresentationMode === 'function' && !document.body.classList.contains('presentation-mode')) {
    togglePresentationMode();
  }
}

function toggleUserMenu() {
  const menu = document.getElementById('user-menu-panel');
  const button = document.getElementById('btn-user');
  const open = menu.classList.toggle('open');
  if (button) button.setAttribute('aria-expanded', String(open));
}
function closeUserMenu() {
  document.getElementById('user-menu-panel')?.classList.remove('open');
  document.getElementById('btn-user')?.setAttribute('aria-expanded', 'false');
}
// Same outside-click pattern as #presentation-export-dropdown in selection.js:
// toggle .open on the inner .dropdown-menu, check containment on the outer wrapper.
document.addEventListener('click', event => {
  const dropdown = document.getElementById('user-menu');
  if (dropdown && !dropdown.contains(event.target)) closeUserMenu();
});

async function authLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
  window.location.replace('/login');
}

loadCurrentUser();
