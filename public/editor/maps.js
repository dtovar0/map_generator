// ════════════════════════════════════════════════════
// MAP ACTIONS
// ════════════════════════════════════════════════════
async function newMap() {
  const name = await showPrompt('Nombre del nuevo mapa', 'Mi mapa');
  if (!name?.trim()) { setStatus('Creación de mapa cancelada'); return; }
  cancelPlacing(); cancelLink();
  destroyAllCharts();
  nodes.forEach(n => document.getElementById(n.id)?.remove());
  nodes=[]; links=[]; nodeCounter=0; linkCounter=0;
  rememberCurrentServerMap(null, name.trim());
  selectedMapDate = localToday();
  document.getElementById('presentation-date').value = selectedMapDate;
  zoom = 1; panX = 0; panY = 0; applyTransform();
  clearSelection(); renderLinks(); updateHint(); updateCounter();
  history = [getSnapshot()]; historyIdx = 0; updateUndoBtns();
  clearLocalDraft();
  showPropsPanel();
  hideRightPanel();
  setStatus(`Nuevo mapa: ${name.trim()}`);
  showToast(`Mapa “${name.trim()}” creado`, 'success');
}

async function clearCanvas() {
  const total = nodes.length + links.length;
  if (!total) {
    showToast('El canvas ya está vacío.', 'info');
    return;
  }
  const ok = await showConfirm(
    `Se eliminarán ${total} elemento${total === 1 ? '' : 's'} del canvas. Podrás deshacer esta acción.`,
    'Limpiar canvas',
    'Limpiar canvas'
  );
  if (!ok) return;
  cancelPlacing(); cancelLink(); destroyAllCharts();
  nodes.forEach(node => document.getElementById(node.id)?.remove());
  nodes = []; links = []; nodeCounter = 0; linkCounter = 0;
  clearSelection(); renderLinks(); updateHint(); updateCounter();
  pushHistory();
  setStatus('Canvas limpio');
  showToast(`${total} elemento${total === 1 ? '' : 's'} eliminado${total === 1 ? '' : 's'} del canvas.`, 'success');
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
  const name = currentServerMapName;
  if (!name) {
    setStatus('No hay un mapa activo para guardar');
    showToast('Crea un mapa nuevo o usa Guardar como', 'info');
    return;
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


let mapModalMaps = [];
let mapModalQuery = '';
let mapModalPage = 0;
const MAP_MODAL_PAGE_SIZE = 8;

function mapModalGhosts() {
  return Array.from({length:MAP_MODAL_PAGE_SIZE}, () => `<div class="map-card map-card-ghost" aria-hidden="true"><div class="ghost-preview"></div><div class="map-card-body"><i></i><i></i></div></div>`).join('');
}

function renderMapModalPage() {
  const grid = document.getElementById('map-modal-grid');
  const pagination = document.getElementById('map-modal-pagination');
  const filtered = mapModalMaps.filter(map => !mapModalQuery || map.name.toLowerCase().includes(mapModalQuery));
  const pages = Math.max(1, Math.ceil(filtered.length / MAP_MODAL_PAGE_SIZE));
  mapModalPage = Math.min(mapModalPage, pages - 1);
  const pageMaps = filtered.slice(mapModalPage * MAP_MODAL_PAGE_SIZE, (mapModalPage + 1) * MAP_MODAL_PAGE_SIZE);
  grid.classList.remove('loading'); grid.setAttribute('aria-busy', 'false');
  if (!pageMaps.length) {
    grid.innerHTML = `<div class="map-modal-empty"><strong>${mapModalQuery ? 'Sin coincidencias' : 'No hay mapas guardados'}</strong><span>${mapModalQuery ? 'Prueba con otro nombre.' : 'Importa un JSON o guarda tu primer mapa.'}</span></div>`;
  } else {
    grid.innerHTML = pageMaps.map(map => `
      <div class="map-card" data-id="${map.id}" data-name="${escapeHtml(map.name.toLowerCase())}" data-click="openServerMapAndClose" data-args='["${map.id}"]'>
        <canvas class="map-card-canvas" id="mpcv-${map.id}" width="280" height="160"></canvas>
        <div class="map-card-body"><strong>${escapeHtml(map.name)}</strong><span>${new Date(map.updatedAt).toLocaleDateString()} · ${map.dates.length} fecha(s)</span></div>
      </div>`).join('');
    pageMaps.forEach(async map => {
      try {
        const r = await fetch(`/api/maps/${encodeURIComponent(map.id)}`, {cache:'no-store'});
        const data = await r.json(); if (!r.ok) return;
        const cv = document.getElementById(`mpcv-${map.id}`); if (cv) renderMapPreview(data.snapshot, cv);
      } catch(e) { /* preview silently fails */ }
    });
  }
  pagination.innerHTML = pages > 1 ? Array.from({length:pages}, (_, index) => `<button class="map-page-dot ${index===mapModalPage?'active':''}" data-click="setMapModalPage" data-args='[${index}]' aria-label="Página ${index+1}" aria-current="${index===mapModalPage?'page':'false'}"></button>`).join('') : '';
}

function setMapModalPage(page) { mapModalPage = Math.max(0, Number(page) || 0); renderMapModalPage(); }

async function openMapModal() {
  const modal = document.getElementById('map-modal');
  const grid = document.getElementById('map-modal-grid');
  const searchEl = document.getElementById('map-modal-search');
  if (searchEl) { searchEl.value = ''; searchEl.disabled = true; }
  mapModalMaps = [];
  mapModalQuery = ''; mapModalPage = 0;
  modal.classList.add('open');
  document.getElementById('map-modal-pagination').innerHTML = '';
  grid.classList.add('loading'); grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = `<div class="map-loader"><span></span><strong>Cargando mapas</strong></div>${mapModalGhosts()}`;
  try {
    const res = await fetch('/api/maps', {cache:'no-store'});
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error');
    mapModalMaps = result.maps || [];
    if (searchEl) searchEl.disabled = false;
    renderMapModalPage();
  } catch(err) {
    console.error(err);
    grid.classList.remove('loading'); grid.setAttribute('aria-busy', 'false');
    if (searchEl) searchEl.disabled = false;
    grid.innerHTML = '<div class="map-modal-empty"><strong>No se pudo consultar el servidor</strong><span>Inténtalo nuevamente en unos momentos.</span></div>';
  }
}

function closeMapModal() {
  document.getElementById('map-modal').classList.remove('open');
}

function filterMapModal(query) {
  mapModalQuery = query.toLowerCase().trim(); mapModalPage = 0; renderMapModalPage();
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
    ctx.fillStyle = n.color || '#7C5CFF';
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
      backgroundColor:'#0A0912', pixelRatio:2, cacheBust:true,
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
    showToast('Imagen PNG exportada.', 'success');
  } catch (err) {
    console.error(err); setStatus('⚠ No se pudo exportar la imagen');
    showToast('No se pudo exportar la imagen.', 'error');
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
    showToast('Documento PDF exportado.', 'success');
  } catch (err) {
    console.error(err); setStatus('⚠ No se pudo exportar el PDF');
    showToast('No se pudo exportar el PDF.', 'error');
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
    showToast('Distribución automática aplicada.', 'success');
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
      appearanceThemes:{}, sizeOverride:false, linkPaddingOverride:false, appearanceOverride:false,
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
      scaleOverride:false, scale:null, scaleThemes:{},
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
      routeLane:0, routeStyle: generalConfig.routeStyle === 'free' ? 'free' : 'ortho',
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
    // n.x / n.y ARE the node's center (nodes render with translate(-50%,-50%)).
    const wrap = document.getElementById('canvas-wrap');
    panX = wrap.clientWidth  / 2 - n.x * zoom;
    panY = wrap.clientHeight / 2 - n.y * zoom;
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
    preview: ['#0A0912','#7C5CFF','#22D3EE','#FFB020'],
    vars: {
      '--bg':'#0A0912','--surface':'#12111E','--surface2':'#1A1829','--surface3':'#232038',
      '--border':'#2A2740','--border-hi':'#3E3A5E',
      '--accent':'#7C5CFF','--accent2':'#22D3EE','--accent-lo':'#241F45',
      '--warm':'#FFB020',
      '--text':'#E6E3F5','--text2':'#9995B8','--text3':'#7D79A2',
      '--ok':'#34E5B5','--danger':'#FF5D6C',
      '--grid-dot':'rgba(124,92,255,0.10)','--grid-line':'rgba(124,92,255,0.055)'
    }
  },
  'light': {
    name: 'Claro',
    preview: ['#ECEBF5','#6A45F0','#0E9DC4','#D97706'],
    vars: {
      '--bg':'#ECEBF5','--surface':'#FFFFFF','--surface2':'#F4F3FB','--surface3':'#EAE8F6',
      '--border':'#DCDAEC','--border-hi':'#B6B2D6',
      '--accent':'#6A45F0','--accent2':'#0E9DC4','--accent-lo':'#E9E4FC',
      '--warm':'#D97706',
      '--text':'#17152B','--text2':'#524F76','--text3':'#6B678C',
      '--ok':'#0E9F6E','--danger':'#E23A50',
      '--grid-dot':'rgba(106,69,240,0.12)','--grid-line':'rgba(106,69,240,0.06)'
    }
  }
};

const LEGACY_THEME_MAP = {'dark-teal':'dark','dark-purple':'dark','dark-blue':'dark','dark-amber':'dark'};
const _storedTheme = lsGet('mapgen_theme') || 'dark';
let activeTheme = THEMES[_storedTheme] ? _storedTheme : (LEGACY_THEME_MAP[_storedTheme] || 'dark');

function applyTheme(name) {
  const theme = THEMES[name];
  if (!theme) return;
  const previousTheme = activeTheme;
  activeTheme = name;
  const root = document.documentElement;
  root.dataset.theme = name;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  lsSet('mapgen_theme', name);
  document.getElementById('tool-theme')?.classList.remove('active');
  if (typeof applyElementTheme === 'function') applyElementTheme(name, previousTheme);
}

function toggleTheme() {
  applyTheme(activeTheme === 'dark' ? 'light' : 'dark');
  saveLocalDraft();
  setStatus(`Tema: ${THEMES[activeTheme].name}`);
}
