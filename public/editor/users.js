// ── Admin users panel ──────────────────────────────────────────────
// Delegated handlers (openUsersModal, closeUsersModal, setUserRole,
// toggleUserActive, resetUserPassword, removeUser) are resolved as
// window[...] globals by runDataAction in core.js, same as the rest of
// the editor's data-click/data-change dispatch. escapeHtml/setStatus/
// showAlert/showConfirm/showPrompt are globals already defined in
// history.js/ui.js.
const ROLE_OPTIONS = [['viewer', 'Solo lectura'], ['editor', 'Editor'], ['admin', 'Administrador']];

function openUsersModal() {
  document.getElementById('users-modal').classList.add('open');
  closeUserMenu();
  refreshUsers();
}

function closeUsersModal() {
  document.getElementById('users-modal').classList.remove('open');
}

async function usersApi(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

async function refreshUsers() {
  const table = document.getElementById('users-table');
  try {
    const { users } = await usersApi('/api/admin/users');
    table.innerHTML = users.map((user) => `
      <div class="users-row ${user.active ? '' : 'users-row-inactive'}" data-user-id="${user.id}">
        <div class="users-cell-id">
          <strong>${escapeHtml(user.displayName || user.username)}</strong>
          <small>${escapeHtml(user.username)} · ${user.provider === 'authelia' ? 'Authelia' : 'Local'}${user.roleLocked ? ' · rol fijado' : ''}</small>
        </div>
        <span class="users-badge users-badge-${user.role}">${ROLE_OPTIONS.find(([value]) => value === user.role)[1]}</span>
        <select class="users-role-select" data-change="setUserRole" data-args='[${user.id},"$value"]'>
          ${ROLE_OPTIONS.map(([value, label]) => `<option value="${value}" ${user.role === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        ${user.provider === 'local' ? `<button class="tb-btn users-action" data-click="resetUserPassword" data-args='[${user.id}]'>Contraseña</button>` : ''}
        <button class="tb-btn users-action" data-click="toggleUserActive" data-args='[${user.id},${user.active ? 'false' : 'true'}]'>${user.active ? 'Desactivar' : 'Activar'}</button>
        <button class="tb-btn users-action users-action-danger" data-click="removeUser" data-args='[${user.id}]'>Eliminar</button>
      </div>`).join('') || '<p class="users-empty">Sin usuarios registrados.</p>';
  } catch (error) {
    table.innerHTML = `<p class="users-empty">${escapeHtml(error.message)}</p>`;
  }
}

async function setUserRole(id, role) {
  try { await usersApi(`/api/admin/users/${id}`, jsonPatch({ role })); setStatus('Rol actualizado'); }
  catch (error) { showAlert(error.message); }
  refreshUsers();
}

async function toggleUserActive(id, active) {
  try { await usersApi(`/api/admin/users/${id}`, jsonPatch({ active })); setStatus(active ? 'Usuario activado' : 'Usuario desactivado'); }
  catch (error) { showAlert(error.message); }
  refreshUsers();
}

async function resetUserPassword(id) {
  const password = await showPrompt('Nueva contraseña (mínimo 8 caracteres):');
  if (!password) return;
  try { await usersApi(`/api/admin/users/${id}`, jsonPatch({ password })); setStatus('Contraseña actualizada'); }
  catch (error) { showAlert(error.message); }
}

async function removeUser(id) {
  const ok = await showConfirm('¿Eliminar este usuario definitivamente?', 'Eliminar usuario', 'Eliminar');
  if (!ok) return;
  try { await usersApi(`/api/admin/users/${id}`, { method: 'DELETE' }); setStatus('Usuario eliminado'); }
  catch (error) { showAlert(error.message); }
  refreshUsers();
}

function jsonPatch(body) {
  return { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

document.getElementById('user-create-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const username = document.getElementById('user-new-username').value.trim();
  const password = document.getElementById('user-new-password').value;
  const role = document.getElementById('user-new-role').value;
  try {
    await usersApi('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    event.target.reset();
    setStatus('Usuario creado');
  } catch (error) { showAlert(error.message); }
  refreshUsers();
});
