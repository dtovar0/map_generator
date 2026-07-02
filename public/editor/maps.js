// ════════════════════════════════════════════════════
// MAP ACTIONS
// ════════════════════════════════════════════════════
async function newMap() {
  const ok = await showConfirm('Se perderán todos los cambios no guardados.', 'Nuevo mapa', 'Crear nuevo');
  if (!ok) return;
  cancelPlacing(); cancelLink();
  destroyAllCharts();
  nodes.forEach(n => document.getElementById(n.id)?.remove());
  nodes=[]; links=[]; nodeCounter=0; linkCounter=0;
  rememberCurrentServerMap(null, '');
  selectedMapDate = localToday();
  document.getElementById('presentation-date').value = selectedMapDate;
  zoom = 1; panX = 0; panY = 0; applyTransform();
  clearSelection(); renderLinks(); updateHint(); updateCounter();
  history = [getSnapshot()]; historyIdx = 0; updateUndoBtns();
  clearLocalDraft();
  showPropsPanel();
  hideRightPanel();
  setStatus('Nuevo mapa');
  showToast('Nuevo mapa creado', 'success');
}
function rememberCurrentServerMap(id, name, date = selectedMapDate) {
  currentServerMapId = id || null;
  currentServerMapName = name || '';
  if (currentServerMapId) {
    lsSet('mapgen_current_server_id', currentServerMapId);
    lsSet('mapgen_current_server_name', currentServerMapName);
    lsSet('mapgen_current_server_date', date);
  } else {
    lsRemove('mapgen_current_server_id');
    lsRemove('mapgen_current_server_name');
    lsRemove('mapgen_current_server_date');
  }
}

async function saveMap() {
  let name = currentServerMapName;
  if (!currentServerMapId) {
    name = await showPrompt('Nombre del mapa', name || 'Mi mapa');
    if (!name) { setStatus('Guardado cancelado'); return; }
  }
  try {
    showToast('Guardando…', 'info');
    setStatus('Guardando mapa en el servidor…');
    const response = await fetch('/api/maps', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:currentServerMapId, name, date:selectedMapDate, snapshot:getSnapshot()})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
    rememberCurrentServerMap(result.map.id, result.map.name, selectedMapDate);
    saveLocalDraft(true);
    document.body.classList.remove('presentation-date-empty');
    setStatus(`✓ ${result.map.name} guardado para ${selectedMapDate}`);
    showToast(`✓ ${result.map.name} guardado`, 'success');
  } catch (err) {
    console.error(err); setStatus('⚠ No se pudo guardar el mapa en el servidor');
    showToast('Error al guardar', 'error');
  }
}

async function saveMapAs() {
  const name = await showPrompt('Guardar como', currentServerMapName || 'Mi mapa');
  if (!name) { setStatus('Guardado cancelado'); return; }
  try {
    showToast('Guardando…', 'info');
    setStatus('Guardando mapa en el servidor…');
    const response = await fetch('/api/maps', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id: null, name, date: selectedMapDate, snapshot: getSnapshot()})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar');
    rememberCurrentServerMap(result.map.id, result.map.name, selectedMapDate);
    saveLocalDraft(true);
    document.body.classList.remove('presentation-date-empty');
    setStatus(`✓ ${result.map.name} guardado como nuevo mapa`);
    showToast(`✓ ${result.map.name} guardado`, 'success');
  } catch (err) {
    console.error(err); setStatus('⚠ No se pudo guardar el mapa en el servidor');
    showToast('Error al guardar', 'error');
  }
}

async function selectPresentationDate(date, autoRefresh = false) {
  const liveRequest = autoRefresh && presentationViewMode === 'live';
  if (!liveRequest && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const focusedNodeId = autoRefresh ? document.querySelector('.node.presentation-focused')?.id : null;
  const focusedLinkId = autoRefresh ? document.querySelector('.link-group.presentation-focused')?.dataset.linkId : null;
  if (!liveRequest) {
    selectedMapDate = date;
    lsSet('mapgen_current_server_date', selectedMapDate);
  }
  if (!autoRefresh) hidePresentationInfo();
  if (!currentServerMapId) {
    if (!autoRefresh) {
      document.body.classList.add('presentation-date-empty');
      setStatus('Selecciona primero un mapa del servidor');
    }
    return;
  }
  try {
    const query = liveRequest ? '' : `?date=${encodeURIComponent(date)}`;
    const response = await fetch(`/api/maps/${encodeURIComponent(currentServerMapId)}${query}`, {cache:'no-store'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Sin información');
    document.body.classList.remove('presentation-date-empty');
    applySnapshot(result.snapshot);
    const telemetry = await refreshCactiMetrics(liveRequest ? null : date).catch(error => {
      console.error('Cacti telemetry:', error);
      return {updated:0, errors:1};
    });
    if (liveRequest && result.date) {
      selectedMapDate = result.date;
      lsSet('mapgen_current_server_date', selectedMapDate);
      document.getElementById('presentation-date').value = selectedMapDate;
    }
    history = [getSnapshot()]; historyIdx = 0; updateUndoBtns();
    saveLocalDraft(true);
    if (focusedNodeId && nodes.some(n => n.id === focusedNodeId)) showPresentationNodeInfo(focusedNodeId);
    else if (focusedLinkId && links.some(l => l.id === focusedLinkId)) showPresentationLinkInfo(focusedLinkId);
    const refreshedAt = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const telemetryNote = telemetry.updated ? ` · ${telemetry.updated} RRD` : telemetry.errors ? ' · Cacti sin datos' : '';
    setStatus(autoRefresh ? `✓ Live actualizado · ${refreshedAt}${telemetryNote}` : `Mostrando ${result.map.name} · ${date}${telemetryNote}`);
    if (!autoRefresh && presentationMode) schedulePresentationRefresh();
  } catch (err) {
    console.error(err);
    if (autoRefresh) setStatus('⚠ No se pudo completar el auto refresco');
    else {
      document.body.classList.add('presentation-date-empty');
      setStatus(`Sin información en el servidor para ${date}`);
    }
  }
}


async function openMapModal() {
  const modal = document.getElementById('map-modal');
  const grid = document.getElementById('map-modal-grid');
  const searchEl = document.getElementById('map-modal-search');
  if (searchEl) searchEl.value = '';
  modal.classList.add('open');
  grid.innerHTML = '<p class="prop-empty" style="padding:24px;text-align:center;grid-column:1/-1">Cargando mapas…</p>';
  try {
    const res = await fetch('/api/maps', {cache:'no-store'});
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error');
    const maps = result.maps;
    if (!maps.length) {
      grid.innerHTML = '<p class="prop-empty" style="padding:24px;text-align:center;grid-column:1/-1">No hay mapas guardados en el servidor.</p>';
      return;
    }
    grid.innerHTML = maps.map(map => `
      <div class="map-card" data-id="${map.id}" data-name="${escapeHtml(map.name.toLowerCase())}" data-click="openServerMapAndClose" data-args='["${map.id}"]'>
        <canvas class="map-card-canvas" id="mpcv-${map.id}" width="280" height="160"></canvas>
        <div class="map-card-body">
          <strong>${escapeHtml(map.name)}</strong>
          <span>${new Date(map.updatedAt).toLocaleDateString()} · ${map.dates.length} fecha(s)</span>
        </div>
      </div>`).join('');
    maps.forEach(async map => {
      try {
        const r = await fetch(`/api/maps/${encodeURIComponent(map.id)}`, {cache:'no-store'});
        const data = await r.json();
        if (!r.ok) return;
        const cv = document.getElementById(`mpcv-${map.id}`);
        if (cv) renderMapPreview(data.snapshot, cv);
      } catch(e) { /* preview silently fails */ }
    });
  } catch(err) {
    console.error(err);
    grid.innerHTML = '<p class="prop-empty" style="padding:24px;text-align:center;grid-column:1/-1">No se pudo consultar el servidor.</p>';
  }
}

function closeMapModal() {
  document.getElementById('map-modal').classList.remove('open');
}

function filterMapModal(query) {
  const q = query.toLowerCase().trim();
  document.querySelectorAll('#map-modal-grid .map-card').forEach(card => {
    card.style.display = (!q || card.dataset.name.includes(q)) ? '' : 'none';
  });
}

function renderMapPreview(snapshot, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const dark = activeTheme !== 'light';
  ctx.fillStyle = dark ? '#0C1520' : '#EDF2F7';
  ctx.fillRect(0, 0, W, H);
  const allNodes = (snapshot.nodes || []);
  if (!allNodes.length) {
    ctx.fillStyle = dark ? '#3D6080' : '#94A3B8';
    ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Sin nodos', W / 2, H / 2);
    return;
  }
  // n.x / n.y son coordenadas del CENTRO (el nodo usa transform: translate(-50%,-50%))
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  allNodes.forEach(n => {
    const hw = (n.w || 80) / 2, hh = (n.h || 40) / 2;
    minX = Math.min(minX, n.x - hw); minY = Math.min(minY, n.y - hh);
    maxX = Math.max(maxX, n.x + hw); maxY = Math.max(maxY, n.y + hh);
  });
  const PAD = 14;
  const bw = maxX - minX || 1, bh = maxY - minY || 1;
  const scale = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh);
  const ox = PAD + ((W - PAD * 2) - bw * scale) / 2;
  const oy = PAD + ((H - PAD * 2) - bh * scale) / 2;
  const tx = x => ox + (x - minX) * scale;
  const ty = y => oy + (y - minY) * scale;
  // Dibujar enlaces — n.x/n.y son centros, conectar centro a centro
  ctx.strokeStyle = dark ? 'rgba(82,112,144,0.75)' : 'rgba(100,116,139,0.65)';
  ctx.lineWidth = Math.max(1.5, scale * 1.5);
  (snapshot.links || []).forEach(link => {
    const f = allNodes.find(n => n.id === link.from);
    const t = allNodes.find(n => n.id === link.to);
    if (!f || !t) return;
    ctx.beginPath();
    ctx.moveTo(tx(f.x), ty(f.y));
    ctx.lineTo(tx(t.x), ty(t.y));
    ctx.stroke();
  });
  // Dibujar nodos — centro en n.x/n.y, dibujar desde esquina superior-izquierda
  allNodes.forEach(n => {
    const cx = tx(n.x), cy = ty(n.y);
    const w = Math.max((n.w || 80) * scale, 4), h = Math.max((n.h || 40) * scale, 3);
    ctx.fillStyle = n.color || '#0DBFA6';
    ctx.beginPath();
    const r = Math.min(3, w / 4, h / 4);
    if (ctx.roundRect) { ctx.roundRect(cx - w / 2, cy - h / 2, w, h, r); }
    else { ctx.rect(cx - w / 2, cy - h / 2, w, h); }
    ctx.fill();
  });
}

async function openServerMap(id, requestedDate = null) {
  try {
    setStatus('Abriendo mapa del servidor…');
    const query = requestedDate ? `?date=${encodeURIComponent(requestedDate)}` : '';
    let response = await fetch(`/api/maps/${encodeURIComponent(id)}${query}`, {cache:'no-store'});
    if (!response.ok && requestedDate) response = await fetch(`/api/maps/${encodeURIComponent(id)}`, {cache:'no-store'});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo abrir');
    cancelPlacing(); cancelLink();
    applySnapshot(result.snapshot);
    await refreshCactiMetrics().catch(error => console.error('Cacti telemetry:', error));
    rememberCurrentServerMap(result.map.id, result.map.name, result.date);
    selectedMapDate = result.date;
    document.getElementById('presentation-date').value = selectedMapDate;
    document.body.classList.remove('presentation-date-empty');
    history = [getSnapshot()]; historyIdx = 0; updateUndoBtns();
    saveLocalDraft(true);
    closeMapModal();
    setStatus(`✓ ${result.map.name} abierto · ${result.date}`);
    showToast(`✓ ${result.map.name} cargado`, 'success');
  } catch (err) {
    console.error(err); setStatus('⚠ No se pudo abrir el mapa del servidor');
    showToast('Error al cargar el mapa', 'error');
  }
}
function openMapPicker() {
  const input = document.getElementById('map-file-input');
  input.value = '';
  input.click();
}
async function importMapFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const saved = JSON.parse(await file.text());
    if (!saved || !Array.isArray(saved.nodes) || !Array.isArray(saved.links))
      throw new Error('Formato de mapa inválido');
    const ok = await showConfirm(`Se reemplazará el mapa actual con "${file.name}".`, 'Importar mapa', 'Importar');
    if (!ok) return;
    cancelPlacing(); cancelLink();
    applySnapshot(saved);
    history = [getSnapshot()]; historyIdx = 0; updateUndoBtns();
    rememberCurrentServerMap(null, '');
    saveLocalDraft(true);
    document.body.classList.remove('presentation-date-empty');
    setStatus(`✓ ${file.name} importado · pulsa Guardar para enviarlo al servidor`);
    showToast(`✓ ${file.name} cargado`, 'success');
  } catch (err) {
    console.error(err);
    setStatus('⚠ El archivo seleccionado no es un mapa válido');
  } finally {
    input.value = '';
  }
}
function exportMap() {
  const a=document.createElement('a');
  const url=URL.createObjectURL(new Blob([JSON.stringify(getSnapshot(),null,2)],{type:'application/json'}));
  a.href=url; a.download='mapa.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setStatus('Exportado');
  showToast('✓ mapa.json exportado', 'success');
}
async function capturePresentationImage() {
  if (document.body.classList.contains('presentation-date-empty')) {
    setStatus('No hay información para exportar en esta fecha');
    return null;
  }
  if (!window.htmlToImage) {
    setStatus('⚠ El exportador de imágenes no está disponible');
    return null;
  }
  const wrap = document.getElementById('canvas-wrap');
  const info = document.getElementById('presentation-info');
  const previousInfoDisplay = info.style.display;
  const focused = [...document.querySelectorAll('.presentation-focused')];
  info.style.display = 'none';
  focused.forEach(el => el.classList.remove('presentation-focused'));
  try {
    await document.fonts?.ready;
    return await window.htmlToImage.toPng(wrap, {
      backgroundColor:'#070C13', pixelRatio:2, cacheBust:true,
      width:wrap.clientWidth, height:wrap.clientHeight
    });
  } finally {
    info.style.display = previousInfoDisplay;
    focused.forEach(el => el.classList.add('presentation-focused'));
  }
}
async function exportMapImage() {
  try {
    setStatus('Generando imagen…');
    const dataUrl = await capturePresentationImage(); if (!dataUrl) return;
    const anchor = document.createElement('a');
    anchor.href = dataUrl; anchor.download = `mapa-${selectedMapDate}.png`; anchor.click();
    setStatus(`✓ Imagen exportada: ${selectedMapDate}`);
  } catch (err) {
    console.error(err); setStatus('⚠ No se pudo exportar la imagen');
  }
}
async function exportMapPdf() {
  try {
    if (!window.jsPDF) throw new Error('jsPDF no disponible');
    setStatus('Generando PDF…');
    const dataUrl = await capturePresentationImage(); if (!dataUrl) return;
    const wrap = document.getElementById('canvas-wrap');
    const width = wrap.clientWidth, height = wrap.clientHeight;
    const pdf = new window.jsPDF({
      orientation: width >= height ? 'landscape' : 'portrait',
      unit:'px', format:[width, height], hotfixes:['px_scaling']
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`mapa-${selectedMapDate}.pdf`);
    setStatus(`✓ PDF exportado: ${selectedMapDate}`);
  } catch (err) {
    console.error(err); setStatus('⚠ No se pudo exportar el PDF');
  }
}
function autoLayout() {
  if(!nodes.length) return;
  const beforeLayout = getSnapshot();
  const cols=Math.ceil(Math.sqrt(nodes.length));
  nodes.forEach((n,i) => { n.x=snap(100+(i%cols)*160); n.y=snap(100+Math.floor(i/cols)*140); renderNode(n); });
  nodes.forEach(n => distributePortLinks(n.id));
  renderLinks();
  if (!revertIfLinksOverlap(beforeLayout)) {
    pushHistory();
    setStatus('Auto-layout aplicado');
  }
}

// ════════════════════════════════════════════════════
// DEMO
// ════════════════════════════════════════════════════
function loadDemo() {
  [
    {type:'router',   icon:'🔷', label:'R-Core',  x:400, y:360},
    {type:'switch',   icon:'🔲', label:'SW-Dist', x:220, y:510},
    {type:'switch',   icon:'🔲', label:'SW-Acc',  x:580, y:510},
    {type:'firewall', icon:'🛡️', label:'FW-Edge', x:400, y:210},
    {type:'server',   icon:'🖥️', label:'SRV-01',  x:100, y:660},
    {type:'server',   icon:'🖥️', label:'SRV-02',  x:300, y:660},
    {type:'cloud',    icon:'☁️', label:'ISP',     x:400, y:60 },
    {type:'ap',       icon:'📡', label:'AP-01',   x:620, y:660},
  ].forEach(d => {
    nodeCounter++;
    nodes.push({ id:'n'+nodeCounter, ...d, name:d.label+'-'+nodeCounter,
      w:generalConfig.nodeWidth, h:generalConfig.nodeHeight,
      image:null, nameInside:true, hideName:false, textRotation:0, linkPadding:generalConfig.linkPadding,
      ...getGeneralNodeAppearance(d.type),
      sizeOverride:false, linkPaddingOverride:false, appearanceOverride:false,
      inPct:Math.floor(Math.random()*100), outPct:Math.floor(Math.random()*100) });
    renderNode(nodes[nodes.length-1]);
  });
  [[0,3],[3,6],[0,1],[0,2],[1,4],[1,5],[2,7]].forEach(([fi,ti]) => {
    linkCounter++;
    links.push({ id:'l'+linkCounter, from:'n'+(fi+1), to:'n'+(ti+1),
      fromPort:'center', fromOffset:0, toPort:'center', toOffset:0, waypoints:[],
      fromPortLocked:false, toPortLocked:false,
      description:'', width:generalConfig.linkWidth,
      midTermination:generalConfig.midTermination,
      dividerPosition:generalConfig.dividerPosition,
      dividerPositionOverride:false, styleOverride:false,
      scaleOverride:false, scale:null,
      capacity:100, capacityUnit:'Mbps', inUsage:0, outUsage:0,
      editorInPct:Math.floor(Math.random()*100), editorOutPct:Math.floor(Math.random()*100),
      usageLabelInPosition:50, usageLabelOutPosition:50,
      usageLabelPosition:generalConfig.usageLabelPosition,
      usageLabelRotate:generalConfig.usageLabelRotate,
      usageLabelFlip:generalConfig.usageLabelFlip,
      usageLabelFormat:generalConfig.usageLabelFormat, usageLabelOverride:false,
      capacityLabelVisible:generalConfig.capacityLabelVisible,
      capacityLabelSide:generalConfig.capacityLabelSide,
      capacityLabelRotate:generalConfig.capacityLabelRotate, capacityLabelFlip:generalConfig.capacityLabelFlip,
      capacityLabelFontSize:generalConfig.capacityLabelFontSize,
      capacityLabelOverride:false,
      routeLane:0,
      inPct:0, outPct:0 });
  });
  // Distribute ports on all nodes after links are created
  nodes.forEach(n => distributePortLinks(n.id));
  renderLinks(); updateHint(); updateCounter();
  setStatus('Demo listo  ·  Clic en paleta para colocar  ·  Selecciona nodo para redimensionar');
}

// ════════════════════════════════════════════════════
// SEARCH / FIND  (Ctrl+F)
// ════════════════════════════════════════════════════
let _searchResults = [], _searchIdx = -1;

function openSearch() {
  const bar = document.getElementById('search-bar');
  bar.classList.add('open');
  const inp = document.getElementById('search-input');
  inp.focus();
  inp.select();
  doSearch(inp.value);
}

function closeSearch() {
  document.getElementById('search-bar').classList.remove('open');
  document.getElementById('search-input').value = '';
  _clearSearchHighlights();
  _searchResults = []; _searchIdx = -1;
  _updateSearchCount();
}

function _clearSearchHighlights() {
  document.querySelectorAll('.node.search-match,.node.search-current').forEach(el => {
    el.classList.remove('search-match', 'search-current');
  });
}

function doSearch(query) {
  _clearSearchHighlights();
  _searchResults = [];
  _searchIdx = -1;
  const q = (query || '').trim().toLowerCase();
  if (!q) { _updateSearchCount(); return; }
  nodes.forEach(n => {
    const text = ((n.name || '') + ' ' + (n.label || '')).toLowerCase();
    if (text.includes(q)) {
      _searchResults.push(n.id);
      document.getElementById(n.id)?.classList.add('search-match');
    }
  });
  if (_searchResults.length > 0) {
    _searchIdx = 0;
    _highlightCurrentSearch();
  }
  _updateSearchCount();
}

function _highlightCurrentSearch() {
  document.querySelectorAll('.node.search-current').forEach(el => el.classList.remove('search-current'));
  if (_searchIdx < 0 || _searchIdx >= _searchResults.length) return;
  const id = _searchResults[_searchIdx];
  document.getElementById(id)?.classList.add('search-current');
  const n = getNode(id);
  if (n) {
    const wrap = document.getElementById('canvas-wrap');
    panX = wrap.clientWidth  / 2 - (n.x + (n.w || 120) / 2) * zoom;
    panY = wrap.clientHeight / 2 - (n.y + (n.h || 120) / 2) * zoom;
    applyTransform();
  }
}

function navigateSearch(dir) {
  if (_searchResults.length === 0) return;
  _searchIdx = (_searchIdx + dir + _searchResults.length) % _searchResults.length;
  _highlightCurrentSearch();
  _updateSearchCount();
}

function handleSearchKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
  if (e.key === 'Enter') { e.preventDefault(); navigateSearch(e.shiftKey ? -1 : 1); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); navigateSearch(1); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); navigateSearch(-1); }
}

function _updateSearchCount() {
  const el = document.getElementById('search-count');
  if (!el) return;
  const q = (document.getElementById('search-input')?.value || '').trim();
  if (!q) { el.textContent = ''; return; }
  el.textContent = _searchResults.length === 0 ? '0/0' : `${_searchIdx + 1}/${_searchResults.length}`;
}

// ════════════════════════════════════════════════════
// THEMES
// ════════════════════════════════════════════════════
const THEMES = {
  'dark': {
    name: 'Oscuro',
    preview: ['#070C13','#0DBFA6','#0C1520','#F09A38'],
    vars: {
      '--bg':'#070C13','--surface':'#0C1520','--surface2':'#101E30','--surface3':'#172438',
      '--border':'#1B2E46','--border-hi':'#274565',
      '--accent':'#0DBFA6','--accent-lo':'#094F44',
      '--warm':'#F09A38',
      '--text':'#C2D4E8','--text2':'#527090','--text3':'#3D6080',
      '--ok':'#28C97A','--danger':'#E86060',
      '--grid-dot':'#1E3A5820','--grid-line':'#1E3A5818'
    }
  },
  'light': {
    name: 'Claro',
    preview: ['#EDF2F7','#0891B2','#FFFFFF','#D97706'],
    vars: {
      '--bg':'#E8EFF6','--surface':'#FFFFFF','--surface2':'#F0F4F8','--surface3':'#E2EAF2',
      '--border':'#CBD5E1','--border-hi':'#94A3B8',
      '--accent':'#0891B2','--accent-lo':'#BAE6FD',
      '--warm':'#D97706',
      '--text':'#1E293B','--text2':'#475569','--text3':'#64748B',
      '--ok':'#16A34A','--danger':'#DC2626',
      '--grid-dot':'rgba(0,0,0,0.10)','--grid-line':'rgba(0,0,0,0.06)'
    }
  }
};

const LEGACY_THEME_MAP = {'dark-teal':'dark','dark-purple':'dark','dark-blue':'dark','dark-amber':'dark'};
const _storedTheme = lsGet('mapgen_theme') || 'dark';
let activeTheme = THEMES[_storedTheme] ? _storedTheme : (LEGACY_THEME_MAP[_storedTheme] || 'dark');

function applyTheme(name) {
  const theme = THEMES[name];
  if (!theme) return;
  activeTheme = name;
  const root = document.documentElement;
  root.dataset.theme = name;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  lsSet('mapgen_theme', name);
  document.getElementById('tool-theme')?.classList.remove('active');
}

function toggleTheme() {
  applyTheme(activeTheme === 'dark' ? 'light' : 'dark');
  saveLocalDraft();
  setStatus(`Tema: ${THEMES[activeTheme].name}`);
}
