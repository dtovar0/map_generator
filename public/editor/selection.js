// ════════════════════════════════════════════════════
// SELECTION
// ════════════════════════════════════════════════════
function setNodeSelection(ids) {
  clearActiveUsageLabel();
  selectedNodeIds = new Set(ids);
  selectedLinkIds = new Set();
  selectedId = ids.length ? ids[ids.length - 1] : null;
  selectedLinkId = null;
  setConnHandlesMode(false); clearConnectionHandles();
  exitArrangeView();
  nodes.forEach(n => {
    const el = document.getElementById(n.id);
    el?.classList.toggle('selected', selectedNodeIds.has(n.id));
    el?.classList.remove('link-endpoint');
  });
  document.body.classList.remove('has-link-selected');
  if (selectedId) showPropsPanel();
  renderLinks(); updatePropsPanel();
  const n = selectedId && getNode(selectedId);
  if (n && selectedNodeIds.size === 1) showPosBadge(n.x, n.y); else hidePosBadge();
}
function selectNode(id) {
  setNodeSelection([id]);
}
function selectionCount() { return selectedNodeIds.size + selectedLinkIds.size; }
// Nodes that must move together: selected nodes + both endpoints of every selected link
// (so a selected link translates rigidly instead of stretching).
function effectiveDragNodeIds() {
  const ids = new Set(selectedNodeIds);
  const linkSet = new Set(selectedLinkIds);
  if (selectedLinkId) linkSet.add(selectedLinkId);
  if (linkSet.size) links.forEach(l => { if (linkSet.has(l.id)) { ids.add(l.from); ids.add(l.to); } });
  return ids;
}
function setMultiSelection(nodeIds, linkIds) {
  clearActiveUsageLabel();
  selectedNodeIds = new Set(nodeIds);
  selectedLinkIds = new Set(linkIds);
  selectedId = nodeIds.length ? nodeIds[nodeIds.length - 1] : null;
  selectedLinkId = null;
  setConnHandlesMode(false); clearConnectionHandles();
  nodes.forEach(n => {
    const el = document.getElementById(n.id);
    el?.classList.toggle('selected', selectedNodeIds.has(n.id));
    el?.classList.remove('link-endpoint');
  });
  document.body.classList.remove('has-link-selected');
  savedStateForCancel = null;
  showPropsPanel(); renderLinks(); updatePropsPanel(); hidePosBadge();
}
// Route a resolved selection to the right mode: none / single node / single link / multi.
function applyResolvedSelection(nodeIds, linkIds) {
  const total = nodeIds.length + linkIds.length;
  if (total === 0) clearSelection();
  else if (total === 1 && nodeIds.length === 1) selectNode(nodeIds[0]);
  else if (total === 1 && linkIds.length === 1) selectLink(linkIds[0]);
  else setMultiSelection(nodeIds, linkIds);
}
function toggleNodeSelection(id) {
  const nodeIds = new Set(selectedNodeIds);
  if (nodeIds.has(id)) nodeIds.delete(id); else nodeIds.add(id);
  const linkIds = new Set(selectedLinkIds);
  if (selectedLinkId) linkIds.add(selectedLinkId);
  applyResolvedSelection([...nodeIds], [...linkIds]);
}
function toggleLinkSelection(id) {
  const linkIds = new Set(selectedLinkIds);
  if (selectedLinkId) linkIds.add(selectedLinkId);
  if (linkIds.has(id)) linkIds.delete(id); else linkIds.add(id);
  applyResolvedSelection([...selectedNodeIds], [...linkIds]);
}
function selectLink(id) {
  clearActiveUsageLabel();
  selectedLinkId = id; selectedId = null; selectedNodeIds = new Set(); selectedLinkIds = new Set();
  nodes.forEach(n => document.getElementById(n.id)?.classList.remove('selected', 'link-endpoint'));
  const l = getLink(id);
  if (l) {
    document.getElementById(l.from)?.classList.add('link-endpoint');
    document.getElementById(l.to)?.classList.add('link-endpoint');
  }
  document.body.classList.add('has-link-selected');
  saveForCancel(); // capture state before any edits to this link
  showPropsPanel(); renderLinks(); updatePropsPanel(); hidePosBadge();
}
function clearSelection() {
  cancelCustomAlignment();
  clearActiveUsageLabel();
  selectedId = null; selectedLinkId = null; selectedNodeIds = new Set(); selectedLinkIds = new Set();
  setConnHandlesMode(false); clearConnectionHandles();
  exitArrangeView();
  nodes.forEach(n => document.getElementById(n.id)?.classList.remove('selected', 'link-endpoint'));
  document.body.classList.remove('has-link-selected');
  savedStateForCancel = null; // commit any pending link edits
  renderLinks(); updatePropsPanel(); hidePosBadge();
}
function showPosBadge(x, y) { const b = document.getElementById('pos-badge'); b.textContent = `x: ${x}  y: ${y}`; b.classList.add('show'); }
function hidePosBadge() { document.getElementById('pos-badge').classList.remove('show'); }
function marqueeRect() {
  return {
    minX: Math.min(marquee.x0, marquee.x1), maxX: Math.max(marquee.x0, marquee.x1),
    minY: Math.min(marquee.y0, marquee.y1), maxY: Math.max(marquee.y0, marquee.y1)
  };
}
function updateMarqueeEl() {
  const m = document.getElementById('marquee-rect'); if (!m || !marquee) return;
  const r = marqueeRect();
  m.style.cssText = `left:${r.minX}px;top:${r.minY}px;width:${r.maxX - r.minX}px;height:${r.maxY - r.minY}px`;
}
function nodesInMarquee() {
  const r = marqueeRect();
  return nodes.filter(n => {
    const l = n.x - n.w / 2, rg = n.x + n.w / 2, t = n.y - n.h / 2, b = n.y + n.h / 2;
    return !(rg < r.minX || l > r.maxX || b < r.minY || t > r.maxY);
  }).map(n => n.id);
}
function _segsIntersect(p1, p2, p3, p4) {
  const d = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function _segIntersectsRect(a, b, r) {
  const inside = p => p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
  if (inside(a) || inside(b)) return true;
  const c = [{x:r.minX,y:r.minY},{x:r.maxX,y:r.minY},{x:r.maxX,y:r.maxY},{x:r.minX,y:r.maxY}];
  return _segsIntersect(a, b, c[0], c[1]) || _segsIntersect(a, b, c[1], c[2]) ||
         _segsIntersect(a, b, c[2], c[3]) || _segsIntersect(a, b, c[3], c[0]);
}
function linksInMarquee() {
  const r = marqueeRect();
  return links.filter(l => {
    const v = getLinkVertices(l);
    for (let i = 0; i < v.length - 1; i++) if (_segIntersectsRect(v[i], v[i + 1], r)) return true;
    return false;
  }).map(l => l.id);
}
function finalizeMarquee() {
  const hitNodes = nodesInMarquee();
  const hitLinks = linksInMarquee();
  let nodeIds = hitNodes, linkIds = hitLinks;
  if (marquee.additive) {
    nodeIds = [...new Set([...selectedNodeIds, ...hitNodes])];
    linkIds = [...new Set([...selectedLinkIds, ...(selectedLinkId ? [selectedLinkId] : []), ...hitLinks])];
  }
  document.getElementById('marquee-rect')?.remove();
  marquee = null;
  justMarqueed = true;
  applyResolvedSelection(nodeIds, linkIds);
  const total = nodeIds.length + linkIds.length;
  setStatus(total ? `${total} elemento(s) seleccionado(s)` : 'Listo');
}

function presentationInfoRows(rows) {
  return `<dl class="presentation-info-grid">${rows.map(([label, value]) =>
    `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? '—')}</dd>`).join('')}</dl>`;
}
function focusPresentationElement(element) {
  document.querySelectorAll('.presentation-focused').forEach(el => el.classList.remove('presentation-focused'));
  element?.classList.add('presentation-focused');
}
function showPresentationNodeInfo(id) {
  if (!presentationMode) return;
  const n = getNode(id); if (!n) return;
  const typeNames = {switch:'Nodo',server:'Icono',text:'Texto',chart:'Gráfica'};
  const rows = [
    ['Nombre', n.name || 'Sin nombre'],
    ['Tipo', typeNames[n.type] || n.type],
    ['Entrada', `${n.inPct ?? 0}%`],
    ['Salida', `${n.outPct ?? 0}%`],
    ['Tamaño', `${Math.round(n.w)} × ${Math.round(n.h)} px`],
    ['Conexiones', String(linksTouching(id).length)],
    ['Fuente', `${n.fontFamily || 'Sistema'} · ${getNodeFontSize(n)}px${n.fontBold ? ' · negrita' : ''}${n.fontItalic ? ' · cursiva' : ''}`]
  ];
  if (n.type === 'text') rows.push(['Orientación', `${Number(n.textRotation) || 0}°`]);
  if (n.type === 'chart' && n.graphConfig?.type) rows.push(['Gráfica', n.graphConfig.type]);
  document.getElementById('presentation-info-title').textContent = n.name || 'Información del nodo';
  document.getElementById('presentation-info-content').innerHTML = presentationInfoRows(rows);
  document.getElementById('presentation-info').classList.add('show');
  focusPresentationElement(document.getElementById(id));
}
function showPresentationLinkInfo(id) {
  if (!presentationMode) return;
  const l = getLink(id); if (!l) return;
  const from = getNode(l.from), to = getNode(l.to);
  const markerNames = {circle:'Círculo',square:'Cuadrado',diamond:'Diamante',bar:'Barra',arrows:'Flechas',none:'Ninguno'};
  const labelPositionNames = {center:'Centro',above:'Arriba',below:'Abajo'};
  const rows = [
    ['Origen', from?.name || l.from],
    ['Destino', to?.name || l.to],
    ['Puerto de origen', l.fromPort || 'centro'],
    ['Puerto de destino', l.toPort || 'centro'],
    ['Descripción', l.description || 'Sin descripción'],
    ['Capacidad', `${formatUtilization(l.capacity)} ${shortCapacityUnit(l.capacityUnit || 'Mbps')}`],
    ['Entrada real', `${formatUtilization(l.inUsage)} ${shortCapacityUnit(l.capacityUnit || 'Mbps')} · ${formatPercentage(l.inPct)}%`],
    ['Salida real', `${formatUtilization(l.outUsage)} ${shortCapacityUnit(l.capacityUnit || 'Mbps')} · ${formatPercentage(l.outPct)}%`],
    ['Grosor', `${Number(l.width) || generalConfig.linkWidth}px`],
    ['Marcador', markerNames[l.midTermination] || l.midTermination || 'Ninguno'],
    ['Divisor', `${l.dividerPosition ?? 50}%`],
    ['Umbrales', l.scaleOverride ? 'Individuales' : 'Generales'],
    ['Tag de capacidad', l.capacityLabelVisible === false ? 'Oculto' : `${l.capacityLabelFontSize ?? 11}px · ${{above:'Arriba',below:'Abajo',left:'Izquierda',right:'Derecha'}[l.capacityLabelSide] || 'Derecha'}${l.capacityLabelRotate ? ' · sigue enlace' : ''}${l.capacityLabelRotate && l.capacityLabelFlip ? ' · giro vertical 180°' : ''} · ${l.capacityLabelOverride ? 'individual' : 'general'}`],
    ['Texto de tráfico', `${l.usageLabelFormat === 'human' ? 'Utilización legible' : 'Porcentaje'} · ${labelPositionNames[l.usageLabelPosition] || 'Arriba'}${l.usageLabelRotate ? ' · sigue enlace' : ''}${l.usageLabelRotate && l.usageLabelFlip ? ' · giro vertical 180°' : ''} · ${l.usageLabelOverride ? 'individual' : 'general'}`]
  ];
  if (l.dataSource?.provider === 'cacti') {
    rows.splice(5, 0, ['Gráfica Cacti', l.dataSource.graphName || 'Binding anterior sin gráfica']);
  }
  document.getElementById('presentation-info-title').textContent = `${from?.name || l.from} → ${to?.name || l.to}`;
  document.getElementById('presentation-info-content').innerHTML = presentationInfoRows(rows);
  document.getElementById('presentation-info').classList.add('show');
  const group = [...document.querySelectorAll('.link-group')].find(el => el.dataset.linkId === id);
  focusPresentationElement(group);
}
function hidePresentationInfo() {
  document.getElementById('presentation-info')?.classList.remove('show');
  const title = document.getElementById('presentation-info-title');
  const content = document.getElementById('presentation-info-content');
  if (title) title.textContent = 'Información';
  if (content) content.innerHTML = '<p class="presentation-info-empty">Selecciona un nodo o enlace para consultar su información.</p>';
  focusPresentationElement(null);
}

function togglePresentationMode(force) {
  const next = typeof force === 'boolean' ? force : !presentationMode;
  if (next === presentationMode) return;
  hidePresentationInfo();

  if (next) {
    if (editingTextNodeId) finishInlineTextEdit(true);
    cancelPlacing(); cancelLink(); clearSelection(); setTool('select');
    document.getElementById('props').classList.remove('show-scale', 'show-config');
    document.getElementById('tool-scale').classList.remove('active');
    document.getElementById('tool-config').classList.remove('active');
  }

  presentationMode = next;
  document.body.classList.toggle('presentation-mode', next);
  if (!next) document.body.classList.remove('presentation-date-empty');
  const dateInput = document.getElementById('presentation-date');
  if (dateInput) dateInput.value = selectedMapDate;
  const button = document.getElementById('btn-presentation');
  button.textContent = next ? '✎ Volver al editor' : '▶ Presentación';
  button.setAttribute('aria-pressed', String(next));
  document.getElementById('mode-label').textContent = next ? 'Modo: Presentación' : 'Modo: Seleccionar';
  updatePresentationViewControls();
  schedulePresentationRefresh();
  if (next && presentationViewMode === 'live') refreshPresentationData();
  setStatus(next ? 'Vista de presentación · arrastra el fondo para desplazarte · rueda para zoom' : 'Vista de editor');

  requestAnimationFrame(() => {
    renderLinks();
    chartInstances.forEach(chart => chart.resize());
  });
}

function schedulePresentationRefresh() {
  if (presentationRefreshTimer) clearInterval(presentationRefreshTimer);
  presentationRefreshTimer = null;
  if (!presentationMode || presentationViewMode !== 'live') return;
  presentationRefreshTimer = setInterval(refreshPresentationData, presentationRefreshMinutes * 60 * 1000);
}

function setPresentationRefresh(rawMinutes) {
  const minutes = Number(rawMinutes);
  if (!PRESENTATION_REFRESH_OPTIONS.includes(minutes)) return;
  presentationRefreshMinutes = minutes;
  lsSet('mapgen_presentation_refresh', String(minutes));
  schedulePresentationRefresh();
  setStatus(`Auto refresco cada ${minutes} minutos`);
}

function updatePresentationViewControls() {
  const date = document.getElementById('presentation-date');
  const refresh = document.getElementById('presentation-refresh');
  syncSegToggle('presentation-view-mode', presentationViewMode);
  if (date) date.disabled = presentationViewMode === 'live';
  if (refresh) refresh.disabled = presentationViewMode === 'day';
}

async function setPresentationViewMode(mode) {
  if (!['live','day'].includes(mode) || mode === presentationViewMode) {
    updatePresentationViewControls(); return;
  }
  presentationViewMode = mode;
  lsSet('mapgen_presentation_view_mode', mode);
  updatePresentationViewControls();
  schedulePresentationRefresh();
  if (!presentationMode || !currentServerMapId) {
    setStatus(mode === 'live' ? 'Vista Live seleccionada' : 'Vista por día seleccionada');
    return;
  }
  if (mode === 'live') await refreshPresentationData();
  else await selectPresentationDate(selectedMapDate);
}

async function refreshPresentationData() {
  if (!presentationMode || presentationViewMode !== 'live' || !currentServerMapId || presentationRefreshInFlight) return;
  presentationRefreshInFlight = true;
  try {
    await selectPresentationDate(selectedMapDate, true);
  } finally {
    presentationRefreshInFlight = false;
  }
}

const cactiDemoCatalog = {
  devices: [
    {id:901, name:'Demo Core SW-01', hostname:'core-sw-01.demo.local'},
    {id:902, name:'Demo Edge RTR-01', hostname:'edge-rtr-01.demo.local'},
    {id:903, name:'Demo Firewall HA', hostname:'fw-ha.demo.local'}
  ],
  graphs: new Map([
    [901, [
      {id:19001, hostId:901, name:'Traffic - TenGigabitEthernet1/1 uplink ISP', dataSources:[
        {localDataId:99001, name:'Te1/1 · uplink ISP', snmpIndex:'TenGigabitEthernet1/1', dataSourceNames:['traffic_in','traffic_out'], capacityBps:10000000000}
      ]},
      {id:19002, hostId:901, name:'Traffic - Port-channel10 backbone', dataSources:[
        {localDataId:99002, name:'Po10 · backbone', snmpIndex:'Port-channel10', dataSourceNames:['traffic_in','traffic_out'], capacityBps:20000000000}
      ]}
    ]],
    [902, [
      {id:29001, hostId:902, name:'Traffic - WAN MPLS', dataSources:[
        {localDataId:99011, name:'Gi0/0 · WAN MPLS', snmpIndex:'GigabitEthernet0/0', dataSourceNames:['traffic_in','traffic_out'], capacityBps:1000000000}
      ]},
      {id:29002, hostId:902, name:'Traffic - Internet DIA', dataSources:[
        {localDataId:99012, name:'Gi0/1 · Internet DIA', snmpIndex:'GigabitEthernet0/1', dataSourceNames:['bytes_in','bytes_out'], capacityBps:1000000000}
      ]}
    ]],
    [903, [
      {id:39001, hostId:903, name:'Traffic - Outside interface', dataSources:[
        {localDataId:99021, name:'outside · public', snmpIndex:'outside', dataSourceNames:['in','out'], capacityBps:1000000000}
      ]},
      {id:39002, hostId:903, name:'Traffic - Inside trunk', dataSources:[
        {localDataId:99022, name:'inside · trunk', snmpIndex:'inside', dataSourceNames:['traffic_in','traffic_out'], capacityBps:10000000000}
      ]}
    ]]
  ])
};
const cactiCatalog = { devices:null, graphs:new Map(), sources:new Map(), demo:false };

function setCactiModalState(message, type = '') {
  const state = document.getElementById('cacti-modal-state');
  if (state) state.innerHTML = message ? `<span class="cacti-state ${type}">${message}</span>` : '';
}

function cactiBindingHtml(link) {
  const binding = link.dataSource?.provider === 'cacti' ? link.dataSource : null;
  const status = link.telemetryError
    ? `<span class="cacti-state error">⚠ ${escapeHtml(link.telemetryError)}</span>`
    : binding
      ? `<span class="cacti-state connected">● Vinculado${link.telemetryTimestamp ? ` · ${new Date(link.telemetryTimestamp * 1000).toLocaleString()}` : ''}</span>`
      : '<span class="cacti-state">Sin fuente vinculada</span>';
  return `<div class="prop-row cacti-binding" id="cacti-binding-${link.id}">
    <div class="prop-label">Fuente de datos · Cacti</div>
    ${status}
    ${binding ? `<div class="cacti-binding-summary"><strong>${escapeHtml(binding.deviceName || `Host ${binding.hostId}`)}</strong>${binding.graphName ? `<span>Gráfica: ${escapeHtml(binding.graphName)}</span>` : ''}<span>${escapeHtml(binding.sourceName || `Fuente ${binding.localDataId}`)}</span><small>IN: ${escapeHtml(binding.inDs || '—')} · OUT: ${escapeHtml(binding.outDs || '—')}</small></div>` : ''}
    <div class="cacti-binding-actions">
      <button class="tb-btn primary" type="button" data-click="openCactiBindingModal" data-args='["${link.id}"]'>${binding ? 'Cambiar fuente' : 'Vincular fuente'}</button>
      ${binding ? `<button class="tb-btn" type="button" data-click="testCactiBinding" data-args='["${link.id}"]'>Probar</button><button class="tb-btn" type="button" data-click="clearCactiBinding" data-args='["${link.id}"]'>Quitar</button>` : ''}
    </div>
  </div>`;
}

function openCactiBindingModal(linkId) {
  const link = getLink(linkId);
  if (!link) return;
  const modal = document.getElementById('cacti-binding-modal');
  const picker = document.getElementById('cacti-modal-picker');
  if (!modal || !picker) {
    loadCactiDevices(linkId);
    return;
  }
  modal.dataset.linkId = linkId;
  picker.innerHTML = '';
  setCactiModalState('Preparando catálogo de Cacti…');
  modal.classList.add('open');
  loadCactiDevices(linkId, true);
}

function closeCactiBindingModal() {
  document.getElementById('cacti-binding-modal')?.classList.remove('open');
}

function saveCactiBindingFromModal() {
  const modal = document.getElementById('cacti-binding-modal');
  const linkId = modal?.dataset.linkId;
  if (!linkId) return;
  const hostId = Number(document.getElementById(`cacti-device-${linkId}`)?.value);
  const sourceSelect = document.getElementById(`cacti-source-${linkId}`);
  const localDataId = Number(sourceSelect?.value);
  const graphId = Number(sourceSelect?.selectedOptions?.[0]?.dataset?.graphId);
  if (!hostId || !localDataId) {
    setCactiModalState('Selecciona equipo y fuente antes de guardar.', 'error');
    return;
  }
  applyCactiBinding(linkId, hostId, localDataId, graphId || null);
}

function resetCactiDemoCatalog() {
  cactiCatalog.devices = cactiDemoCatalog.devices;
  cactiCatalog.graphs = new Map();
  cactiCatalog.sources = new Map();
  cactiCatalog.demo = true;
  const linkId = document.getElementById('cacti-binding-modal')?.dataset.linkId;
  if (linkId) {
    setCactiModalState('Modo demo activo: usando catálogo de ejemplo.', 'connected');
    loadCactiDevices(linkId);
  }
}

function cactiDisabledFlowHtml(linkId, sourceText = 'Primero selecciona un equipo…', dsText = 'Primero selecciona una fuente…') {
  return `<div id="cacti-source-wrap-${linkId}">
    <div class="cacti-modal-grid">
      <label><span>Fuente de la gráfica</span><select class="prop-val" id="cacti-source-${linkId}" disabled>
        <option>${escapeHtml(sourceText)}</option>
      </select></label>
    </div>
    <div id="cacti-ds-wrap-${linkId}">
      <div class="cacti-ds-grid">
        <label>Entrada<select class="prop-val" id="cacti-in-${linkId}" disabled><option>${escapeHtml(dsText)}</option></select></label>
        <label>Salida<select class="prop-val" id="cacti-out-${linkId}" disabled><option>${escapeHtml(dsText)}</option></select></label>
      </div>
      ${cactiPreviewHtml('Selecciona una fuente y sus DS para ver valores de muestra.')}
    </div>
  </div>`;
}

function cactiDisabledCatalogHtml(linkId, deviceText = 'Cargando equipos…', sourceText = 'Primero selecciona un equipo…', dsText = 'Primero selecciona una fuente…') {
  return `<div class="cacti-modal-grid">
    <label><span>Equipo</span><select class="prop-val" id="cacti-device-${linkId}" disabled><option>${escapeHtml(deviceText)}</option></select></label>
  </div><div id="cacti-graph-wrap-${linkId}">${cactiDisabledFlowHtml(linkId, sourceText, dsText)}</div>`;
}

function cactiPreviewHtml(message = 'Sin vista previa todavía.') {
  return `<div class="cacti-preview" id="cacti-preview">
    <div class="cacti-preview-head"><strong>Vista previa</strong><span>${escapeHtml(message)}</span></div>
    <div class="cacti-preview-grid">
      <div><small>Entrada</small><b id="cacti-preview-in">—</b><em id="cacti-preview-in-ds">DS no seleccionado</em></div>
      <div><small>Salida</small><b id="cacti-preview-out">—</b><em id="cacti-preview-out-ds">DS no seleccionado</em></div>
    </div>
  </div>`;
}

function formatCactiPreviewValue(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const abs = Math.abs(Number(value));
  if (abs >= 1000) return `${(Number(value) / 1000).toFixed(2)} Gbps`;
  if (abs >= 1) return `${Number(value).toFixed(2)} Mbps`;
  return `${(Number(value) * 1000).toFixed(2)} Kbps`;
}

function setCactiPreview({message = '', inValue = null, outValue = null, inDs = '', outDs = '', error = false} = {}) {
  const preview = document.getElementById('cacti-preview'); if (!preview) return;
  preview.classList.toggle('error', !!error);
  const msg = preview.querySelector('.cacti-preview-head span');
  const inEl = document.getElementById('cacti-preview-in');
  const outEl = document.getElementById('cacti-preview-out');
  const inDsEl = document.getElementById('cacti-preview-in-ds');
  const outDsEl = document.getElementById('cacti-preview-out-ds');
  if (msg) msg.textContent = message;
  if (inEl) inEl.textContent = formatCactiPreviewValue(inValue);
  if (outEl) outEl.textContent = formatCactiPreviewValue(outValue);
  if (inDsEl) inDsEl.textContent = inDs || 'DS no seleccionado';
  if (outDsEl) outDsEl.textContent = outDs || 'DS no seleccionado';
}

async function previewCactiBinding(linkId, hostId, localDataId) {
  const inDs = document.getElementById(`cacti-in-${linkId}`)?.value || '';
  const outDs = document.getElementById(`cacti-out-${linkId}`)?.value || '';
  if (!inDs && !outDs) {
    setCactiPreview({message:'Selecciona Entrada o Salida para previsualizar.', inDs, outDs});
    return;
  }
  if (cactiCatalog.demo) {
    const base = Number(localDataId) % 100;
    setCactiPreview({
      message:'Valores demo para validar que elegiste los DS correctos.',
      inValue: inDs ? 180 + base + Math.random() * 60 : null,
      outValue: outDs ? 95 + base + Math.random() * 45 : null,
      inDs, outDs
    });
    return;
  }
  setCactiPreview({message:'Consultando última muestra recolectada…', inDs, outDs});
  try {
    const response = await fetchWithTimeout('/api/cacti/metrics', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
      bindings:[{linkId:`preview-${linkId}`, localDataId:Number(localDataId), inDs, outDs, multiplier:8}]
    })});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo consultar la vista previa');
    const metric = result.metrics?.[0] || {};
    if (metric.error) throw new Error(metric.error);
    setCactiPreview({
      message: metric.timestamp ? `Muestra: ${new Date(metric.timestamp * 1000).toLocaleString()}` : 'Última muestra recolectada.',
      inValue: bpsToLinkUnit(metric.inBps, 'Mbps'),
      outValue: bpsToLinkUnit(metric.outBps, 'Mbps'),
      inDs, outDs
    });
  } catch (error) {
    setCactiPreview({message:error.message || 'No hay datos recolectados para esta fuente.', inDs, outDs, error:true});
  }
}

async function loadCactiDevices(linkId) {
  const useModal = document.getElementById('cacti-binding-modal')?.classList.contains('open')
    && document.getElementById('cacti-binding-modal')?.dataset.linkId === linkId;
  const picker = useModal ? document.getElementById('cacti-modal-picker') : document.getElementById(`cacti-picker-${linkId}`);
  if (!picker) return;
  picker.innerHTML = cactiDisabledCatalogHtml(linkId);
  try {
    if (!cactiCatalog.devices) {
      try {
        const response = await fetch('/api/cacti/devices', {cache:'no-store'});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Cacti no disponible');
        cactiCatalog.devices = result.devices;
        cactiCatalog.demo = false;
        setCactiModalState('');
      } catch (error) {
        cactiCatalog.devices = cactiDemoCatalog.devices;
        cactiCatalog.demo = true;
        setCactiModalState('Modo demo: Cacti todavía no está conectado, usando catálogo de ejemplo.', 'connected');
      }
    }
    if (cactiCatalog.demo) {
      setCactiModalState('Modo demo: Cacti todavía no está conectado, usando catálogo de ejemplo.', 'connected');
    }
    const link = getLink(linkId);
    picker.innerHTML = `<div class="cacti-modal-grid">
      <label><span>Equipo</span><select class="prop-val" id="cacti-device-${linkId}" data-change="loadCactiGraphs" data-args='["${linkId}","$value"]'>
        <option value="">Selecciona un equipo…</option>${cactiCatalog.devices.map(device => `<option value="${device.id}" ${Number(link?.dataSource?.hostId)===device.id?'selected':''}>${escapeHtml(device.name)}${device.hostname ? ` · ${escapeHtml(device.hostname)}` : ''}</option>`).join('')}
      </select></label>
    </div><div id="cacti-graph-wrap-${linkId}">${cactiDisabledFlowHtml(linkId)}</div>`;
    if (link?.dataSource?.hostId) loadCactiGraphs(linkId, link.dataSource.hostId);
  } catch (error) {
    picker.innerHTML = `${cactiDisabledCatalogHtml(linkId, 'No se pudieron cargar equipos', 'Sin fuentes disponibles', 'Sin fuente disponible')}<span class="cacti-state error">⚠ ${escapeHtml(error.message || 'No se pudo consultar Cacti')}</span>`;
  }
}

async function loadCactiGraphs(linkId, rawHostId) {
  const hostId = Number(rawHostId), wrap = document.getElementById(`cacti-graph-wrap-${linkId}`);
  if (!wrap) return;
  if (!hostId) { wrap.innerHTML = cactiDisabledFlowHtml(linkId); return; }
  wrap.innerHTML = cactiDisabledFlowHtml(linkId, 'Cargando fuentes…', 'Primero selecciona una fuente…');
  try {
    if (!cactiCatalog.graphs.has(hostId)) {
      if (cactiCatalog.demo) {
        cactiCatalog.graphs.set(hostId, cactiDemoCatalog.graphs.get(hostId) || []);
      } else {
        const response = await fetch(`/api/cacti/devices/${hostId}/graphs`, {cache:'no-store'});
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las gráficas');
        cactiCatalog.graphs.set(hostId, result.graphs);
      }
    }
    const graphs = cactiCatalog.graphs.get(hostId), link = getLink(linkId);
    const sources = graphs.flatMap(graph => (graph.dataSources || []).map(source => ({
      ...source, graphId:graph.id, graphName:graph.name
    })));
    cactiCatalog.sources.set(hostId, sources);
    wrap.innerHTML = `<div id="cacti-source-wrap-${linkId}"><div class="cacti-modal-grid">
      <label><span>Fuente de la gráfica</span><select class="prop-val" id="cacti-source-${linkId}" ${sources.length ? '' : 'disabled'} data-change="renderCactiDsPicker" data-args='["${linkId}",${hostId},"$value",this.selectedOptions[0]?.dataset?.graphId]'>
          <option value="">${sources.length ? 'Selecciona una fuente…' : 'No hay fuentes disponibles'}</option>${sources.map(source => `<option value="${source.localDataId}" data-graph-id="${source.graphId || ''}" ${Number(link?.dataSource?.localDataId)===source.localDataId?'selected':''}>${escapeHtml(source.name)}${source.snmpIndex ? ` · ${escapeHtml(source.snmpIndex)}` : ''}</option>`).join('')}
        </select></label>
      </div><div id="cacti-ds-wrap-${linkId}">
        <div class="cacti-ds-grid">
          <label>Entrada<select class="prop-val" id="cacti-in-${linkId}" disabled><option>Selecciona una fuente…</option></select></label>
          <label>Salida<select class="prop-val" id="cacti-out-${linkId}" disabled><option>Selecciona una fuente…</option></select></label>
        </div>
        ${cactiPreviewHtml('Selecciona una fuente y sus DS para ver valores de muestra.')}
      </div></div>`;
    const selected = link?.dataSource?.localDataId || (sources.length === 1 ? sources[0].localDataId : null);
    if (selected) {
      const sourceSelect = document.getElementById(`cacti-source-${linkId}`);
      sourceSelect.value = String(selected);
      renderCactiDsPicker(linkId, hostId, selected, sourceSelect.selectedOptions[0]?.dataset?.graphId || null);
    }
  } catch (error) {
    wrap.innerHTML = `${cactiDisabledFlowHtml(linkId, 'No se pudieron cargar las fuentes', 'Sin fuente disponible')}<span class="cacti-state error">⚠ ${escapeHtml(error.message)}</span>`;
  }
}

function loadCactiGraphSources(linkId, hostId, rawGraphId) {
  const graphId = Number(rawGraphId), wrap = document.getElementById(`cacti-source-wrap-${linkId}`);
  const graph = (cactiCatalog.graphs.get(Number(hostId)) || []).find(item => item.id === graphId);
  if (!wrap || !graph) { if (wrap) wrap.innerHTML = ''; return; }
  cactiCatalog.sources.set(Number(hostId), graph.dataSources || []);
  const link = getLink(linkId);
  wrap.innerHTML = `<div class="cacti-modal-grid">
    <label><span>Fuente de la gráfica</span><select class="prop-val" id="cacti-source-${linkId}" data-change="renderCactiDsPicker" data-args='["${linkId}",${hostId},"$value",${graphId}]'>
        <option value="">Selecciona una fuente…</option>${graph.dataSources.map(source => `<option value="${source.localDataId}" ${Number(link?.dataSource?.localDataId)===source.localDataId?'selected':''}>${escapeHtml(source.name)}${source.snmpIndex ? ` · ${escapeHtml(source.snmpIndex)}` : ''}</option>`).join('')}
      </select></label>
    </div><div id="cacti-ds-wrap-${linkId}"></div>`;
  const selected = link?.dataSource?.graphId === graphId ? link.dataSource.localDataId : (graph.dataSources.length === 1 ? graph.dataSources[0].localDataId : null);
  if (selected) {
    document.getElementById(`cacti-source-${linkId}`).value = String(selected);
    renderCactiDsPicker(linkId, hostId, selected, graphId);
  }
}

async function loadCactiSources(linkId, rawHostId) {
  const hostId = Number(rawHostId), wrap = document.getElementById(`cacti-source-wrap-${linkId}`);
  if (!wrap || !hostId) { if (wrap) wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<span class="cacti-state">Buscando fuentes RRD…</span>';
  try {
    if (!cactiCatalog.sources.has(hostId)) {
      const response = await fetch(`/api/cacti/devices/${hostId}/data-sources`, {cache:'no-store'});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las fuentes');
      cactiCatalog.sources.set(hostId, result.dataSources);
    }
    const sources = cactiCatalog.sources.get(hostId), link = getLink(linkId);
    wrap.innerHTML = `<label class="prop-label" style="margin-top:8px">Interfaz / fuente</label>
      <select class="prop-val" id="cacti-source-${linkId}" data-change="renderCactiDsPicker" data-args='["${linkId}",${hostId},"$value"]'>
        <option value="">Selecciona una fuente…</option>${sources.map(source => `<option value="${source.localDataId}" ${Number(link?.dataSource?.localDataId)===source.localDataId?'selected':''}>${escapeHtml(source.name)}${source.snmpIndex ? ` · ${escapeHtml(source.snmpIndex)}` : ''}</option>`).join('')}
      </select><div id="cacti-ds-wrap-${linkId}"></div>`;
    if (link?.dataSource?.localDataId) renderCactiDsPicker(linkId, hostId, link.dataSource.localDataId);
  } catch (error) {
    wrap.innerHTML = `<span class="cacti-state error">⚠ ${escapeHtml(error.message)}</span>`;
  }
}

function renderCactiDsPicker(linkId, hostId, rawLocalDataId, graphId = null) {
  const localDataId = Number(rawLocalDataId), wrap = document.getElementById(`cacti-ds-wrap-${linkId}`);
  const source = (cactiCatalog.sources.get(Number(hostId)) || []).find(item => item.localDataId === localDataId);
  if (!wrap || !source) {
    if (wrap) wrap.innerHTML = `<div class="cacti-ds-grid">
      <label>Entrada<select class="prop-val" id="cacti-in-${linkId}" disabled><option>Selecciona una fuente…</option></select></label>
      <label>Salida<select class="prop-val" id="cacti-out-${linkId}" disabled><option>Selecciona una fuente…</option></select></label>
    </div>${cactiPreviewHtml('Selecciona una fuente y sus DS para ver valores de muestra.')}`;
    return;
  }
  const link = getLink(linkId), names = source.dataSourceNames;
  const guess = side => names.find(name => new RegExp(`(^|_)${side}($|_)`, 'i').test(name)) || '';
  const inDs = link?.dataSource?.localDataId === localDataId ? link.dataSource.inDs : guess('in');
  const outDs = link?.dataSource?.localDataId === localDataId ? link.dataSource.outDs : guess('out');
  const options = selected => `<option value="">Ninguna</option>${names.map(name => `<option value="${escapeHtml(name)}" ${name===selected?'selected':''}>${escapeHtml(name)}</option>`).join('')}`;
  wrap.innerHTML = `<div class="cacti-ds-grid"><label>Entrada<select class="prop-val" id="cacti-in-${linkId}" data-change="previewCactiBinding" data-args='["${linkId}",${hostId},${localDataId}]'>${options(inDs)}</select></label><label>Salida<select class="prop-val" id="cacti-out-${linkId}" data-change="previewCactiBinding" data-args='["${linkId}",${hostId},${localDataId}]'>${options(outDs)}</select></label></div>
    ${cactiPreviewHtml('Calculando vista previa…')}`;
  previewCactiBinding(linkId, hostId, localDataId);
}

async function applyCactiBinding(linkId, hostId, localDataId, graphId = null) {
  const link = getLink(linkId);
  const device = (cactiCatalog.devices || []).find(item => item.id === Number(hostId));
  const source = (cactiCatalog.sources.get(Number(hostId)) || []).find(item => item.localDataId === Number(localDataId));
  const graph = (cactiCatalog.graphs.get(Number(hostId)) || []).find(item => item.id === Number(graphId));
  if (!link || !source) return;
  link.dataSource = { provider:'cacti', hostId:Number(hostId), localDataId:Number(localDataId),
    deviceName:device?.name || '', graphId:graph?.id || source.graphId || null, graphName:graph?.name || source.graphName || '', sourceName:source.name,
    inDs:document.getElementById(`cacti-in-${linkId}`)?.value || '', outDs:document.getElementById(`cacti-out-${linkId}`)?.value || '',
    multiplier:8, capacityBps:Number(source.capacityBps) > 0 ? Number(source.capacityBps) : null };
  if (Number(source.capacityBps) > 0) {
    link.capacity = bpsToLinkUnit(Number(source.capacityBps), link.capacityUnit || 'Mbps');
  }
  link.telemetryError = null; pushHistory(); updatePropsPanel();
  closeCactiBindingModal();
  if (cactiCatalog.demo) {
    link.inUsage = 420 + Math.round(Math.random() * 180);
    link.outUsage = 260 + Math.round(Math.random() * 160);
    const cap = Math.max(1, Number(link.capacity) || 1000);
    link.inPct = Math.round((link.inUsage / cap) * 100);
    link.outPct = Math.round((link.outUsage / cap) * 100);
    link.telemetryTimestamp = Math.floor(Date.now() / 1000);
    renderLinks();
    showToast('Fuente demo vinculada. Cuando Cacti esté activo usará datos reales.', 'success');
    return;
  }
  await testCactiBinding(linkId);
}

function clearCactiBinding(linkId) {
  const link = getLink(linkId); if (!link) return;
  link.dataSource = null; link.telemetryError = null; link.telemetryTimestamp = null;
  pushHistory(); updatePropsPanel(); renderLinks();
}

function bpsToLinkUnit(bps, unit) {
  const factors = {Kbps:1e3, Mbps:1e6, Gbps:1e9, Tbps:1e12};
  return bps == null ? null : bps / (factors[unit] || 1e6);
}

async function refreshCactiMetrics(date = null, onlyLinkId = null) {
  const bound = links.filter(link => link.dataSource?.provider === 'cacti' && (!onlyLinkId || link.id === onlyLinkId));
  if (!bound.length) return {updated:0, errors:0};
  const response = await fetchWithTimeout('/api/cacti/metrics', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
    ...(date ? {date} : {}), bindings:bound.map(link => ({linkId:link.id, localDataId:link.dataSource.localDataId,
      inDs:link.dataSource.inDs, outDs:link.dataSource.outDs, multiplier:link.dataSource.multiplier}))
  })});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudieron consultar las métricas');
  let updated = 0, errors = 0;
  result.metrics.forEach(metric => {
    const link = getLink(metric.linkId); if (!link) return;
    link.telemetryError = metric.error || null;
    if (metric.error) { errors++; return; }
    link.telemetryTimestamp = metric.timestamp;
    const inUsage = bpsToLinkUnit(metric.inBps, link.capacityUnit), outUsage = bpsToLinkUnit(metric.outBps, link.capacityUnit);
    if (inUsage != null) link.inUsage = inUsage;
    if (outUsage != null) link.outUsage = outUsage;
    link.inPct = Math.round((link.inUsage || 0) / Math.max(.01, link.capacity) * 1000) / 10;
    link.outPct = Math.round((link.outUsage || 0) / Math.max(.01, link.capacity) * 1000) / 10;
    updated++;
  });
  renderLinks();
  if (selectedLinkId && (!onlyLinkId || selectedLinkId === onlyLinkId)) updatePropsPanel();
  return {updated, errors};
}

async function testCactiBinding(linkId) {
  setStatus('Consultando métricas recolectadas…');
  try {
    const result = await refreshCactiMetrics(null, linkId);
    setStatus(result.errors ? '⚠ El colector aún no ha guardado datos' : '✓ Fuente Cacti conectada');
  } catch (error) {
    const link = getLink(linkId); if (link) link.telemetryError = error.message;
    updatePropsPanel(); setStatus('⚠ No se pudieron consultar las métricas');
  }
}
