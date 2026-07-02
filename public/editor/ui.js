// ════════════════════════════════════════════════════
// TOOLS / CONTROLS
// ════════════════════════════════════════════════════
// ════════════════════════════════════════════════════
// DROPDOWN MENU
// ════════════════════════════════════════════════════
function updateMenuState() {
  document.getElementById('canvas-bg')?.classList.toggle('grid-off', !gridEnabled);
  const gridInput = document.getElementById('cfg-grid-enabled');
  const snapInput = document.getElementById('cfg-snap-enabled');
  const autoOrderInput = document.getElementById('cfg-auto-order');
  if (gridInput) gridInput.checked = gridEnabled;
  if (snapInput) snapInput.checked = snapEnabled;
  if (autoOrderInput) autoOrderInput.checked = autoOrderEnabled;
}

function syncRightPanelControls() {
  const props = document.getElementById('props');
  const visible = !document.body.classList.contains('hide-props');
  const view = props.classList.contains('show-config') ? 'config' : props.classList.contains('show-scale') ? 'scale' : 'properties';
  const propertiesButton = document.getElementById('tool-toggle-props');
  propertiesButton?.classList.toggle('active', visible && view === 'properties');
  propertiesButton?.setAttribute('aria-pressed', String(visible && view === 'properties'));
  document.getElementById('tool-config')?.classList.toggle('active', visible && view === 'config');
  document.getElementById('tool-scale')?.classList.toggle('active', visible && view === 'scale');
}
function hideRightPanel() {
  document.body.classList.add('hide-props');
  syncRightPanelControls();
}
function openRightPanel(view) {
  const props = document.getElementById('props');
  props.classList.toggle('show-scale', view === 'scale');
  props.classList.toggle('show-config', view === 'config');
  document.body.classList.remove('hide-props');
  if (view === 'config') { mountConfigTabs(); renderConfigUI(); }
  syncRightPanelControls();
}
function toggleScalePanel() {
  const alreadyOpen = !document.body.classList.contains('hide-props') && document.getElementById('props').classList.contains('show-scale');
  if (alreadyOpen) hideRightPanel(); else openRightPanel('scale');
}
function toggleConfigPanel() {
  const alreadyOpen = !document.body.classList.contains('hide-props') && document.getElementById('props').classList.contains('show-config');
  if (alreadyOpen) hideRightPanel(); else openRightPanel('config');
}
function showPropsPanel() {
  const wasVisible = !document.body.classList.contains('hide-props');
  const props = document.getElementById('props');
  props.classList.remove('show-scale', 'show-config');
  if (wasVisible) document.body.classList.remove('hide-props');
  syncRightPanelControls();
}

function setTool(t) {
  exitArrangeView();   // switching tool always leaves the "ordenamiento" view
  currentTool = t; cancelLink();
  document.querySelectorAll('.ct-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-'+t)?.classList.add('active');
  // Sync palette tool items (select / link)
  document.querySelectorAll('#pal-select, #pal-link').forEach(el => el.classList.remove('active'));
  document.getElementById('pal-'+t)?.classList.add('active');
  // Restore persistent panel controls after resetting tool states.
  document.getElementById('tool-toggle-palette')?.classList.toggle('active', !document.body.classList.contains('hide-palette'));
  syncRightPanelControls();
  document.body.classList.toggle('linking', t==='link');
  if (!placingItem) document.getElementById('mode-label').textContent = t==='link' ? 'Modo: Conectar' : 'Modo: Seleccionar';
  renderLinkPointHints();   // draw hints when entering link mode / clear them when leaving
}
function togglePalettePanel() {
  const hidden = document.body.classList.toggle('hide-palette');
  document.getElementById('tool-toggle-palette')?.classList.toggle('active', !hidden);
}
function togglePropsPanel() {
  const props = document.getElementById('props');
  const propertiesOpen = !document.body.classList.contains('hide-props') && !props.classList.contains('show-scale') && !props.classList.contains('show-config');
  if (propertiesOpen) hideRightPanel(); else openRightPanel('properties');
}
function setGridEnabled(enabled) {
  gridEnabled = !!enabled;
  lsSet('mapgen_grid_enabled', String(gridEnabled));
  updateMenuState();
  setStatus(gridEnabled ? 'Cuadrícula visible' : 'Cuadrícula oculta');
}
function setSnapEnabled(enabled) {
  snapEnabled = !!enabled;
  lsSet('mapgen_snap_enabled', String(snapEnabled));
  updateMenuState();
  setStatus(snapEnabled ? 'Ajuste magnético activado' : 'Ajuste magnético desactivado');
}
function setAutoOrderEnabled(enabled) {
  autoOrderEnabled = !!enabled;
  lsSet('mapgen_auto_order_enabled', String(autoOrderEnabled));
  updateMenuState();
  if (autoOrderEnabled && nodes.length) {
    autoLayout();
    setStatus('Ordenamiento automático activado');
  } else {
    setStatus(autoOrderEnabled ? 'Ordenamiento automático activado' : 'Ordenamiento automático desactivado');
  }
}
function toggleGrid() { setGridEnabled(!gridEnabled); }
function toggleSnap() { setSnapEnabled(!snapEnabled); }
function toggleAutoOrder() { setAutoOrderEnabled(!autoOrderEnabled); }
function syncTagsToggleBtn() {
  const btn = document.getElementById('tool-tags');
  if (!btn) return;
  btn.classList.toggle('active', editorTagsHidden);
  btn.setAttribute('aria-pressed', String(editorTagsHidden));
  btn.title = editorTagsHidden ? 'Mostrar etiquetas de enlaces' : 'Ocultar etiquetas de enlaces';
}
function toggleEditorTags() {
  editorTagsHidden = !editorTagsHidden;
  lsSet('mapgen_editor_tags_hidden', String(editorTagsHidden));
  syncTagsToggleBtn();
  renderLinks();
  setStatus(editorTagsHidden ? 'Etiquetas de enlaces ocultas' : 'Etiquetas de enlaces visibles');
}
function deleteSelected() {
  const removingNodes = new Set(selectedNodeIds);
  const removingLinks = new Set(selectedLinkIds);
  if (selectedLinkId) removingLinks.add(selectedLinkId);
  if (!removingNodes.size && !removingLinks.size) return;
  // Surviving endpoints to redistribute: neighbors of deleted nodes + endpoints of deleted links.
  const affected = new Set();
  links.forEach(l => {
    if (removingNodes.has(l.from) || removingNodes.has(l.to) || removingLinks.has(l.id)) {
      affected.add(l.from); affected.add(l.to);
    }
  });
  // Drop selected links and every link touching a deleted node.
  links = links.filter(l => !removingLinks.has(l.id) && !removingNodes.has(l.from) && !removingNodes.has(l.to));
  removingNodes.forEach(id => { destroyChartInstance(id); document.getElementById(id)?.remove(); });
  nodes = nodes.filter(n => !removingNodes.has(n.id));
  affected.forEach(id => { if (nodes.some(n => n.id === id)) distributePortLinks(id); });
  const total = removingNodes.size + removingLinks.size;
  clearSelection(); renderLinks(); updateHint(); updateCounter(); pushHistory();
  setStatus(total > 1 ? `${total} elementos eliminados`
    : removingNodes.size ? 'Nodo eliminado' : 'Enlace eliminado');
}
function updatePaletteHotkeyTitles() {
  HOTKEY_TOOLS.forEach(tool => {
    const element = document.getElementById(tool.paletteId);
    if (element) element.title = `${tool.label} (${toolHotkeys[tool.id].toUpperCase()})`;
  });
}
function renderHotkeysDraft() {
  const list = document.getElementById('hotkeys-list');
  if (!list || !hotkeyDraft) return;
  list.innerHTML = HOTKEY_TOOLS.map(tool => `<div class="hotkey-row">
    <span class="hotkey-tool-icon"><svg viewBox="0 0 24 24">${tool.icon}</svg></span>
    <span class="hotkey-tool-copy"><strong>${tool.label}</strong><small>${tool.description}</small></span>
    <button type="button" class="hotkey-capture" data-keydown="captureHotkey" data-args='["$event","${tool.id}"]' aria-label="Cambiar atajo de ${tool.label}" title="Haz clic y presiona una tecla"><kbd>${hotkeyDraft[tool.id].toUpperCase()}</kbd><small>Cambiar</small></button>
  </div>`).join('');
}
function openHotkeysModal() {
  hotkeyDraft = {...toolHotkeys};
  renderHotkeysDraft();
  document.getElementById('hotkeys-modal')?.classList.add('open');
  document.getElementById('tool-hotkeys')?.classList.add('active');
  setTimeout(() => document.querySelector('.hotkey-capture')?.focus(), 80);
}
function closeHotkeysModal() {
  document.getElementById('hotkeys-modal')?.classList.remove('open');
  document.getElementById('tool-hotkeys')?.classList.remove('active');
  hotkeyDraft = null;
}
function captureHotkey(event, action) {
  event.preventDefault(); event.stopPropagation();
  const key = event.key.toLowerCase();
  if (!/^[a-z0-9]$/.test(key) || HOTKEY_RESERVED.has(key)) {
    showToast(key === 'p' ? 'La tecla P está reservada para Presentación.' : 'Usa una sola letra o número.', 'error');
    return;
  }
  const previousKey = hotkeyDraft[action];
  const duplicateAction = Object.keys(hotkeyDraft).find(id => id !== action && hotkeyDraft[id] === key);
  if (duplicateAction) hotkeyDraft[duplicateAction] = previousKey;
  hotkeyDraft[action] = key;
  renderHotkeysDraft();
  const nextButton = document.querySelector(`.hotkey-capture[onkeydown*="'${action}'"]`);
  nextButton?.focus();
}
function resetHotkeysDraft() {
  hotkeyDraft = {...DEFAULT_TOOL_HOTKEYS};
  renderHotkeysDraft();
}
function saveHotkeys() {
  if (!hotkeyDraft) return;
  toolHotkeys = {...hotkeyDraft};
  lsSet('mapgen_tool_hotkeys', JSON.stringify(toolHotkeys));
  updatePaletteHotkeyTitles();
  closeHotkeysModal();
  showToast('Tus atajos de herramientas se guardaron.', 'success');
}
function activateToolHotkey(action) {
  if (action === 'select') { cancelPlacing(); setTool('select'); return; }
  if (action === 'link') { cancelPlacing(); setTool('link'); return; }
  if (action === 'chart') { startChartPlacementMode(); return; }
  const tool = HOTKEY_TOOLS.find(item => item.id === action);
  const element = tool ? document.getElementById(tool.paletteId) : null;
  if (element && placingItem?.el !== element) activatePlacing(element);
}
// Currently open modal dialog, if any, so focus can be trapped inside it.
function openModalElement() {
  const dialogs = document.querySelectorAll('.modal-backdrop.open, #chart-wizard.open');
  return dialogs.length ? dialogs[dialogs.length - 1] : null;
}
// Keep Tab focus within the open modal (accessibility): a dialog should not
// let keyboard focus escape to the editor behind it.
function trapFocus(e, modal) {
  const focusable = [...modal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )].filter(el => el.offsetParent !== null);
  if (!focusable.length) { e.preventDefault(); return; }
  const first = focusable[0], last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !modal.contains(active))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (active === last || !modal.contains(active))) { e.preventDefault(); first.focus(); }
}
document.addEventListener('keydown', e => {
  if (e.key === 'Tab') { const modal = openModalElement(); if (modal) { trapFocus(e, modal); return; } }
  if ((e.ctrlKey||e.metaKey) && e.key==='f') { e.preventDefault(); openSearch(); return; }
  if (document.getElementById('search-bar')?.classList.contains('open') && e.key==='Escape') {
    e.preventDefault(); closeSearch(); return;
  }
  if (document.getElementById('alert-modal')?.classList.contains('open')) {
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeAlert(); }
    return;
  }
  if (document.getElementById('confirm-modal')?.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); resolveConfirm(false); }
    return;
  }
  if (document.getElementById('prompt-modal')?.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); resolvePrompt(null); }
    return;
  }
  if (document.getElementById('chart-wizard')?.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); closeChartWizard(); }
    return;
  }
  if (document.getElementById('cacti-binding-modal')?.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); closeCactiBindingModal(); }
    return;
  }
  if (document.getElementById('map-modal')?.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); closeMapModal(); }
    return;
  }
  if (document.getElementById('hotkeys-modal')?.classList.contains('open')) {
    if (e.key === 'Escape') { e.preventDefault(); closeHotkeysModal(); }
    return;
  }
  const tag = document.activeElement.tagName;
  if (tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA'||document.activeElement.isContentEditable) return;
  if (e.ctrlKey || e.metaKey) {
    const key = e.key.toLowerCase();
    if (key === 'g') { e.preventDefault(); saveMap(); return; }
    if (key === 'n') { e.preventDefault(); newMap(); return; }
    if (key === 'o') { e.preventDefault(); openMapModal(); return; }
    if (key === 'a') {
      e.preventDefault();
      const total = nodes.length + links.length;
      if (total) { applyResolvedSelection(nodes.map(n => n.id), links.map(l => l.id)); setStatus(`${total} elemento(s) seleccionado(s)`); }
      return;
    }
  }
  if (presentationMode) {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      e.preventDefault(); togglePresentationMode(false);
    }
    return;
  }
  if (e.key==='p'||e.key==='P') { e.preventDefault(); togglePresentationMode(true); return; }
  if ((e.ctrlKey||e.metaKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey||e.metaKey) && (e.key==='y' || (e.key==='z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if (e.key==='Delete'||e.key==='Backspace') deleteSelected();
  const hotkeyAction = Object.keys(toolHotkeys).find(action => toolHotkeys[action] === e.key.toLowerCase());
  if (hotkeyAction) { e.preventDefault(); if (!e.repeat) activateToolHotkey(hotkeyAction); return; }
  if (e.key==='Escape') { revertCancel(); cancelPlacing(); cancelLink(); clearSelection(); setTool('select'); if (multiPlacementEnabled) toggleMultiPlacement(); }
  if (e.key==='Enter') {
    if (selectedLinkId || selectedId || selectionCount()) {
      savedStateForCancel = null; clearSelection(); setTool('select');
    } else {
      saveMap(); setStatus('✓ Guardado');
    }
  }
});

// ════════════════════════════════════════════════════
// ZOOM
// ════════════════════════════════════════════════════
function setZoom(z, pivotX, pivotY) {
  const prev = zoom;
  zoom = Math.max(0.25, Math.min(4, z));
  // Zoom toward pivot point (mouse position in screen coords relative to wrap)
  if (pivotX !== undefined) {
    panX = pivotX - (pivotX - panX) * (zoom / prev);
    panY = pivotY - (pivotY - panY) * (zoom / prev);
  }
  applyTransform();
}
function zoomIn()  { setZoom(zoom + 0.1); }
function zoomOut() { setZoom(zoom - 0.1); }
function zoomFit() { zoom = 1; panX = 0; panY = 0; applyTransform(); }
document.getElementById('canvas-wrap').addEventListener('wheel', e => {
  e.preventDefault();
  const rect = document.getElementById('canvas-wrap').getBoundingClientRect();
  setZoom(zoom - e.deltaY * 0.001, e.clientX - rect.left, e.clientY - rect.top);
}, { passive: false });

// ════════════════════════════════════════════════════
// MODALS & TOASTS
// ════════════════════════════════════════════════════
function showAlert(message, title = 'Aviso') {
  const modal = document.getElementById('alert-modal');
  if (!modal) { window.alert(message); return; }
  document.getElementById('alert-modal-title').textContent = title;
  document.getElementById('alert-modal-msg').textContent = message;
  modal.classList.add('open');
  setTimeout(() => modal.querySelector('.primary')?.focus(), 60);
}
function closeAlert() {
  document.getElementById('alert-modal')?.classList.remove('open');
}

let _confirmResolve = null;
function showConfirm(message, title = '¿Confirmar?', okLabel = 'Aceptar') {
  const modal = document.getElementById('confirm-modal');
  if (!modal) { return Promise.resolve(window.confirm(message)); }
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-msg').textContent = message;
    document.getElementById('confirm-modal-ok').textContent = okLabel;
    modal.classList.add('open');
  });
}
function resolveConfirm(value) {
  document.getElementById('confirm-modal')?.classList.remove('open');
  if (_confirmResolve) { _confirmResolve(value); _confirmResolve = null; }
}

let _promptResolve = null;
function showPrompt(title, defaultValue = '') {
  const modal = document.getElementById('prompt-modal');
  if (!modal) { return Promise.resolve(window.prompt(title, defaultValue)); }
  return new Promise(resolve => {
    _promptResolve = resolve;
    document.getElementById('prompt-modal-title').textContent = title;
    const input = document.getElementById('prompt-modal-input');
    input.value = defaultValue;
    modal.classList.add('open');
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}
function resolvePrompt(val) {
  const input = document.getElementById('prompt-modal-input');
  const value = val === null ? null : (input?.value.trim() || null);
  document.getElementById('prompt-modal')?.classList.remove('open');
  if (_promptResolve) { _promptResolve(value); _promptResolve = null; }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const variants = {
    success: {
      title: 'Operación completada', meta: 'Éxito',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4.2 4.2L19 6.8"/></svg>'
    },
    error: {
      title: 'No pudimos completar la acción', meta: 'Error',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>'
    },
    info: {
      title: 'Actualización en curso', meta: 'Estado',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7h.01"/></svg>'
    }
  };
  const variant = variants[type] || variants.info;
  const duration = type === 'error' ? 6000 : 4000;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toast.style.setProperty('--toast-duration', `${duration}ms`);

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = variant.icon;

  const content = document.createElement('div');
  content.className = 'toast-content';

  const title = document.createElement('div');
  title.className = 'toast-title';
  title.textContent = variant.title;

  const heading = document.createElement('div');
  heading.className = 'toast-heading';

  const meta = document.createElement('span');
  meta.className = 'toast-meta';
  meta.textContent = variant.meta;

  const msg = document.createElement('div');
  msg.className = 'toast-msg';
  msg.textContent = String(message).replace(/^✓\s*/, '');
  heading.append(title, meta);
  content.append(heading, msg);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '×';
  closeBtn.title = 'Cerrar';
  closeBtn.setAttribute('aria-label', 'Cerrar notificación');

  let timeoutId;
  let remaining = duration;
  let startedAt = Date.now();
  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    clearTimeout(timeoutId);
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 500);
  };
  const startTimer = () => {
    startedAt = Date.now();
    timeoutId = setTimeout(dismiss, remaining);
  };
  closeBtn.addEventListener('click', dismiss);
  toast.addEventListener('mouseenter', () => {
    clearTimeout(timeoutId);
    remaining -= Date.now() - startedAt;
  });
  toast.addEventListener('mouseleave', () => {
    if (!dismissed) startTimer();
  });

  const progress = document.createElement('span');
  progress.className = 'toast-progress';
  progress.setAttribute('aria-hidden', 'true');

  toast.appendChild(icon);
  toast.appendChild(content);
  toast.appendChild(closeBtn);
  toast.appendChild(progress);
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  startTimer();
}
