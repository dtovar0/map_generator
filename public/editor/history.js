// ════════════════════════════════════════════════════
// UNDO / REDO
// ════════════════════════════════════════════════════
let history = [], historyIdx = -1;
const MAX_HISTORY = 60;
const LOCAL_DRAFT_KEY = 'mapgen_local_draft_v1';
let localDraftEnabled = lsGet(LOCAL_DRAFT_KEY) !== null;
let localDraftTimer = null;
let localDraftStorageWarningShown = false;

function getSnapshot() {
  return {
    nodes: structuredClone(nodes),
    links: structuredClone(links),
    currentScale: structuredClone(currentScale),
    scaleByTheme: structuredClone(scaleByTheme),
    generalConfig: structuredClone(generalConfig),
    generalAppearanceByTheme: structuredClone(generalAppearanceByTheme),
    nodeCounter,
    linkCounter
  };
}
function saveLocalDraft(enable = false) {
  if (enable) localDraftEnabled = true;
  if (!localDraftEnabled) return false;
  clearTimeout(localDraftTimer); localDraftTimer = null;
  try {
    lsSet(LOCAL_DRAFT_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      snapshot: getSnapshot(),
      viewport: { zoom, panX, panY },
      context: { currentServerMapId, currentServerMapName, selectedMapDate, theme: lsGet('mapgen_theme') || 'dark' }
    }));
    return true;
  } catch (error) {
    console.warn('No fue posible guardar el borrador local', error);
    if (!localDraftStorageWarningShown) {
      localDraftStorageWarningShown = true;
      setStatus('⚠ El navegador no tiene espacio para guardar el borrador local');
    }
    return false;
  }
}
function scheduleLocalDraftSave() {
  if (!localDraftEnabled) return;
  clearTimeout(localDraftTimer);
  localDraftTimer = setTimeout(() => saveLocalDraft(), 250);
}
function clearLocalDraft() {
  clearTimeout(localDraftTimer); localDraftTimer = null;
  localDraftEnabled = false;
  lsRemove(LOCAL_DRAFT_KEY);
}
function restoreLocalDraft() {
  const raw = lsGet(LOCAL_DRAFT_KEY);
  if (!raw) return false;
  try {
    const draft = JSON.parse(raw);
    if (draft?.version !== 1 || !Array.isArray(draft.snapshot?.nodes) || !Array.isArray(draft.snapshot?.links))
      throw new Error('Borrador local inválido');
    const context = draft.context || {};
    currentServerMapId = context.currentServerMapId || null;
    currentServerMapName = context.currentServerMapName || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(context.selectedMapDate || '')) selectedMapDate = context.selectedMapDate;
    if (context.theme === 'light' || context.theme === 'dark') applyTheme(context.theme);
    applySnapshot(draft.snapshot);
    zoom = Math.min(2.5, Math.max(.25, Number(draft.viewport?.zoom) || 1));
    panX = Number(draft.viewport?.panX) || 0;
    panY = Number(draft.viewport?.panY) || 0;
    applyTransform();
    localDraftEnabled = true;
    return true;
  } catch (error) {
    console.warn('Se descartó un borrador local dañado', error);
    clearLocalDraft();
    return false;
  }
}
function pushHistory() {
  history = history.slice(0, historyIdx + 1);
  history.push(getSnapshot());
  if (history.length > MAX_HISTORY) history.shift();
  historyIdx = history.length - 1;
  updateUndoBtns();
  saveLocalDraft(true);
}
let savedStateForCancel = null; // snapshot for ESC revert (not pushed to undo history)

function saveForCancel() { savedStateForCancel = getSnapshot(); }
function revertCancel() {
  if (!savedStateForCancel) return;
  applySnapshot(savedStateForCancel); savedStateForCancel = null;
  // Clear all drag states so mouseup won't push a stale history entry
  draggingNode = null; resizingNode = null; resizeDir = '';
  resizeGroupStart = [];
  rotatingTextNode = null;
  textRotatedFlag = false;
  draggingWaypoint = null; draggingConnHandle = null; nodeDraggedFlag = false;
  draggingDivider = null;
  clearActiveUsageLabel();
}

function applySnapshot(snap) {
  destroyAllCharts();
  generalConfig = {...DEFAULT_GENERAL_CONFIG, ...(snap.generalConfig || {})};
  if (snap.generalAppearanceByTheme?.dark && snap.generalAppearanceByTheme?.light) {
    generalAppearanceByTheme = {
      dark:{...generalAppearanceByTheme.dark, ...structuredClone(snap.generalAppearanceByTheme.dark)},
      light:{...generalAppearanceByTheme.light, ...structuredClone(snap.generalAppearanceByTheme.light)}
    };
  } else {
    THEME_CONFIG_FIELDS.forEach(field => { generalAppearanceByTheme.dark[field] = generalConfig[field]; });
  }
  THEME_CONFIG_FIELDS.forEach(field => {
    generalConfig[field] = generalAppearanceByTheme[activeTheme]?.[field] ?? generalConfig[field];
  });
  if (snap.scaleByTheme?.dark && snap.scaleByTheme?.light) {
    scaleByTheme = structuredClone(snap.scaleByTheme);
    currentScale = scaleByTheme[activeTheme].map(item => ({...item}));
  } else {
    currentScale = structuredClone(snap.currentScale || PRESETS.cacti);
    scaleByTheme.dark = currentScale.map(item => ({...item}));
  }
  if (['arrow-forward','arrow-back'].includes(generalConfig.midTermination))
    generalConfig.midTermination = 'arrows';
  if (generalConfig.usageLabelPosition === 'inside') generalConfig.usageLabelPosition = 'center';
  nodes = structuredClone(snap.nodes).map(n => ({
    image:null, nameInside:true, hideName:false, textRotation:0, linkPadding:generalConfig.linkPadding,
    fontSize:n.type === 'text' ? (Number(n.textFontSize) || 18) : 11,
    fontFamily:'system-ui', fontBold:false, fontItalic:false,
    textColor:null, nodeBackground:null, nodeBorderColor:null, nodeBorderWidth:null, nodeBorderHidden:false,
    nodeBackgroundTransparent:false,
    textBackground:null, textBackgroundTransparent:n.type === 'text', textBorderColor:null, textBorderWidth:null, textBorderHidden:false,
    appearanceThemes:{}, sizeOverride:false, linkPaddingOverride:false, appearanceOverride:n.appearanceOverride ?? hasCustomNodeAppearance(n), ...n
  })).map(n => {
    if (!n.appearanceOverride) Object.assign(n, getGeneralNodeAppearance(n.type));
    else {
      n.appearanceThemes ||= {};
      n.appearanceThemes[activeTheme] ||= captureNodeAppearance(n);
      Object.assign(n, n.appearanceThemes[activeTheme]);
    }
    if (n.type === 'chart') {
      n.graphConfig ||= {type:'line', title:n.name || 'Gráfica', range:'24h', consolidation:'AVERAGE', series:[]};
      n.graphConfig.type = n.graphConfig.type === 'donut' ? 'line' : (n.graphConfig.type || 'line');
      n.graphConfig.range ||= '24h'; n.graphConfig.consolidation ||= 'AVERAGE'; n.graphConfig.series ||= [];
      delete n.graphConfig.mode; delete n.graphConfig.values;
      n.graphConfigThemes ||= {};
      n.graphConfigThemes[activeTheme] ||= {type:n.graphConfig.type || 'bar', color:n.graphConfig.color || (activeTheme === 'light' ? '#6a45f0' : '#7c5cff')};
      Object.assign(n.graphConfig, n.graphConfigThemes[activeTheme]);
    }
    return n;
  });
  links = structuredClone(snap.links).map(l => ({
    description:'', width:generalConfig.linkWidth,
    midTermination:generalConfig.midTermination,
    scaleOverride:false, scale:null, scaleThemes:{},
    capacity:100, capacityUnit:'Mbps', inUsage:null, outUsage:null,
    editorInPct:null, editorOutPct:null,
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
    dividerPosition:generalConfig.dividerPosition, dividerPositionOverride:false,
    routeLane:0, routeStyle:'ortho',
    styleOverride:false, fromPortLocked:false, toPortLocked:false,
    dataSource:null, telemetryError:null, telemetryTimestamp:null, ...l
  })).map(l => {
    if (l.scaleOverride) {
      l.scaleThemes ||= {};
      l.scaleThemes[activeTheme] ||= Array.isArray(l.scale) ? l.scale.map(item => ({...item})) : currentScale.map(item => ({...item}));
      l.scale = l.scaleThemes[activeTheme].map(item => ({...item}));
    }
    const capacity = Math.max(.01, Number(l.capacity) || 100);
    const rawIn  = l.inUsage  == null ? (Number(l.inPct)  || 0) : Number(l.inUsage);
    const rawOut = l.outUsage == null ? (Number(l.outPct) || 0) : Number(l.outUsage);
    const inUsage  = Math.max(0, Number(rawIn)  || 0);
    const outUsage = Math.max(0, Number(rawOut) || 0);
    return {
      ...l, capacity, inUsage, outUsage,
      midTermination: ['arrow-forward','arrow-back'].includes(l.midTermination) ? 'arrows' : l.midTermination,
      usageLabelPosition:l.usageLabelPosition === 'inside' ? 'center' : l.usageLabelPosition,
      capacityLabelSide:['left','right','above','below'].includes(l.capacityLabelSide) ? l.capacityLabelSide : 'right',
      usageLabelFlip:!!l.usageLabelFlip,
      editorInPct:l.editorInPct == null ? (Number(l.inPct) || 0) : Number(l.editorInPct),
      editorOutPct:l.editorOutPct == null ? (Number(l.outPct) || 0) : Number(l.editorOutPct),
      inPct:Math.round(inUsage / capacity * 1000) / 10,
      outPct:Math.round(outUsage / capacity * 1000) / 10
    };
  });
  nodeCounter = Number.isInteger(snap.nodeCounter) ? snap.nodeCounter : maxIdNumber(nodes);
  linkCounter = Number.isInteger(snap.linkCounter) ? snap.linkCounter : maxIdNumber(links);
  document.getElementById('canvas').innerHTML = '';
  nodes.forEach(n => renderNode(n));
  nodes.forEach(n => distributePortLinks(n.id));
  renderScaleUI();
  renderConfigUI();
  clearSelection(); renderLinks(); updateHint(); updateCounter();
}

function maxIdNumber(items) {
  return items.reduce((max, item) => Math.max(max, parseInt(String(item.id).replace(/\D/g, ''), 10) || 0), 0);
}
function undo() {
  if (historyIdx <= 0) return;
  historyIdx--;
  applySnapshot(history[historyIdx]);
  updateUndoBtns(); saveLocalDraft(true); setStatus('Deshacer');
}
function redo() {
  if (historyIdx >= history.length - 1) return;
  historyIdx++;
  applySnapshot(history[historyIdx]);
  updateUndoBtns(); saveLocalDraft(true); setStatus('Rehacer');
}
function updateUndoBtns() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  const undoDisabled = historyIdx <= 0;
  const redoDisabled = historyIdx >= history.length - 1;
  undoBtn?.classList.toggle('disabled', undoDisabled);
  undoBtn?.setAttribute('aria-disabled', String(undoDisabled));
  redoBtn?.classList.toggle('disabled', redoDisabled);
  redoBtn?.setAttribute('aria-disabled', String(redoDisabled));
}

// ════════════════════════════════════════════════════
// SCALE DATA
// ════════════════════════════════════════════════════
const PRESETS = {
  cacti:   [{pct:0,color:'#276749'},{pct:25,color:'#2b6cb0'},{pct:50,color:'#c05621'},{pct:75,color:'#9b2335'},{pct:100,color:'#63171b'}],
  traffic: [{pct:0,color:'#22543d'},{pct:33,color:'#d97706'},{pct:66,color:'#b91c1c'},{pct:100,color:'#7f1d1d'}],
  heat:    [{pct:0,color:'#1e40af'},{pct:25,color:'#0891b2'},{pct:50,color:'#16a34a'},{pct:75,color:'#ca8a04'},{pct:100,color:'#dc2626'}],
  cool:    [{pct:0,color:'#1a365d'},{pct:50,color:'#2d3748'},{pct:100,color:'#742a2a'}],
};
let currentScale = PRESETS.cacti.map(s => ({...s}));
let scaleByTheme = {
  dark: currentScale.map(item => ({...item})),
  light: PRESETS.heat.map(item => ({...item}))
};

function syncScaleThemeScope() {
  scaleByTheme[activeTheme] = currentScale.map(item => ({...item}));
  if (applyAppearanceToBothThemes) {
    const otherTheme = activeTheme === 'light' ? 'dark' : 'light';
    scaleByTheme[otherTheme] = currentScale.map(item => ({...item}));
  }
}

function applyPreset(name) {
  if (name === 'custom') return;
  currentScale = PRESETS[name].map(s => ({...s}));
  syncScaleThemeScope();
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Umbrales generales actualizados');
}

function addThreshold() {
  let gapIdx = -1, largestGap = 0;
  for (let i = 0; i < currentScale.length - 1; i++) {
    const gap = currentScale[i + 1].pct - currentScale[i].pct;
    if (gap > largestGap) { largestGap = gap; gapIdx = i; }
  }
  if (gapIdx < 0 || largestGap <= 1) {
    setStatus('No hay espacio para otro umbral');
    return;
  }
  const newPct = Math.floor((currentScale[gapIdx].pct + currentScale[gapIdx + 1].pct) / 2);
  currentScale.splice(gapIdx + 1, 0, { pct: newPct, color: '#718096' });
  syncScaleThemeScope();
  document.getElementById('palette-sel').value = 'custom';
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Umbral general agregado');
}

function removeThreshold(idx) {
  if (currentScale.length <= 2) return;
  currentScale.splice(idx, 1);
  syncScaleThemeScope();
  document.getElementById('palette-sel').value = 'custom';
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Umbral general eliminado');
}

function updateThresholdPct(idx, val) {
  const min = idx > 0 ? currentScale[idx - 1].pct + 1 : 0;
  const max = idx < currentScale.length - 1 ? currentScale[idx + 1].pct - 1 : 100;
  const v = Math.max(min, Math.min(max, parseInt(val, 10) || 0));
  if (currentScale[idx].pct === v) { renderScaleUI(); return; }
  currentScale[idx].pct = v;
  syncScaleThemeScope();
  document.getElementById('palette-sel').value = 'custom';
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Umbral general actualizado');
}

function updateThresholdColor(idx, color) {
  if (!currentScale[idx] || currentScale[idx].color === color) return;
  currentScale[idx].color = color;
  syncScaleThemeScope();
  document.getElementById('palette-sel').value = 'custom';
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Color general actualizado');
}

function updateThresholdText(idx, text) {
  if (!currentScale[idx]) return;
  const value = String(text || '').trim().slice(0, 30);
  if ((currentScale[idx].text || '') === value) return;
  currentScale[idx].text = value;
  syncScaleThemeScope();
  renderScaleUI(); pushHistory(); setStatus('Texto del umbral actualizado');
}

function getColor(pct, scale = currentScale) {
  const p = Array.isArray(scale) && scale.length >= 2 ? scale : currentScale;
  if (pct <= p[0].pct) return p[0].color;
  if (pct >= p[p.length - 1].pct) return p[p.length - 1].color;
  for (let i = 0; i < p.length - 1; i++) {
    if (pct >= p[i].pct && pct <= p[i+1].pct) {
      const range = p[i+1].pct - p[i].pct;
      return range > 0 ? lerpColor(p[i].color, p[i+1].color, (pct - p[i].pct) / range) : p[i+1].color;
    }
  }
  return p[p.length-1].color;
}
function lerpColor(a, b, t) {
  const ah = parseInt(a.slice(1),16), bh = parseInt(b.slice(1),16);
  const r = Math.round(((ah>>16)&0xff)+(((bh>>16)&0xff)-((ah>>16)&0xff))*t);
  const g = Math.round(((ah>>8)&0xff) +(((bh>>8)&0xff) -((ah>>8)&0xff))*t);
  const bl= Math.round((ah&0xff)      +((bh&0xff)       -(ah&0xff))*t);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bl.toString(16).padStart(2,'0')}`;
}

function renderScaleUI() {
  // Preview bar
  document.getElementById('scale-preview-bar').innerHTML =
    currentScale.map(s => `<div class="scale-seg" style="background:${s.color}"><span>${s.pct}%</span></div>`).join('');

  // Mini status bar
  document.getElementById('scale-mini-bar').innerHTML =
    currentScale.map(s => `<div style="flex:1;background:${s.color}"></div>`).join('');

  // Editable threshold rows
  const list = document.getElementById('scale-threshold-list');
  list.innerHTML = currentScale.map((s, i) => `
    <div class="scale-threshold-row" id="sth-${i}">
      <div class="sth-color" title="Cambiar color" style="background:${s.color}">
        <input type="color" value="${s.color}" data-change="updateThresholdColor" data-args='[${i},"$value"]'>
        <div class="sth-swatch" style="background:${s.color}"></div>
      </div>
      <div class="sth-pct-wrap">
        <input class="sth-pct" type="number" min="0" max="100" value="${s.pct}"
               data-change="updateThresholdPct" data-args='[${i},"$value"]'
               data-blur="updateThresholdPct" data-args='[${i},"$value"]' />
        <span class="sth-pct-unit">%</span>
      </div>
      <div style="flex:1;height:10px;border-radius:3px;background:${s.color};border:1px solid color-mix(in srgb,var(--border) 45%,transparent)"></div>
      ${currentScale.length > 2
        ? `<button class="sth-del" data-click="removeThreshold" data-args='[${i}]' title="Eliminar">✕</button>`
        : `<div style="width:22px"></div>`}
    </div>`).join('');
  renderCanvasBadges(); // the on-canvas threshold legend mirrors this scale
  if (selectedCanvasInfo === 'legend') updatePropsPanel();
}

// ════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════
function snap(v) { return snapEnabled ? Math.round(v / GRID) * GRID : v; }
function getCanvasPos(e) {
  const rect = document.getElementById('canvas-wrap').getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - panX) / zoom,
    y: (e.clientY - rect.top  - panY) / zoom
  };
}
function applyTransform() {
  const t = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  document.getElementById('canvas').style.transform = t;
  document.getElementById('canvas').style.transformOrigin = '0 0';
  document.getElementById('links-svg').style.transform = t;
  document.getElementById('links-svg').style.transformOrigin = '0 0';
  document.getElementById('overlay-svg').style.transform = t;
  document.getElementById('overlay-svg').style.transformOrigin = '0 0';
  document.getElementById('canvas-bg').style.backgroundPosition = `${panX % 20}px ${panY % 20}px`;
  const after = document.getElementById('canvas-bg');
  after.style.setProperty('--pan-x', (panX % 100) + 'px');
  after.style.setProperty('--pan-y', (panY % 100) + 'px');
  const zoomText = Math.round(zoom * 100) + '%';
  document.getElementById('zoom-label').textContent = zoomText;
  const floatingZoomLabel = document.getElementById('floating-zoom-label');
  if (floatingZoomLabel) floatingZoomLabel.textContent = zoomText;
  scheduleLocalDraftSave();
}
function setStatus(msg) {
  const text = document.getElementById('status-text');
  const message = document.getElementById('status-message');
  if (text) text.textContent = msg;
  if (!message) return;
  const normalized = String(msg).toLowerCase();
  const state = /⚠|error|no se pudo|no hay|inválid|sin información/.test(normalized)
    ? 'warning'
    : /guardando|generando|abriendo|cargando|actualizando|…/.test(normalized)
      ? 'busy'
      : /✓|guardado|creado|exportad|actualizad|aplicado|listo/.test(normalized)
        ? 'success'
        : 'ready';
  message.dataset.state = state;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  })[ch]);
}
