// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════
let nodes = [], links = [];
let selectedId = null, selectedLinkId = null;
let selectedNodeIds = new Set();   // multi-selection; selectedId = primary (last picked)
let selectedLinkIds = new Set();   // multi-selection of links (marquee / shift-click)
let nodeCounter = 0, linkCounter = 0;
let gridEnabled = localStorage.getItem('mapgen_grid_enabled') !== 'false';
let snapEnabled = localStorage.getItem('mapgen_snap_enabled') !== 'false';
let autoOrderEnabled = localStorage.getItem('mapgen_auto_order_enabled') === 'true';
let presentationMode = false;
let presentationViewMode = localStorage.getItem('mapgen_presentation_view_mode') === 'day' ? 'day' : 'live';
const PRESENTATION_REFRESH_OPTIONS = [5,10,15,30,60];
let presentationRefreshMinutes = Number(localStorage.getItem('mapgen_presentation_refresh')) || 5;
if (!PRESENTATION_REFRESH_OPTIONS.includes(presentationRefreshMinutes)) presentationRefreshMinutes = 5;
let presentationRefreshTimer = null;
let presentationRefreshInFlight = false;
const localToday = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};
let selectedMapDate = localStorage.getItem('mapgen_current_server_date') || localToday();
let currentServerMapId = localStorage.getItem('mapgen_current_server_id') || null;
let currentServerMapName = localStorage.getItem('mapgen_current_server_name') || '';
let currentTool = 'select';
const DEFAULT_TOOL_HOTKEYS = { select:'s', node:'n', link:'l', icon:'i', text:'t', chart:'g' };
const HOTKEY_RESERVED = new Set(['p']);
const HOTKEY_TOOLS = [
  {id:'select', label:'Seleccionar', description:'Seleccionar y mover elementos', paletteId:'pal-select', icon:'<path d="m5 4 13 8-6 1-3 6z"/>'},
  {id:'node', label:'Nodo', description:'Colocar un nodo nuevo', paletteId:'pal-node', icon:'<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 9h6M9 13h4"/>'},
  {id:'link', label:'Link', description:'Conectar dos elementos', paletteId:'pal-link', icon:'<path d="M8.5 15.5 6 18a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M15.5 8.5 18 6a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0M8 16l8-8"/>'},
  {id:'icon', label:'Icono', description:'Agregar una imagen o icono', paletteId:'pal-icon', icon:'<rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="m6 17 4-4 3 3 2-2 3 3"/>'},
  {id:'text', label:'Texto', description:'Agregar un bloque de texto', paletteId:'pal-text', icon:'<path d="M5 6V4h14v2M12 4v16M8 20h8"/>'},
  {id:'chart', label:'Gráfica', description:'Crear una visualización de datos', paletteId:'chart-pal', icon:'<path d="M5 19V10h4v9M10 19V5h4v14M15 19v-7h4v7M3 19h18"/>'}
];
function loadToolHotkeys() {
  try {
    const saved = JSON.parse(localStorage.getItem('mapgen_tool_hotkeys') || '{}');
    const result = {...DEFAULT_TOOL_HOTKEYS};
    const used = new Set();
    for (const tool of HOTKEY_TOOLS) {
      const key = String(saved[tool.id] || result[tool.id]).toLowerCase();
      if (!/^[a-z0-9]$/.test(key) || HOTKEY_RESERVED.has(key) || used.has(key)) return {...DEFAULT_TOOL_HOTKEYS};
      result[tool.id] = key; used.add(key);
    }
    return result;
  } catch { return {...DEFAULT_TOOL_HOTKEYS}; }
}
let toolHotkeys = loadToolHotkeys();
let hotkeyDraft = null;
const GRID = 20, DEFAULT_LINK_PADDING = 12, PORT_SLOT_COUNT = 10; let zoom = 1;
const EDITOR_IN_COLOR = '#2D8CFF', EDITOR_OUT_COLOR = '#F06432';
const DEFAULT_GENERAL_CONFIG = {
  nodeWidth: 120, nodeHeight: 120, linkPadding: DEFAULT_LINK_PADDING,
  linkWidth: 6, midTermination: 'circle', dividerPosition:50,
  usageLabelFormat:'percentage', usageLabelPosition:'above', usageLabelRotate:false, usageLabelFlip:false,
  capacityLabelVisible:true, capacityLabelSide:'right', capacityLabelRotate:false, capacityLabelFlip:false, capacityLabelFontSize:11,
  regularFontSize:11, regularFontFamily:'system-ui', regularFontBold:false, regularFontItalic:false,
  regularTextColor:'#c2d4e8', regularNodeBackground:'#101e30', regularNodeBackgroundTransparent:true,
  regularNodeBorderColor:'#1b2e46', regularNodeBorderWidth:1.5, regularNodeBorderHidden:false,
  regularTextBackground:'#070c13', regularTextBackgroundTransparent:true,
  regularTextBorderColor:'#1b2e46', regularTextBorderWidth:1, regularTextBorderHidden:true,
  textNodeFontSize:18, textNodeFontFamily:'system-ui', textNodeFontBold:false, textNodeFontItalic:false,
  textNodeTextColor:'#c2d4e8', textNodeBackground:'#101e30', textNodeBackgroundTransparent:false,
  textNodeBorderColor:'#1b2e46', textNodeBorderWidth:1.5, textNodeBorderHidden:false,
  textNodeTextBackground:'#101e30', textNodeTextBackgroundTransparent:true,
  textNodeTextBorderColor:'#1b2e46', textNodeTextBorderWidth:0, textNodeTextBorderHidden:false
};
let generalConfig = {...DEFAULT_GENERAL_CONFIG};

const GENERAL_NODE_APPEARANCE = {
  regularFontSize:['regular','fontSize'], regularFontFamily:['regular','fontFamily'], regularFontBold:['regular','fontBold'], regularFontItalic:['regular','fontItalic'],
  regularTextColor:['regular','textColor'], regularNodeBackground:['regular','nodeBackground'], regularNodeBackgroundTransparent:['regular','nodeBackgroundTransparent'],
  regularNodeBorderColor:['regular','nodeBorderColor'], regularNodeBorderWidth:['regular','nodeBorderWidth'], regularNodeBorderHidden:['regular','nodeBorderHidden'],
  regularTextBackground:['regular','textBackground'], regularTextBackgroundTransparent:['regular','textBackgroundTransparent'],
  regularTextBorderColor:['regular','textBorderColor'], regularTextBorderWidth:['regular','textBorderWidth'], regularTextBorderHidden:['regular','textBorderHidden'],
  textNodeFontSize:['text','fontSize'], textNodeFontFamily:['text','fontFamily'], textNodeFontBold:['text','fontBold'], textNodeFontItalic:['text','fontItalic'],
  textNodeTextColor:['text','textColor'], textNodeBackground:['text','nodeBackground'], textNodeBackgroundTransparent:['text','nodeBackgroundTransparent'],
  textNodeBorderColor:['text','nodeBorderColor'], textNodeBorderWidth:['text','nodeBorderWidth'], textNodeBorderHidden:['text','nodeBorderHidden'],
  textNodeTextBackground:['text','textBackground'], textNodeTextBackgroundTransparent:['text','textBackgroundTransparent'],
  textNodeTextBorderColor:['text','textBorderColor'], textNodeTextBorderWidth:['text','textBorderWidth'], textNodeTextBorderHidden:['text','textBorderHidden']
};

function getGeneralNodeAppearance(type) {
  const group = type === 'text' ? 'text' : 'regular';
  return Object.fromEntries(Object.entries(GENERAL_NODE_APPEARANCE)
    .filter(([, [target]]) => target === group)
    .map(([configField, [, nodeField]]) => [nodeField, generalConfig[configField]]));
}

function hasCustomNodeAppearance(node) {
  const legacyDefaults = {
    fontSize:node.type === 'text' ? (Number(node.textFontSize) || 18) : 11,
    fontFamily:'system-ui', fontBold:false, fontItalic:false, textColor:null,
    nodeBackground:null, nodeBackgroundTransparent:false, nodeBorderColor:null, nodeBorderWidth:null, nodeBorderHidden:false,
    textBackground:null, textBackgroundTransparent:node.type === 'text', textBorderColor:null, textBorderWidth:null, textBorderHidden:false
  };
  return Object.entries(legacyDefaults).some(([field, defaultValue]) =>
    (node[field] ?? defaultValue) !== defaultValue);
}

let placingItem = null;
let multiPlacementEnabled = false;
let chartWizardEditingId = null;
let arrangeEmbeddedInTab = false;
let editingTextNodeId = null, inlineTextSnapshot = null, finishingInlineText = false;
const chartInstances = new Map();
function destroyChartInstance(id) {
  chartInstances.get(id)?.destroy();
  chartInstances.delete(id);
}
function destroyAllCharts() {
  chartInstances.forEach(chart => chart.destroy());
  chartInstances.clear();
}
let draggingNode = null, dragOffX = 0, dragOffY = 0;
let dragGroupStart = [];           // [{id,x,y}] start positions for group move
let dragGroupWps = [];             // [{id,wps:[{x,y}]}] waypoint snapshots of fully-moving links
let marquee = null;                // area selection: {x0,y0,x1,y1,additive}
let justMarqueed = false;          // suppress the click that follows a marquee drag
let customAlignmentPending = null; // {nodeIds:Set, orientation} while choosing the anchor node
let resizingNode = null, resizeDir = '', resizeStartX = 0, resizeStartY = 0;
let resizeOrigW = 0, resizeOrigH = 0, resizeOrigX = 0, resizeOrigY = 0;
let resizeGroupStart = [];         // selected nodes resized together from the same handle
let rotatingTextNode = null, textRotateStartPointer = 0, textRotateStartAngle = 0, textRotatedFlag = false;
let linkStart = null, linkPreviewEl = null, linkWaypoints = [];
let isPanning = false, panX = 0, panY = 0, panStartMouseX = 0, panStartMouseY = 0, panStartX = 0, panStartY = 0, panMoved = false;
let draggingWaypoint = null;    // { linkId, wpIndex }
let draggingConnHandle = null;  // { linkId, isFrom, port, nodeId }
let draggingDivider = null;     // { linkId, startPosition }
let activeUsageLabel = null;    // { linkId, side: 'in' | 'out' }
let draggingUsageLabel = null;  // { linkId, side, startPosition }
let geometryChangeSnapshot = null; // state immediately before a geometry edit
let showConnHandles = false;    // only true after dblclick on node
function setConnHandlesMode(active) {
  showConnHandles = active;
  document.body.classList.toggle('editing-endpoints', active);
}
let nodeDraggedFlag = false;    // true if node was actually dragged since last mousedown

// ════════════════════════════════════════════════════
// UNDO / REDO
// ════════════════════════════════════════════════════
let history = [], historyIdx = -1;
const MAX_HISTORY = 60;
const LOCAL_DRAFT_KEY = 'mapgen_local_draft_v1';
let localDraftEnabled = localStorage.getItem(LOCAL_DRAFT_KEY) !== null;
let localDraftTimer = null;
let localDraftStorageWarningShown = false;

function getSnapshot() {
  return {
    nodes: structuredClone(nodes),
    links: structuredClone(links),
    currentScale: structuredClone(currentScale),
    generalConfig: structuredClone(generalConfig),
    nodeCounter,
    linkCounter
  };
}
function saveLocalDraft(enable = false) {
  if (enable) localDraftEnabled = true;
  if (!localDraftEnabled) return false;
  clearTimeout(localDraftTimer); localDraftTimer = null;
  try {
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({
      version: 1,
      savedAt: new Date().toISOString(),
      snapshot: getSnapshot(),
      viewport: { zoom, panX, panY },
      context: { currentServerMapId, currentServerMapName, selectedMapDate, theme: localStorage.getItem('mapgen_theme') || 'dark' }
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
  localStorage.removeItem(LOCAL_DRAFT_KEY);
}
function restoreLocalDraft() {
  const raw = localStorage.getItem(LOCAL_DRAFT_KEY);
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
  activeUsageLabel = null; draggingUsageLabel = null;
}

function applySnapshot(snap) {
  destroyAllCharts();
  generalConfig = {...DEFAULT_GENERAL_CONFIG, ...(snap.generalConfig || {})};
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
    sizeOverride:false, linkPaddingOverride:false, appearanceOverride:n.appearanceOverride ?? hasCustomNodeAppearance(n), ...n
  })).map(n => n.appearanceOverride ? n : Object.assign(n, getGeneralNodeAppearance(n.type)));
  links = structuredClone(snap.links).map(l => ({
    description:'', width:generalConfig.linkWidth,
    midTermination:generalConfig.midTermination,
    scaleOverride:false, scale:null,
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
    routeLane:0, styleOverride:false, fromPortLocked:false, toPortLocked:false,
    dataSource:null, telemetryError:null, telemetryTimestamp:null, ...l
  })).map(l => {
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
  if (Array.isArray(snap.currentScale) && snap.currentScale.length >= 2)
    currentScale = structuredClone(snap.currentScale);
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
  document.getElementById('btn-undo')?.classList.toggle('disabled', historyIdx <= 0);
  document.getElementById('btn-redo')?.classList.toggle('disabled', historyIdx >= history.length - 1);
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

function applyPreset(name) {
  if (name === 'custom') return;
  currentScale = PRESETS[name].map(s => ({...s}));
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
  document.getElementById('palette-sel').value = 'custom';
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Umbral general agregado');
}

function removeThreshold(idx) {
  if (currentScale.length <= 2) return;
  currentScale.splice(idx, 1);
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
  document.getElementById('palette-sel').value = 'custom';
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Umbral general actualizado');
}

function updateThresholdColor(idx, color) {
  if (!currentScale[idx] || currentScale[idx].color === color) return;
  currentScale[idx].color = color;
  document.getElementById('palette-sel').value = 'custom';
  renderScaleUI();
  renderLinks();
  pushHistory(); setStatus('Color general actualizado');
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
        <input type="color" value="${s.color}" onchange="updateThresholdColor(${i}, this.value)">
        <div class="sth-swatch" style="background:${s.color}"></div>
      </div>
      <div class="sth-pct-wrap">
        <input class="sth-pct" type="number" min="0" max="100" value="${s.pct}"
               onchange="updateThresholdPct(${i}, this.value)"
               onblur="updateThresholdPct(${i}, this.value)" />
        <span class="sth-pct-unit">%</span>
      </div>
      <div style="flex:1;height:10px;border-radius:3px;background:${s.color};border:1px solid color-mix(in srgb,var(--border) 45%,transparent)"></div>
      ${currentScale.length > 2
        ? `<button class="sth-del" onclick="removeThreshold(${i})" title="Eliminar">✕</button>`
        : `<div style="width:22px"></div>`}
    </div>`).join('');
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
  document.getElementById('zoom-label').textContent = Math.round(zoom * 100) + '%';
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

// ════════════════════════════════════════════════════
// PLACING MODE
// ════════════════════════════════════════════════════
function activatePlacing(el) {
  const type = el.dataset.type, icon = el.dataset.icon, label = el.dataset.label;
  if (placingItem && placingItem.type === type) { cancelPlacing(); return; }
  cancelPlacing();
  // Deactivate palette tool buttons while placing
  document.querySelectorAll('#pal-select, #pal-link').forEach(e => e.classList.remove('active'));
  placingItem = { type, icon, label, el };
  el.classList.add('placing');
  document.body.classList.add('placing-mode');
  const preview = document.getElementById('place-preview');
  document.getElementById('preview-box').textContent = type === 'text' ? label : icon;
  const previewSize = type === 'text' ? measureTextNodeSize(label,18) : {w:generalConfig.nodeWidth,h:generalConfig.nodeHeight};
  document.getElementById('preview-box').style.cssText = `width:${previewSize.w}px;height:${previewSize.h}px;${type==='text'?'font-size:18px':''}`;
  document.getElementById('preview-label').textContent = label;
  preview.style.display = 'flex';
  document.getElementById('place-banner').classList.add('show');
  document.getElementById('mode-label').textContent = `Colocando: ${label}`;
  setStatus(`Clic en el canvas para colocar ${label}  ·  Esc para cancelar`);
}
function cancelPlacing() {
  if (placingItem) { placingItem.el.classList.remove('placing'); placingItem = null; }
  document.body.classList.remove('placing-mode');
  document.getElementById('place-preview').style.display = 'none';
  document.getElementById('place-banner').classList.remove('show');
  document.getElementById('mode-label').textContent = 'Modo: Seleccionar';
  // Restore palette active state to match currentTool
  document.querySelectorAll('#pal-select, #pal-link').forEach(e => e.classList.remove('active'));
  document.getElementById('pal-' + currentTool)?.classList.add('active');
}

function toggleMultiPlacement() {
  multiPlacementEnabled = !multiPlacementEnabled;
  const button = document.getElementById('tool-multi-place');
  button.innerHTML = multiPlacementEnabled
    ? '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
    : '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/></svg>';
  button.classList.toggle('active', multiPlacementEnabled);
  button.setAttribute('aria-pressed', String(multiPlacementEnabled));
  button.title = multiPlacementEnabled
    ? 'Colocación múltiple activa: la herramienta permanece seleccionada'
    : 'Colocación única activa: la herramienta se libera después de insertar';
  setStatus(multiPlacementEnabled ? 'Colocación múltiple habilitada' : 'Colocación única habilitada');
}

function openChartWizard(nodeId = null) {
  chartWizardEditingId = nodeId || null;
  const n = nodeId ? nodes.find(x => x.id === nodeId) : null;
  const cfg = n?.graphConfig || {type:'bar',color:'#0dbfa6',values:[25,50,35,80,60],title:'Gráfica'};
  document.getElementById('chart-title').value = cfg.title || n?.name || 'Gráfica';
  syncSegToggle('chart-type', cfg.type || 'bar');
  document.getElementById('chart-color').value = cfg.color || '#0dbfa6';
  document.getElementById('chart-values').value = (cfg.values || []).join(', ');
  document.getElementById('chart-width').value = n?.w || 240;
  document.getElementById('chart-height').value = n?.h || 160;
  document.getElementById('chart-wizard-title').textContent = n ? 'Editar gráfica' : 'Crear gráfica';
  document.getElementById('chart-wizard-save').textContent = n ? 'Guardar cambios' : 'Crear y colocar';
  document.getElementById('chart-wizard').classList.add('open');
  setTimeout(() => document.getElementById('chart-title').focus(), 0);
}

function closeChartWizard() {
  document.getElementById('chart-wizard').classList.remove('open');
  chartWizardEditingId = null;
}

function startChartPlacementMode() {
  if (placingItem?.type === 'chart') { cancelPlacing(); return; }
  const defaultConfig = {type:'bar', color:'#0dbfa6', values:[25,50,35,80,60], title:'Gráfica'};
  beginChartPlacement('Gráfica', defaultConfig, 240, 160);
}

function beginChartPlacement(title, graphConfig, width, height) {
  cancelPlacing();
  const el = document.getElementById('chart-pal');
  document.querySelectorAll('#pal-select, #pal-link').forEach(e => e.classList.remove('active'));
  placingItem = {type:'chart',icon:'📊',label:title,el,w:width,h:height,extra:{graphConfig}};
  el.classList.add('placing'); document.body.classList.add('placing-mode');
  document.getElementById('preview-box').textContent = '📊';
  document.getElementById('preview-box').style.cssText = `width:${width}px;height:${height}px`;
  document.getElementById('preview-label').textContent = title;
  document.getElementById('place-preview').style.display = 'flex';
  document.getElementById('place-banner').classList.add('show');
  document.getElementById('mode-label').textContent = `Colocando: ${title}`;
  setStatus('Clic en el canvas para colocar la gráfica · Esc para cancelar');
}

function saveChartWizard() {
  const title = document.getElementById('chart-title').value.trim() || 'Gráfica';
  const values = document.getElementById('chart-values').value.split(',')
    .map(v => Number(v.trim())).filter(Number.isFinite);
  if (!values.length) {
    setStatus('⚠ Agrega al menos un valor numérico');
    document.getElementById('chart-values').focus(); return;
  }
  const graphConfig = {
    title, values, type:segToggleValue('chart-type') || 'bar',
    color:document.getElementById('chart-color').value
  };
  const width = Math.max(120, Math.min(1000, Number(document.getElementById('chart-width').value) || 240));
  const height = Math.max(100, Math.min(800, Number(document.getElementById('chart-height').value) || 160));
  if (chartWizardEditingId) {
    const n = nodes.find(x => x.id === chartWizardEditingId); if (!n) return closeChartWizard();
    const before = getSnapshot();
    n.graphConfig = graphConfig; n.name = title; n.w = width; n.h = height; n.sizeOverride = true;
    distributePortLinks(n.id); renderNode(n); renderLinks(); updatePropsPanel();
    const touching = links.filter(l => l.from===n.id || l.to===n.id).map(l => l.id);
    if (!revertIfLinksOverlap(before, touching)) { pushHistory(); setStatus('Gráfica actualizada'); }
    closeChartWizard();
  } else {
    closeChartWizard();
    beginChartPlacement(title, graphConfig, width, height);
  }
}

// ════════════════════════════════════════════════════
// NODES
// ════════════════════════════════════════════════════
function getNodeFontSize(node) {
  return Math.max(8, Number(node.fontSize) || (node.type === 'text' ? Number(node.textFontSize) || 18 : 11));
}

function measureTextNodeSize(text, fontSize = 18, fontFamily = 'system-ui', fontBold = false, fontItalic = false, borderWidth = 0) {
  const canvas = measureTextNodeSize.canvas || (measureTextNodeSize.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontItalic ? 'italic ' : ''}${fontBold ? '700' : '500'} ${fontSize}px ${fontFamily}, sans-serif`;
  const explicitLines = String(text || 'Texto').split('\n');
  const maxContentWidth = 360;
  let contentWidth = 0, visualLines = 0;
  explicitLines.forEach(line => {
    const width = ctx.measureText(line || ' ').width;
    contentWidth = Math.max(contentWidth, Math.min(maxContentWidth, width));
    visualLines += Math.max(1, Math.ceil(width / maxContentWidth));
  });
  return {
    w:Math.max(60, Math.ceil(contentWidth + 22 + borderWidth * 2)),
    h:Math.max(38, Math.ceil(visualLines * fontSize * 1.25 + 12 + borderWidth * 2))
  };
}

function getTextNodeAutoSize(node) {
  const base = measureTextNodeSize(node.name, getNodeFontSize(node), node.fontFamily || 'system-ui', !!node.fontBold, !!node.fontItalic, node.textBorderHidden ? 0 : (Number(node.textBorderWidth) || 0));
  const radians = ((Number(node.textRotation) || 0) % 360) * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians)), sin = Math.abs(Math.sin(radians));
  return {
    w:Math.max(38, Math.ceil(base.w*cos + base.h*sin)),
    h:Math.max(38, Math.ceil(base.w*sin + base.h*cos))
  };
}

function autoFitTextNode(node) {
  const size = getTextNodeAutoSize(node);
  node.w = size.w; node.h = size.h; node.sizeOverride = true;
  return size;
}

function createNode(type, icon, label, x, y, w, h, extra = {}) {
  nodeCounter++;
  const id = 'n' + nodeCounter;
  const node = { id, type, icon, name: (type==='text'||type==='chart') ? label : label+'-'+nodeCounter, x, y,
    w:w || generalConfig.nodeWidth, h:h || generalConfig.nodeHeight,
    image:null, nameInside:true, hideName:false, textRotation:0, linkPadding:generalConfig.linkPadding,
    fontSize:type === 'text' ? 18 : 11, fontFamily:'system-ui', fontBold:false, fontItalic:false,
    textColor:null, nodeBackground:null, nodeBorderColor:null, nodeBorderWidth:null, nodeBorderHidden:false,
    nodeBackgroundTransparent:false,
    textBackground:null, textBackgroundTransparent:type === 'text', textBorderColor:null, textBorderWidth:null, textBorderHidden:false,
    ...getGeneralNodeAppearance(type),
    sizeOverride:!!(w || h), linkPaddingOverride:false, appearanceOverride:false,
    inPct: Math.floor(Math.random()*100), outPct: Math.floor(Math.random()*100),
    ...structuredClone(extra) };
  if (type === 'text') {
    node.textFontSize = Number(node.textFontSize) || 18;
    if (!w && !h) autoFitTextNode(node);
  }
  nodes.push(node);
  renderNode(node);
  updateHint(); updateCounter(); pushHistory();
  return id;
}

function renderChartVisual(container, node) {
  const cfg = node.graphConfig || {};
  const values = (cfg.values || [25,50,35,80,60]).map(Number).filter(Number.isFinite);
  const data = values.length ? values : [0];
  const key = JSON.stringify([cfg.title,cfg.type,cfg.color,data,node.w,node.h]);
  if (container.dataset.chartKey === key && chartInstances.has(node.id)) return;
  chartInstances.get(node.id)?.destroy(); chartInstances.delete(node.id);
  container.textContent = '';
  if (typeof Chart === 'undefined') {
    container.textContent = '📊';
    container.title = 'Chart.js no pudo cargarse';
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'chart-canvas'; container.appendChild(canvas);
  const color = cfg.color || '#0dbfa6';
  const labels = data.map((_,i) => `Dato ${i+1}`);
  const type = cfg.type === 'donut' ? 'doughnut' : (cfg.type || 'bar');
  const donutColors = data.map((_,i) => `${color}${Math.max(55, 255-i*28).toString(16).padStart(2,'0')}`);
  const dataset = {
    label:cfg.title || node.name || 'Gráfica', data,
    backgroundColor:type === 'doughnut' ? donutColors : `${color}bb`,
    borderColor:color, borderWidth:2,
    tension:.32, pointRadius:3, pointBackgroundColor:'#111827', fill:false
  };
  chartInstances.set(node.id, new Chart(canvas, {
    type, data:{labels,datasets:[dataset]},
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{legend:{display:false},tooltip:{enabled:true}},
      scales:type === 'doughnut' ? {} : {
        x:{grid:{display:false},ticks:{display:false},border:{color:'#536179'}},
        y:{beginAtZero:true,grid:{color:'#263247'},ticks:{display:false},border:{display:false}}
      },
      cutout:type === 'doughnut' ? '58%' : undefined
    }
  }));
  container.dataset.chartKey = key;
}

function renderNode(n) {
  let el = document.getElementById(n.id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'node'; el.id = n.id;
    el.innerHTML = `
      <div class="node-box" id="box-${n.id}">
        <span class="node-emoji"></span>
        <div class="node-port top"    data-port="top"></div>
        <div class="node-port bottom" data-port="bottom"></div>
        <div class="node-port left"   data-port="left"></div>
        <div class="node-port right"  data-port="right"></div>
        <div class="resize-handle nw" data-dir="nw"></div>
        <div class="resize-handle n"  data-dir="n"></div>
        <div class="resize-handle ne" data-dir="ne"></div>
        <div class="resize-handle e"  data-dir="e"></div>
        <div class="resize-handle se" data-dir="se"></div>
        <div class="resize-handle s"  data-dir="s"></div>
        <div class="resize-handle sw" data-dir="sw"></div>
        <div class="resize-handle w"  data-dir="w"></div>
        <div class="text-rotate-handle" title="Arrastra para girar el texto"></div>
      </div>
      <span class="node-label"></span>`;

    el.addEventListener('mousedown', e => {
      if (presentationMode) return;
      if (e.target.classList.contains('resize-handle') || e.target.classList.contains('text-rotate-handle') || e.target.classList.contains('node-port')) return;
      if (editingTextNodeId === n.id || e.target.closest('[contenteditable="true"]')) { e.stopPropagation(); return; }
      onNodeMouseDown(e, n.id);
    });
    el.querySelectorAll('.resize-handle').forEach(h =>
      h.addEventListener('mousedown', e => onResizeStart(e, n.id, h.dataset.dir)));
    el.querySelector('.text-rotate-handle').addEventListener('mousedown', e => onTextRotateStart(e, n.id));
    // Port mousedown: only block canvas pan / node drag — link logic is in click
    el.querySelectorAll('.node-port').forEach(p =>
      p.addEventListener('mousedown', e => {
        if (currentTool === 'link') { e.stopPropagation(); e.preventDefault(); }
      }));

    el.addEventListener('click', e => {
      if (presentationMode) { showPresentationNodeInfo(n.id); return; }
      if (e.target.classList.contains('resize-handle') || e.target.classList.contains('text-rotate-handle')) return;

      if (customAlignmentPending) {
        e.stopPropagation(); e.preventDefault();
        alignSelectionToReferenceNode(n.id);
        return;
      }

      if (e.target.classList.contains('node-port')) {
        if (currentTool !== 'link') return;
        const port = e.target.dataset.port;
        const pointer = getCanvasPos(e);
        if (!linkStart) {
          // START link from this port
          startLink(n.id, port, pointer);
        } else if (linkStart.nodeId !== n.id) {
          // COMPLETE link to a different node's port
          onNodeClickForLink(n.id, port, pointer);
        }
        // Same node → ignore (no self-links)
        return;
      }

      if (currentTool === 'link') {
        const pointer = getCanvasPos(e);
        if (!linkStart) {
          startLink(n.id, 'center', pointer);
        } else if (linkStart.nodeId !== n.id) {
          onNodeClickForLink(n.id, 'center', pointer);
        }
        return;
      }
      if (nodeDraggedFlag) return; // was a drag, not a click — preserve selection
      if (e.shiftKey || e.ctrlKey || e.metaKey) { toggleNodeSelection(n.id); return; }
      selectNode(n.id);
    });

    el.addEventListener('dblclick', e => {
      if (presentationMode) { e.stopPropagation(); return; }
      if (currentTool === 'link') return;
      if (nodeDraggedFlag) return; // was a select+drag, not a real double-click
      e.stopPropagation();
      if (n.type === 'text') { startInlineTextEdit(n.id); return; }
      // Double-click a node → edit its existing endpoints on the 10-position grid.
      setTool('select');
      selectNode(n.id);
      setConnHandlesMode(true);
      renderLinks();
      setStatus('Grid de 10 posiciones activo · arrastra un enlace arriba o abajo');
    });

    document.getElementById('canvas').appendChild(el);
  }

  el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
  el.classList.toggle('selected', selectedNodeIds.has(n.id));
  el.classList.toggle('name-inside', !!n.nameInside);
  el.classList.toggle('hide-name', !!n.hideName);
  el.classList.toggle('text-only', n.type === 'text');
  const box = document.getElementById('box-' + n.id);
  if (box) {
    box.style.width = n.w + 'px'; box.style.height = n.h + 'px';
    box.style.backgroundColor = n.nodeBackgroundTransparent ? 'transparent' : (n.nodeBackground || '');
    box.style.borderColor = n.nodeBorderColor || '';
    box.style.borderWidth = n.nodeBorderWidth == null ? '' : `${n.nodeBorderWidth}px`;
    box.style.borderStyle = n.nodeBorderHidden ? 'none' : 'solid';
    const em = box.querySelector('.node-emoji');
    if (em) {
      const visualHeight = n.nameInside && !n.hideName ? Math.max(16, n.h - 22) : n.h;
      em.style.fontSize = n.type === 'text'
        ? getNodeFontSize(n) + 'px'
        : Math.max(16, Math.min(n.w, visualHeight) * 0.52) + 'px';
      if (n.type === 'text') {
        let textEl = em.querySelector('.text-node-content');
        if (!textEl) {
          em.textContent = '';
          textEl = document.createElement('div'); textEl.className = 'text-node-content';
          em.appendChild(textEl);
        }
        textEl.textContent = n.name || 'Texto';
        const textBase = measureTextNodeSize(n.name, getNodeFontSize(n), n.fontFamily || 'system-ui', !!n.fontBold, !!n.fontItalic, n.textBorderHidden ? 0 : (Number(n.textBorderWidth) || 0));
        textEl.style.width = textBase.w + 'px'; textEl.style.height = textBase.h + 'px';
        textEl.style.transform = `rotate(${Number(n.textRotation) || 0}deg)`;
        textEl.style.fontSize = `${getNodeFontSize(n)}px`;
        textEl.style.fontFamily = n.fontFamily || 'system-ui';
        textEl.style.fontWeight = n.fontBold ? '700' : '400';
        textEl.style.fontStyle = n.fontItalic ? 'italic' : 'normal';
        textEl.style.color = n.textColor || '';
        const transparentTextBackground = n.textBackgroundTransparent ?? (n.type === 'text');
        textEl.style.backgroundColor = transparentTextBackground ? 'transparent' : (n.textBackground || '#101e30');
        textEl.style.borderColor = n.textBorderColor || '';
        textEl.style.borderWidth = n.textBorderWidth == null ? '' : `${n.textBorderWidth}px`;
        textEl.style.borderStyle = n.textBorderHidden ? 'none' : (n.textBorderWidth ? 'solid' : '');
        textEl.style.borderRadius = !n.textBorderHidden && n.textBorderWidth ? '4px' : '';
      } else if (n.type === 'chart' && n.graphConfig) {
        renderChartVisual(em, n);
      } else if (n.image) {
        let img = em.querySelector('.node-image');
        if (!img) {
          em.textContent = '';
          img = document.createElement('img');
          img.className = 'node-image';
          em.appendChild(img);
        }
        if (img.getAttribute('src') !== n.image) img.src = n.image;
        img.alt = n.name || 'Imagen del nodo';
      } else {
        em.textContent = n.icon || '⬜';
      }
    }
  }
  const lbl = el.querySelector('.node-label');
  if (lbl) {
    lbl.textContent = n.name;
    lbl.style.fontSize = `${getNodeFontSize(n)}px`;
    lbl.style.fontFamily = n.fontFamily || '';
    lbl.style.fontWeight = n.fontBold ? '700' : '400';
    lbl.style.fontStyle = n.fontItalic ? 'italic' : 'normal';
    lbl.style.color = n.textColor || '';
    lbl.style.backgroundColor = n.textBackgroundTransparent ? 'transparent' : (n.textBackground || '');
    lbl.style.borderColor = n.textBorderColor || '';
    lbl.style.borderWidth = n.textBorderWidth == null ? '' : `${n.textBorderWidth}px`;
    lbl.style.borderStyle = n.textBorderHidden ? 'none' : 'solid';
  }
}

function applyInlineTextSize(node, textEl) {
  autoFitTextNode(node);
  const box = document.getElementById('box-' + node.id);
  if (box) { box.style.width = node.w + 'px'; box.style.height = node.h + 'px'; }
  const visual = box?.querySelector('.node-emoji');
  if (visual) visual.style.fontSize = getNodeFontSize(node) + 'px';
  const textBase = measureTextNodeSize(node.name, getNodeFontSize(node), node.fontFamily || 'system-ui', !!node.fontBold, !!node.fontItalic, node.textBorderHidden ? 0 : (Number(node.textBorderWidth) || 0));
  textEl.style.width = textBase.w + 'px'; textEl.style.height = textBase.h + 'px';
  textEl.style.transform = `rotate(${Number(node.textRotation) || 0}deg)`;
  distributePortLinks(node.id); renderLinks(); updatePropsPanel();
  textEl.textContent = node.name;
}

function startInlineTextEdit(id) {
  const node = nodes.find(n => n.id===id); if (!node || node.type!=='text') return;
  if (editingTextNodeId && editingTextNodeId !== id) finishInlineTextEdit(true);
  selectNode(id);
  const host = document.getElementById(id), textEl = host?.querySelector('.text-node-content');
  if (!host || !textEl) return;
  editingTextNodeId = id; inlineTextSnapshot = getSnapshot();
  host.classList.add('inline-editing');
  textEl.setAttribute('contenteditable','plaintext-only'); textEl.setAttribute('spellcheck','true');
  textEl.oninput = () => {
    if (finishingInlineText) return;
    node.name = textEl.textContent.replace(/\r/g,'') || '';
    applyInlineTextSize(node, textEl);
    // Restore the caret at the end after resizing the box.
    const range = document.createRange(); range.selectNodeContents(textEl); range.collapse(false);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  };
  textEl.onkeydown = e => {
    if (e.key==='Escape') { e.preventDefault(); finishInlineTextEdit(false); }
    else if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); finishInlineTextEdit(true); }
  };
  textEl.onblur = () => finishInlineTextEdit(true);
  textEl.focus();
  const range = document.createRange(); range.selectNodeContents(textEl);
  const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  setStatus('Editando texto · Enter guarda · Shift+Enter nueva línea · Esc cancela');
}

function finishInlineTextEdit(commit) {
  if (!editingTextNodeId || finishingInlineText) return;
  finishingInlineText = true;
  const id = editingTextNodeId, snapshot = inlineTextSnapshot;
  const node = nodes.find(n => n.id===id), host = document.getElementById(id);
  const textEl = host?.querySelector('.text-node-content');
  if (textEl) {
    textEl.oninput = textEl.onkeydown = textEl.onblur = null;
    textEl.removeAttribute('contenteditable'); textEl.removeAttribute('spellcheck');
  }
  host?.classList.remove('inline-editing');
  editingTextNodeId = null; inlineTextSnapshot = null;
  if (!commit && snapshot) {
    applySnapshot(snapshot); setStatus('Edición de texto cancelada');
  } else if (node && snapshot) {
    node.name = (textEl?.textContent || '').trim() || 'Texto';
    autoFitTextNode(node); renderNode(node); distributePortLinks(id); renderLinks(); updatePropsPanel();
    const old = snapshot.nodes.find(n => n.id===id);
    const changed = !old || old.name!==node.name || old.w!==node.w || old.h!==node.h;
    const touching = links.filter(l => l.from===id || l.to===id).map(l => l.id);
    const reverted = changed && revertIfLinksOverlap(snapshot,touching);
    if (changed && !reverted) pushHistory();
    savedStateForCancel = null;
    if (!reverted) setStatus('Texto actualizado');
  }
  finishingInlineText = false;
}

function updateHint() { document.getElementById('drop-hint').classList.toggle('hidden', nodes.length > 0); }
function updateCounter() { document.getElementById('node-count').textContent = `Nodos: ${nodes.length} | Enlaces: ${links.length}`; }

// ════════════════════════════════════════════════════
// CANVAS CLICK
// ════════════════════════════════════════════════════
// Pan start on canvas background
document.getElementById('canvas-wrap').addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const onNode    = e.target.closest('.node');
  const onBanner  = e.target.closest('#place-banner');
  const onLinkGrp = e.target.closest('.link-group');
  const onWpHandle   = e.target.dataset.wpHandle;
  const onConnHandle = e.target.dataset.connHandle;
  if (onNode || onBanner || onLinkGrp || onWpHandle || onConnHandle || placingItem || currentTool === 'link') return;
  // Ctrl/Cmd + drag on empty canvas = pan the canvas (always pan in presentation mode).
  if (presentationMode || e.ctrlKey || e.metaKey) {
    isPanning = true; panMoved = false;
    panStartMouseX = e.clientX;
    panStartMouseY = e.clientY;
    panStartX = panX;
    panStartY = panY;
    document.getElementById('canvas-wrap').style.cursor = 'grabbing';
    e.preventDefault();
    return;
  }
  // Plain drag on empty canvas = area (marquee) selection. Shift adds to current selection.
  const p = getCanvasPos(e);
  marquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive: e.shiftKey };
  if (!marquee.additive) clearSelection();
  let m = document.getElementById('marquee-rect');
  if (!m) { m = document.createElement('div'); m.id = 'marquee-rect'; m.className = 'marquee-rect'; document.getElementById('canvas').appendChild(m); }
  updateMarqueeEl();
  setStatus('Selección de área… suelta para seleccionar');
  e.preventDefault();
});

document.getElementById('canvas-wrap').addEventListener('click', e => {
  if (justMarqueed) { justMarqueed = false; return; } // suppress click after area selection
  if (textRotatedFlag) { textRotatedFlag = false; return; }
  if (panMoved) { panMoved = false; return; } // suppress click after pan drag
  const onNode = e.target.closest('.node');
  if (presentationMode && !onNode) { hidePresentationInfo(); return; }
  if (placingItem && !onNode) {
    const pos = getCanvasPos(e);
    const placedLabel = placingItem.label;
    const isChart = placingItem.type === 'chart';
    const savedPlacingEl = placingItem.el;
    const id = createNode(placingItem.type, placingItem.icon, placingItem.label, snap(pos.x), snap(pos.y),
      placingItem.w, placingItem.h, placingItem.extra || {});
    selectNode(id);
    cancelPlacing();
    if (isChart) {
      openChartWizard(id);
    } else {
      if (multiPlacementEnabled) activatePlacing(savedPlacingEl);
      setStatus(`${placedLabel} colocado en (${snap(pos.x)}, ${snap(pos.y)})${multiPlacementEnabled ? ' · coloca otro o presiona Esc' : ''}`);
    }
    return;
  }
  if (!onNode) {
    if (linkStart) {
      const pos = getCanvasPos(e);
      commitLinkWaypoint({ x:snap(pos.x), y:snap(pos.y) });
      return;
    }
    clearSelection();
  }
});

function renderPendingLinkWaypoints() {
  document.querySelectorAll('.link-wp-dot').forEach(dot => dot.remove());
  const svg = document.getElementById('links-svg');
  linkWaypoints.forEach(wp => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
    dot.setAttribute('cx', wp.x); dot.setAttribute('cy', wp.y); dot.setAttribute('r', '5');
    dot.setAttribute('fill', '#0DBFA6'); dot.setAttribute('stroke', '#070C13');
    dot.setAttribute('stroke-width', '2'); dot.setAttribute('pointer-events', 'none');
    dot.classList.add('link-wp-dot');
    svg.appendChild(dot);
  });
}

function commitLinkWaypoint(point) {
  if (!linkStart) return;
  const from = nodes.find(node => node.id === linkStart.nodeId); if (!from) return;
  const start = getLinkPortPos(from, linkStart.port || 'center', linkStart.fromOffset || 0);
  // Store the real orthogonal vertices already shown to the user. Future mouse
  // movement may extend the route, but can no longer reinterpret prior bends.
  const committed = buildVertices([start, ...linkWaypoints, point], linkStart.port || 'center');
  linkWaypoints = committed.slice(1).filter((current, index, list) =>
    index === 0 || current.x !== list[index - 1].x || current.y !== list[index - 1].y);
  renderPendingLinkWaypoints();
  setStatus(`Tramo fijado en (${point.x}, ${point.y}) — ${linkWaypoints.length} punto(s) · clic en destino para conectar`);
}

// ════════════════════════════════════════════════════
// MOUSE MOVE
// ════════════════════════════════════════════════════
document.addEventListener('mousemove', e => {
  // Pan canvas
  if (isPanning) {
    const dx = e.clientX - panStartMouseX, dy = e.clientY - panStartMouseY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panMoved = true;
    panX = panStartX + dx;
    panY = panStartY + dy;
    applyTransform();
    return;
  }

  if (marquee) {
    const p = getCanvasPos(e);
    marquee.x1 = p.x; marquee.y1 = p.y;
    updateMarqueeEl();
    return;
  }

  const pos = getCanvasPos(e);
  document.getElementById('coord-display').textContent = `x:${Math.round(pos.x)}  y:${Math.round(pos.y)}`;

  if (rotatingTextNode) {
    const n = nodes.find(x => x.id === rotatingTextNode);
    if (!n) return;
    const pointerAngle = Math.atan2(pos.y - n.y, pos.x - n.x) * 180 / Math.PI;
    let angle = textRotateStartAngle + pointerAngle - textRotateStartPointer;
    angle = ((angle % 360) + 360) % 360;
    n.textRotation = e.shiftKey ? Math.round(angle / 15) * 15 % 360 : Math.round(angle) % 360;
    textRotatedFlag = n.textRotation !== textRotateStartAngle;
    renderNode(n); updatePropsPanel();
    setStatus(`Rotación: ${n.textRotation}°${e.shiftKey ? ' · ajuste de 15°' : ''}`);
    return;
  }

  if (placingItem) {
    const wrap = document.getElementById('canvas-wrap').getBoundingClientRect();
    const pv = document.getElementById('place-preview');
    pv.style.left = (e.clientX - wrap.left) + 'px';
    pv.style.top  = (e.clientY - wrap.top)  + 'px';
  }

  if (draggingNode) {
    const n = nodes.find(x => x.id === draggingNode);
    if (!n) return;
    nodeDraggedFlag = true;
    const newX = snap(pos.x - dragOffX), newY = snap(pos.y - dragOffY);
    if (dragGroupStart.length > 1) {
      const primary = dragGroupStart.find(g => g.id === draggingNode);
      const dx = newX - primary.x, dy = newY - primary.y;
      dragGroupStart.forEach(g => {
        const gn = nodes.find(x => x.id === g.id); if (!gn) return;
        gn.x = g.x + dx; gn.y = g.y + dy;
        distributePortLinks(g.id); renderNode(gn);
      });
      dragGroupWps.forEach(g => {
        const l = links.find(x => x.id === g.id); if (!l) return;
        l.waypoints = g.wps.map(p => ({ x: snap(p.x + dx), y: snap(p.y + dy) }));
      });
      renderLinks(); showPosBadge(newX, newY); updatePropsPanel();
      setStatus(`Moviendo ${dragGroupStart.length} nodos  →  x:${newX}  y:${newY}`);
    } else {
      n.x = newX; n.y = newY;
      distributePortLinks(draggingNode);
      renderNode(n); renderLinks(); showPosBadge(n.x, n.y); updatePropsPanel();
      setStatus(`Moviendo ${n.name}  →  x:${n.x}  y:${n.y}`);
    }
    return;
  }

  if (resizingNode) {
    const n = nodes.find(x => x.id === resizingNode);
    if (!n) return;
    const dx = pos.x - resizeStartX, dy = pos.y - resizeStartY;
    const dir = resizeDir;
    const resizeTargets = resizeGroupStart.length ? resizeGroupStart : [{id:n.id,w:resizeOrigW,h:resizeOrigH,x:resizeOrigX,y:resizeOrigY}];
    const centeredGroupResize = resizeTargets.length > 1;
    resizeTargets.forEach(original => {
      const target = nodes.find(node => node.id === original.id); if (!target) return;
      const textMinimum = target.type === 'text' ? getTextNodeAutoSize(target) : {w:32,h:32};
      let nextW = original.w, nextH = original.h, nextX = original.x, nextY = original.y;
      if (dir.includes('e')) {
        nextW = Math.max(textMinimum.w, snap(original.w + dx));
        nextX = original.x + (nextW - original.w) / 2;
      }
      if (dir.includes('s')) {
        nextH = Math.max(textMinimum.h, snap(original.h + dy));
        nextY = original.y + (nextH - original.h) / 2;
      }
      if (dir.includes('w')) {
        nextW = Math.max(textMinimum.w, snap(original.w - dx));
        nextX = original.x + (original.w - nextW) / 2;
      }
      if (dir.includes('n')) {
        nextH = Math.max(textMinimum.h, snap(original.h - dy));
        nextY = original.y + (original.h - nextH) / 2;
      }
      // A multi-resize changes only dimensions. Keeping every center fixed
      // prevents connected links from being dragged or rerouted by a corner.
      if (centeredGroupResize) { nextX = original.x; nextY = original.y; }
      target.w = nextW; target.h = nextH; target.x = nextX; target.y = nextY;
      target.sizeOverride = true;
      if (!centeredGroupResize) distributePortLinks(target.id);
      renderNode(target);
    });
    renderLinks(); showPosBadge(n.x, n.y); updatePropsPanel();
    setStatus(resizeTargets.length > 1
      ? `Redimensionando ${resizeTargets.length} nodos`
      : `Tamaño: ${n.w}×${n.h}  pos: ${n.x},${n.y}`);
    return;
  }

  if (draggingConnHandle) {
    const { linkId, isFrom, nodeId } = draggingConnHandle;
    const l = links.find(x => x.id === linkId);
    const n = nodes.find(x => x.id === nodeId);
    if (l && n) {
      // Determine nearest side by projecting cursor onto each axis (normalized by half-dims)
      const dx = pos.x - n.x, dy = pos.y - n.y;
      const hw = n.w / 2, hh = n.h / 2;
      const best = ['left','right','top','bottom'].reduce((b, side) => {
        const score = side==='left' ? -(dx/hw) : side==='right' ? (dx/hw)
                    : side==='top'  ? -(dy/hh) :                   (dy/hh);
        return score > b.score ? {side, score} : b;
      }, {side:'bottom', score:-Infinity});
      const newPort = best.side;
      const isHoriz = newPort === 'top' || newPort === 'bottom';
      const raw     = isHoriz ? (pos.x - n.x) : (pos.y - n.y);
      const allSlots = Array.from({length:PORT_SLOT_COUNT}, (_, i) => i + 1);
      const slot = allSlots.reduce((bestSlot, candidate) =>
        Math.abs(portSlotOffset(n, newPort, candidate) - raw) < Math.abs(portSlotOffset(n, newPort, bestSlot) - raw)
          ? candidate : bestSlot, allSlots[0]);
      if (usedPortSlots(nodeId, newPort, l.id).has(slot)) {
        if (draggingConnHandle.collisionSlot !== `${newPort}:${slot}`) {
          draggingConnHandle.collisionSlot = `${newPort}:${slot}`;
          showToast(`La posición ${slot} del lado ${portSideLabel(newPort)} ya está ocupada.`, 'error');
        }
        setStatus(`⚠ Posición ${slot} ocupada`);
        return;
      }
      draggingConnHandle.collisionSlot = null;
      setEndpointSlot(l, nodeId, newPort, slot);
      renderLinks();
    }
    return;
  }

  if (draggingWaypoint) {
    const l = links.find(x => x.id === draggingWaypoint.linkId); if (l) {
      l.waypoints[draggingWaypoint.wpIndex] = { x: snap(pos.x), y: snap(pos.y) };
      renderLinks();
    }
    return;
  }

  if (draggingDivider) {
    const l = links.find(x => x.id === draggingDivider.linkId);
    if (l) {
      l.dividerPosition = closestPolylinePercentage(getLinkVertices(l), pos);
      l.dividerPositionOverride = true;
      renderLinks();
      const value = document.getElementById('divider-position-value');
      const slider = document.getElementById('divider-position-slider');
      if (value) value.textContent = `${l.dividerPosition}%`;
      if (slider) slider.value = l.dividerPosition;
      setStatus(`Posición del divisor: ${l.dividerPosition}%`);
    }
    return;
  }

  if (draggingUsageLabel) {
    const l = links.find(x => x.id === draggingUsageLabel.linkId);
    if (l) {
      const split = splitPathAtMidpoint(getLinkVertices(l), 'center', l.dividerPosition ?? 50);
      const sideVertices = draggingUsageLabel.side === 'in' ? split.first : split.second;
      const field = draggingUsageLabel.side === 'in' ? 'usageLabelInPosition' : 'usageLabelOutPosition';
      l[field] = closestPolylinePercentage(sideVertices, pos);
      renderLinks();
      setStatus(`Etiqueta de ${draggingUsageLabel.side === 'in' ? 'entrada' : 'salida'}: ${l[field]}% de su lado`);
    }
    return;
  }

  if (linkStart && linkPreviewEl) {
    const from = nodes.find(x => x.id === linkStart.nodeId);
    if (from) {
      const sp = getLinkPortPos(from, linkStart.port || 'center', linkStart.fromOffset || 0);
      const allPts = [sp, ...linkWaypoints, { x: pos.x, y: pos.y }];
      linkPreviewEl.setAttribute('d', buildFullPath(allPts, linkStart.port || 'center'));
    }
  }
});

document.addEventListener('mouseup', () => {
  if (marquee) { finalizeMarquee(); return; }
  const wasDraggingNode    = !!draggingNode && nodeDraggedFlag;
  const wasResizing        = !!resizingNode;
  const wasRotating        = !!rotatingTextNode && textRotatedFlag;
  const wasDraggingWp      = !!draggingWaypoint;
  const wasDraggingConn    = !!draggingConnHandle;
  const dividerDrag = draggingDivider;
  const wasDraggingDivider = !!dividerDrag;
  const usageLabelDrag = draggingUsageLabel;
  const wasDraggingUsageLabel = !!usageLabelDrag;
  const groupDragIds = (draggingNode && nodeDraggedFlag && dragGroupStart.length > 1) ? dragGroupStart.map(g => g.id) : null;
  const resizedNodeIds = resizingNode ? (resizeGroupStart.length ? resizeGroupStart.map(item => item.id) : [resizingNode]) : [];
  const movedNodeIds = groupDragIds || (draggingNode ? [draggingNode] : resizedNodeIds.length ? resizedNodeIds : rotatingTextNode ? [rotatingTextNode] : []);
  const preferredLinkIds = draggingWaypoint ? [draggingWaypoint.linkId]
    : draggingConnHandle ? [draggingConnHandle.linkId]
    : movedNodeIds.length
      ? links.filter(l => movedNodeIds.includes(l.from) || movedNodeIds.includes(l.to)).map(l => l.id)
      : [];

  if (draggingNode || resizingNode) setStatus('Listo');
  const resizedId = resizingNode ?? null;
  const rotatedId = rotatingTextNode ?? null;
  const draggedId = (draggingNode && nodeDraggedFlag) ? draggingNode : null;
  draggingNode = null; resizingNode = null; resizeDir = '';
  rotatingTextNode = null;
  setTimeout(() => { textRotatedFlag = false; }, 0);
  if (rotatedId) document.getElementById(rotatedId)?.classList.remove('rotating-text');
  if (draggingWaypoint)    { draggingWaypoint = null; renderLinks(); }
  if (draggingConnHandle)  { draggingConnHandle = null; }
  draggingDivider = null;
  draggingUsageLabel = null;
  if (isPanning) { isPanning = false; document.getElementById('canvas-wrap').style.cursor = ''; }

  // After resize or move: redistribute link offsets to match new size/position
  if (resizedId) {
    if (resizedNodeIds.length === 1) resizedNodeIds.forEach(distributePortLinks);
    renderLinks();
  }
  if (draggedId) { (groupDragIds || [draggedId]).forEach(distributePortLinks); renderLinks(); }
  if (rotatedId) {
    const n = nodes.find(x => x.id === rotatedId);
    if (n) { autoFitTextNode(n); distributePortLinks(rotatedId); renderNode(n); renderLinks(); updatePropsPanel(); }
  }

  // Commit after any completed drag — push AFTER the change so history is correct
  if (wasDraggingNode || wasResizing || wasRotating || wasDraggingWp || wasDraggingConn) {
    // Endpoint-grid edits are explicit user placement; never reroute them automatically.
    const reverted = !wasDraggingConn && geometryChangeSnapshot && revertIfLinksOverlap(geometryChangeSnapshot, preferredLinkIds);
    if (!reverted) {
      pushHistory();
      // For node/resize drags, clear the cancel snapshot — for waypoint/conn drags
      // keep it so ESC can still revert all changes since the link was selected
      if (wasDraggingNode || wasResizing || wasRotating) savedStateForCancel = null;
    }
  }
  if (wasDraggingDivider) {
    const l = links.find(x => x.id === dividerDrag.linkId);
    if (l && l.dividerPosition !== dividerDrag.startPosition) pushHistory();
    updatePropsPanel();
  }
  if (wasDraggingUsageLabel) {
    const l = links.find(x => x.id === usageLabelDrag.linkId);
    const field = usageLabelDrag.side === 'in' ? 'usageLabelInPosition' : 'usageLabelOutPosition';
    if (l && l[field] !== usageLabelDrag.startPosition) pushHistory();
  }
  if (rotatedId && !wasRotating) savedStateForCancel = null;
  geometryChangeSnapshot = null;
  resizeGroupStart = [];
});

// ════════════════════════════════════════════════════
// DRAG / RESIZE / LINK START
// ════════════════════════════════════════════════════
function onNodeMouseDown(e, id) {
  if (customAlignmentPending) { e.stopPropagation(); e.preventDefault(); return; }
  if (e.button !== 0 || currentTool === 'link' || placingItem) return;
  e.stopPropagation(); e.preventDefault();
  // Modifier-click is a selection gesture (handled in click), not a drag.
  if (e.shiftKey || e.ctrlKey || e.metaKey) { nodeDraggedFlag = false; return; }
  geometryChangeSnapshot = getSnapshot();
  saveForCancel();
  nodeDraggedFlag = false;
  // If this node belongs to the current selection (directly or as a selected link's endpoint),
  // drag the whole group; otherwise select just this node.
  const effective = effectiveDragNodeIds();
  const groupDrag = effective.has(id) && effective.size > 1;
  if (groupDrag) {
    if (selectedNodeIds.has(id)) selectedId = id;
    updatePropsPanel();
  } else {
    selectNode(id);
  }
  draggingNode = id;
  const n = nodes.find(x => x.id === id);
  const pos = getCanvasPos(e);
  dragOffX = pos.x - n.x; dragOffY = pos.y - n.y;
  const dragIds = groupDrag ? [...effective] : [id];
  dragGroupStart = dragIds.map(sid => {
    const sn = nodes.find(x => x.id === sid);
    return sn ? { id: sid, x: sn.x, y: sn.y } : null;
  }).filter(Boolean);
  // Links whose BOTH endpoints move: capture waypoints so they translate rigidly with the group.
  const dragSet = new Set(dragIds);
  dragGroupWps = links
    .filter(l => dragSet.has(l.from) && dragSet.has(l.to) && (l.waypoints || []).length)
    .map(l => ({ id: l.id, wps: l.waypoints.map(p => ({ x: p.x, y: p.y })) }));
}
function onResizeStart(e, id, dir) {
  e.stopPropagation(); e.preventDefault();
  const n = nodes.find(x => x.id === id); if (!n) return;
  geometryChangeSnapshot = getSnapshot();
  saveForCancel();
  resizingNode = id; resizeDir = dir;
  const pos = getCanvasPos(e);
  resizeStartX = pos.x; resizeStartY = pos.y;
  resizeOrigW = n.w; resizeOrigH = n.h; resizeOrigX = n.x; resizeOrigY = n.y;
  const resizeIds = selectedNodeIds.has(id) && selectedNodeIds.size > 1 ? [...selectedNodeIds] : [id];
  resizeGroupStart = resizeIds.map(nodeId => {
    const node = nodes.find(item => item.id === nodeId);
    return node ? {id:node.id, w:node.w, h:node.h, x:node.x, y:node.y} : null;
  }).filter(Boolean);
  if (resizeIds.length === 1) selectNode(id);
}
function onTextRotateStart(e, id) {
  if (e.button !== 0 || currentTool === 'link' || placingItem) return;
  e.stopPropagation(); e.preventDefault();
  const n = nodes.find(x => x.id === id); if (!n || n.type !== 'text') return;
  if (editingTextNodeId === id) finishInlineTextEdit(true);
  geometryChangeSnapshot = getSnapshot();
  saveForCancel();
  rotatingTextNode = id;
  textRotatedFlag = false;
  const pos = getCanvasPos(e);
  textRotateStartPointer = Math.atan2(pos.y - n.y, pos.x - n.x) * 180 / Math.PI;
  textRotateStartAngle = Number(n.textRotation) || 0;
  selectNode(id);
  document.getElementById(id)?.classList.add('rotating-text');
  setStatus('Arrastra el rombo para girar · Shift ajusta cada 15°');
}
function startLink(nodeId, requestedPort, pointer = null) {
  linkWaypoints = [];
  document.querySelectorAll('.link-wp-dot').forEach(d => d.remove());
  const n = nodes.find(x => x.id === nodeId);
  const port = resolvePointerPort(n, requestedPort, pointer);
  const slot = closestFreePortSlot(nodeId, port, pointer);
  if (slot === null) {
    showAlert(`El lado ${portSideLabel(port)} de "${n.name}" ya tiene ${PORT_SLOT_COUNT} enlaces. Selecciona otro lado o reorganiza sus posiciones.`, 'Lado completo');
    return;
  }
  const fromOffset = portSlotOffset(n, port, slot);
  const pp = getLinkPortPos(n, port, fromOffset);
  linkStart = { nodeId, port, fromSlot:slot, fromOffset, px: pp.x, py: pp.y };
  if (!linkPreviewEl) {
    linkPreviewEl = document.createElementNS('http://www.w3.org/2000/svg','path');
    linkPreviewEl.classList.add('link-preview');
    document.getElementById('links-svg').appendChild(linkPreviewEl);
  }
  const portName = port === 'center' ? 'nodo' : `puerto ${port}`;
  setStatus(`Origen: ${n.name} (${portName}) — clic para quiebre · clic en destino para conectar · Esc cancela`);
}

function onNodeClickForLink(toId, requestedPort, pointer = null) {
  if (!linkStart || linkStart.nodeId === toId) return;
  const target = nodes.find(node => node.id === toId);
  const toPort = resolvePointerPort(target, requestedPort, pointer);
  const toSlot = closestFreePortSlot(toId, toPort, pointer);
  if (toSlot === null) {
    showAlert(`El lado ${portSideLabel(toPort)} de "${target?.name || 'este nodo'}" ya tiene ${PORT_SLOT_COUNT} enlaces. Selecciona otro lado o reorganiza sus posiciones.`, 'Lado completo');
    return;
  }
  linkCounter++;
  const newLinkId = 'l' + linkCounter;
  const iP = Math.floor(Math.random()*100), oP = Math.floor(Math.random()*100);
  links.push({
    id: newLinkId,
    from: linkStart.nodeId, fromPort: linkStart.port || 'center', fromSlot:linkStart.fromSlot,
    fromOffset: linkStart.fromOffset,
    to: toId, toPort:toPort || 'center', toSlot,
    toOffset: portSlotOffset(target, toPort, toSlot),
    fromPortLocked: (linkStart.port || 'center') !== 'center', toPortLocked: (toPort || 'center') !== 'center',
    inPct:0, outPct:0, editorInPct:iP, editorOutPct:oP,
    usageLabelInPosition:50, usageLabelOutPosition:50,
    capacity:100, capacityUnit:'Mbps', inUsage:0, outUsage:0,
    dataSource:null, telemetryError:null, telemetryTimestamp:null,
    usageLabelPosition:generalConfig.usageLabelPosition,
    usageLabelRotate:generalConfig.usageLabelRotate,
    usageLabelFlip:generalConfig.usageLabelFlip,
    usageLabelFormat:generalConfig.usageLabelFormat, usageLabelOverride:false,
    capacityLabelVisible:generalConfig.capacityLabelVisible,
    capacityLabelSide:generalConfig.capacityLabelSide,
    capacityLabelRotate:generalConfig.capacityLabelRotate, capacityLabelFlip:generalConfig.capacityLabelFlip,
    capacityLabelFontSize:generalConfig.capacityLabelFontSize,
    capacityLabelOverride:false,
    description:'', width:generalConfig.linkWidth,
    midTermination:generalConfig.midTermination,
    dividerPosition:generalConfig.dividerPosition,
    dividerPositionOverride:false, styleOverride:false,
    scaleOverride:false, scale:null,
    routeLane: 0,
    waypoints: [...linkWaypoints]
  });
  const newLink = links[links.length - 1];
  // Assign only missing legacy slots. Existing endpoints never move when a link is added.
  distributePortLinks(linkStart.nodeId);
  distributePortLinks(toId);
  // Keep the planned route: only make room for double-arrow markers, do NOT auto-reroute.
  ensureDoubleArrowRoom(newLink);
  cancelLink(); renderLinks(); updateCounter();
  pushHistory();
  setStatus(`Enlace creado — In: ${iP}%  Out: ${oP}%`);
}

function cancelLink() {
  linkStart = null; linkWaypoints = [];
  document.querySelectorAll('.link-wp-dot').forEach(d => d.remove());
  linkPreviewEl?.remove(); linkPreviewEl = null;
}

// ════════════════════════════════════════════════════
// PORT POSITIONS & ORTHOGONAL ROUTING
// ════════════════════════════════════════════════════
function getPortPos(node, port, offset = 0) {
  const hw = node.w / 2, hh = node.h / 2;
  // offset: pixels along the edge from center (clamped to 80% of half-edge)
  const maxH = hw * 0.8, maxV = hh * 0.8;
  const oh = Math.max(-maxH, Math.min(maxH, offset));
  const ov = Math.max(-maxV, Math.min(maxV, offset));
  switch (port) {
    case 'top':    return { x: node.x + oh, y: node.y - hh };
    case 'bottom': return { x: node.x + oh, y: node.y + hh };
    case 'left':   return { x: node.x - hw, y: node.y + ov };
    case 'right':  return { x: node.x + hw, y: node.y + ov };
    default:       return { x: node.x,      y: node.y      };
  }
}

function portSlotOffset(node, port, slot) {
  const normalizedSlot = Math.max(1, Math.min(PORT_SLOT_COUNT, Number(slot) || 1));
  const isHoriz = port === 'top' || port === 'bottom';
  const limit = ((isHoriz ? node.w : node.h) / 2) * 0.75;
  return -limit + (normalizedSlot - 1) * ((limit * 2) / (PORT_SLOT_COUNT - 1));
}

function endpointSlot(link, nodeId) {
  return link.from === nodeId ? Number(link.fromSlot) : Number(link.toSlot);
}

function usedPortSlots(nodeId, port, exceptLinkId = null) {
  return new Set(links.flatMap(link => {
    if (link.id === exceptLinkId) return [];
    if (link.from === nodeId && (link.fromPort || 'center') === port && Number.isInteger(Number(link.fromSlot)))
      return [Number(link.fromSlot)];
    if (link.to === nodeId && (link.toPort || 'center') === port && Number.isInteger(Number(link.toSlot)))
      return [Number(link.toSlot)];
    return [];
  }).filter(slot => slot >= 1 && slot <= PORT_SLOT_COUNT));
}

function firstFreePortSlot(nodeId, port, exceptLinkId = null) {
  const used = usedPortSlots(nodeId, port, exceptLinkId);
  for (let slot = 1; slot <= PORT_SLOT_COUNT; slot++) if (!used.has(slot)) return slot;
  return null;
}

function resolvePointerPort(node, requestedPort, pointer) {
  if (!node || requestedPort !== 'center' || !pointer) return requestedPort;
  const distances = {
    top:Math.abs(pointer.y - (node.y - node.h / 2)),
    bottom:Math.abs(pointer.y - (node.y + node.h / 2)),
    left:Math.abs(pointer.x - (node.x - node.w / 2)),
    right:Math.abs(pointer.x - (node.x + node.w / 2))
  };
  return Object.keys(distances).reduce((best, side) => distances[side] < distances[best] ? side : best, 'top');
}

function closestFreePortSlot(nodeId, port, pointer = null, exceptLinkId = null) {
  const node = nodes.find(item => item.id === nodeId);
  if (!node) return null;
  const used = usedPortSlots(nodeId, port, exceptLinkId);
  const available = Array.from({length:PORT_SLOT_COUNT}, (_, index) => index + 1).filter(slot => !used.has(slot));
  if (!available.length) return null;
  if (!pointer) {
    // Programmatic calls default to the physical center, not the left/top edge.
    pointer = {x:node.x, y:node.y};
  }
  const requestedOffset = port === 'top' || port === 'bottom' ? pointer.x - node.x : pointer.y - node.y;
  return available.reduce((best, candidate) =>
    Math.abs(portSlotOffset(node, port, candidate) - requestedOffset) < Math.abs(portSlotOffset(node, port, best) - requestedOffset)
      ? candidate : best, available[0]);
}

function portSideLabel(port) {
  return {top:'superior', bottom:'inferior', left:'izquierdo', right:'derecho'}[port] || port;
}

function setEndpointSlot(link, nodeId, port, slot) {
  const node = nodes.find(item => item.id === nodeId);
  if (!node || !slot) return false;
  const offset = portSlotOffset(node, port, slot);
  if (link.from === nodeId) {
    link.fromPort = port; link.fromSlot = slot; link.fromOffset = offset; link.fromPortLocked = true;
  } else if (link.to === nodeId) {
    link.toPort = port; link.toSlot = slot; link.toOffset = offset; link.toPortLocked = true;
  } else return false;
  return true;
}

function getLinkPortPos(node, port, offset = 0) {
  const pos = getPortPos(node, port, offset);
  const padding = Math.max(0, Math.min(100, Number(node.linkPadding ?? DEFAULT_LINK_PADDING) || 0));
  if (port === 'top') pos.y -= padding;
  else if (port === 'bottom') pos.y += padding;
  else if (port === 'left') pos.x -= padding;
  else if (port === 'right') pos.x += padding;
  return pos;
}

// ─── Waypoint-aware path builder ───────────────────
// Waypoints ARE corner points. Between any two consecutive control points
// the path is straight (if axis-aligned) or makes exactly ONE 90° turn.

function goHorizontalFirst(p1, p2, exitPort) {
  if (exitPort === 'left' || exitPort === 'right') return true;
  if (exitPort === 'top'  || exitPort === 'bottom') return false;
  return Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y);
}

// Expand control points into actual rendered vertices (adding auto-corners).
function buildVertices(allPts, fromPort) {
  const v = [{ x: allPts[0].x, y: allPts[0].y }];
  for (let i = 0; i < allPts.length - 1; i++) {
    const p1 = allPts[i], p2 = allPts[i + 1];
    if (p1.x !== p2.x && p1.y !== p2.y) {
      const port = i === 0 ? (fromPort || 'center') : 'center';
      if (goHorizontalFirst(p1, p2, port)) v.push({ x: p2.x, y: p1.y }); // corner: go H then V
      else                                  v.push({ x: p1.x, y: p2.y }); // corner: go V then H
    }
    v.push({ x: p2.x, y: p2.y });
  }
  return v;
}

function endpointApproachPoint(point, port, distance = Math.max(12, GRID)) {
  if (port === 'top') return {x:point.x, y:point.y-distance};
  if (port === 'bottom') return {x:point.x, y:point.y+distance};
  if (port === 'left') return {x:point.x-distance, y:point.y};
  if (port === 'right') return {x:point.x+distance, y:point.y};
  return {...point};
}

function uniqueVertices(vertices) {
  return vertices.filter((point, index) => index === 0 ||
    point.x !== vertices[index-1].x || point.y !== vertices[index-1].y);
}

// Remove a short terminal "step" without rebuilding the route. The adjacent
// straight run is shifted by only the height/width of that step, so the link
// reaches and leaves the node as one clean segment.
function straightenTerminalHooks(vertices, tolerance = GRID) {
  const result = vertices.map(point => ({...point}));
  const horizontal = (a, b) => a.y === b.y && a.x !== b.x;
  const vertical = (a, b) => a.x === b.x && a.y !== b.y;

  if (result.length >= 4) {
    const p0 = result[0], p1 = result[1], p2 = result[2];
    if (horizontal(p0, p1) && vertical(p1, p2) && Math.abs(p2.y - p1.y) <= tolerance) {
      const oldY = p2.y;
      for (let index = 2; index < result.length; index++) {
        if (index > 2 && result[index].y !== oldY) break;
        result[index].y = p0.y;
      }
    } else if (vertical(p0, p1) && horizontal(p1, p2) && Math.abs(p2.x - p1.x) <= tolerance) {
      const oldX = p2.x;
      for (let index = 2; index < result.length; index++) {
        if (index > 2 && result[index].x !== oldX) break;
        result[index].x = p0.x;
      }
    }
  }

  if (result.length >= 4) {
    const last = result.length - 1;
    const p0 = result[last], p1 = result[last - 1], p2 = result[last - 2];
    if (horizontal(p1, p0) && vertical(p2, p1) && Math.abs(p2.y - p1.y) <= tolerance) {
      const oldY = p2.y;
      for (let index = last - 2; index >= 0; index--) {
        if (index < last - 2 && result[index].y !== oldY) break;
        result[index].y = p0.y;
      }
    } else if (vertical(p1, p0) && horizontal(p2, p1) && Math.abs(p2.x - p1.x) <= tolerance) {
      const oldX = p2.x;
      for (let index = last - 2; index >= 0; index--) {
        if (index < last - 2 && result[index].x !== oldX) break;
        result[index].x = p0.x;
      }
    }
  }
  return uniqueVertices(result);
}

function automaticEndpointRoute(fromPoint, toPoint, fromPort, toPort, laneOffset = 0) {
  const dx = toPoint.x - fromPoint.x, dy = toPoint.y - fromPoint.y;
  const horizontal = port => port === 'left' || port === 'right' ||
    (port === 'center' && Math.abs(dx) >= Math.abs(dy));
  const fromHorizontal = horizontal(fromPort);
  const toHorizontal = horizontal(toPort);
  let vertices;
  if (fromHorizontal && toHorizontal) {
    // Close endpoints should share one axis even when a previous overlap pass
    // assigned a lane. Keeping that stale lane creates a tiny hook next to
    // the node; averaging the coordinate preserves the route almost exactly.
    if (Math.abs(dy) <= GRID) {
      const alignedY = (fromPoint.y + toPoint.y) / 2;
      return [{x:fromPoint.x, y:alignedY}, {x:toPoint.x, y:alignedY}];
    }
    const middleX = (fromPoint.x + toPoint.x) / 2 + laneOffset;
    vertices = [fromPoint, {x:middleX, y:fromPoint.y}, {x:middleX, y:toPoint.y}, toPoint];
  } else if (!fromHorizontal && !toHorizontal) {
    if (Math.abs(dx) <= GRID) {
      const alignedX = (fromPoint.x + toPoint.x) / 2;
      return [{x:alignedX, y:fromPoint.y}, {x:alignedX, y:toPoint.y}];
    }
    const middleY = (fromPoint.y + toPoint.y) / 2 + laneOffset;
    vertices = [fromPoint, {x:fromPoint.x, y:middleY}, {x:toPoint.x, y:middleY}, toPoint];
  } else if (fromHorizontal) {
    vertices = [fromPoint, {x:toPoint.x, y:fromPoint.y}, toPoint];
  } else {
    vertices = [fromPoint, {x:fromPoint.x, y:toPoint.y}, toPoint];
  }
  return uniqueVertices(vertices);
}

// A point contact is valid; sharing a positive-length collinear segment is not.
function segmentsShareLength(a, b, c, d, epsilon = 0.01) {
  const abHorizontal = Math.abs(a.y - b.y) <= epsilon;
  const cdHorizontal = Math.abs(c.y - d.y) <= epsilon;
  const abVertical = Math.abs(a.x - b.x) <= epsilon;
  const cdVertical = Math.abs(c.x - d.x) <= epsilon;

  if (abHorizontal && cdHorizontal && Math.abs(a.y - c.y) <= epsilon) {
    const overlap = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) -
                    Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
    return overlap > epsilon;
  }
  if (abVertical && cdVertical && Math.abs(a.x - c.x) <= epsilon) {
    const overlap = Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y)) -
                    Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
    return overlap > epsilon;
  }
  return false;
}

function pointToPolylineDistance(point, vertices) {
  let best = Infinity;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i], b = vertices[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq)) : 0;
    best = Math.min(best, Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)));
  }
  return best;
}

function getLinkVertices(link) {
  const from = nodes.find(n => n.id === link.from);
  const to = nodes.find(n => n.id === link.to);
  if (!from || !to) return [];
  const fp = getLinkPortPos(from, link.fromPort || 'center', link.fromOffset || 0);
  const tp = getLinkPortPos(to, link.toPort || 'center', link.toOffset || 0);
  const fromPort = link.fromPort || 'center';
  const toPort = link.toPort || 'center';
  if (!(link.waypoints || []).length) {
    return straightenTerminalHooks(automaticEndpointRoute(fp, tp, fromPort, toPort, (link.routeLane || 0) * GRID));
  }
  const startApproach = endpointApproachPoint(fp, fromPort);
  const endApproach = endpointApproachPoint(tp, toPort);
  const controls = uniqueVertices([fp, startApproach, ...(link.waypoints || []), endApproach, tp]);
  return straightenTerminalHooks(uniqueVertices(buildVertices(controls, fromPort)));
}

function findLinkOverlap(onlyLinkId = null) {
  for (let i = 0; i < links.length - 1; i++) {
    const aVerts = getLinkVertices(links[i]);
    for (let j = i + 1; j < links.length; j++) {
      if (onlyLinkId && links[i].id !== onlyLinkId && links[j].id !== onlyLinkId) continue;
      const bVerts = getLinkVertices(links[j]);
      for (let ai = 0; ai < aVerts.length - 1; ai++) {
        for (let bi = 0; bi < bVerts.length - 1; bi++) {
          if (segmentsShareLength(aVerts[ai], aVerts[ai + 1], bVerts[bi], bVerts[bi + 1]))
            return { first: links[i], second: links[j] };
        }
      }
    }
  }
  return null;
}

function tryAlternateLane(link) {
  if ((link.waypoints || []).length) return false;
  const original = link.routeLane || 0;
  for (let distance = 1; distance <= 500; distance++) {
    for (const lane of [distance, -distance]) {
      if (lane === original) continue;
      link.routeLane = lane;
      if (!findLinkOverlap(link.id)) return true;
    }
  }
  link.routeLane = original;
  return false;
}

function accommodateLinkOverlaps(preferredIds = []) {
  for (let guard = 0; guard < 200; guard++) {
    const overlap = findLinkOverlap();
    if (!overlap) return true;
    const pair = [overlap.first, overlap.second].sort((a, b) => {
      const ap = preferredIds.includes(a.id) ? 1 : 0;
      const bp = preferredIds.includes(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (parseInt(String(b.id).replace(/\D/g,''), 10) || 0) -
             (parseInt(String(a.id).replace(/\D/g,''), 10) || 0);
    });
    if (!pair.some(tryAlternateLane)) return false;
  }
  return false;
}

function revertIfLinksOverlap(snapshot, preferredIds = []) {
  const overlap = findLinkOverlap();
  if (!overlap) return false;
  if (accommodateLinkOverlaps(preferredIds)) {
    renderLinks(); updatePropsPanel();
    setStatus('✓ Enlaces acomodados automáticamente');
    return false;
  }
  applySnapshot(snapshot);
  setStatus(`⚠ Cambio deshecho: no fue posible separar ${overlap.first.id} y ${overlap.second.id}`);
  return true;
}

function buildFullPath(allPts, fromPort) {
  const v = buildVertices(allPts, fromPort);
  return v.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

// Split by traveled distance, not by vertex count. Ratio is measured from source to target.
function splitPathAtMidpoint(allPts, fromPort, percentage = 50) {
  const verts = buildVertices(allPts, fromPort);
  const lengths = verts.slice(0, -1).map((p, i) => Math.hypot(verts[i + 1].x - p.x, verts[i + 1].y - p.y));
  const total = lengths.reduce((sum, len) => sum + len, 0);
  if (total === 0) {
    const pt = verts[0] || { x: 0, y: 0 };
    return { first: [pt, pt], second: [pt, pt], midPt: pt };
  }

  const ratio = Math.max(5, Math.min(95, Number(percentage) || 50)) / 100;
  const target = total * ratio;
  let traveled = 0, segIdx = 0;
  while (segIdx < lengths.length - 1 && traveled + lengths[segIdx] < target) {
    traveled += lengths[segIdx++];
  }
  const a = verts[segIdx], b = verts[segIdx + 1];
  const t = lengths[segIdx] ? (target - traveled) / lengths[segIdx] : 0;
  const midPt = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return {
    first: [...verts.slice(0, segIdx + 1), midPt],
    second: [midPt, ...verts.slice(segIdx + 1)],
    midPt
  };
}

function verticesToPath(verts) {
  return verts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function metricsAtPolylinePercentage(verts, percentage = 50) {
  if (verts.length < 2) return {point:verts[0] || {x:0,y:0}, angle:0};
  const lengths = verts.slice(0,-1).map((p,i) => Math.hypot(verts[i+1].x-p.x, verts[i+1].y-p.y));
  const target = lengths.reduce((sum,length) => sum+length, 0) * Math.max(5,Math.min(95,Number(percentage)||50)) / 100;
  let traveled = 0;
  for (let i=0; i<lengths.length; i++) {
    if (traveled + lengths[i] >= target) {
      const a=verts[i], b=verts[i+1];
      const t=lengths[i] ? (target-traveled)/lengths[i] : 0;
      return {
        point:{x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t},
        angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI
      };
    }
    traveled += lengths[i];
  }
  const a=verts[verts.length-2], b=verts[verts.length-1];
  return {point:b, angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};
}

function formatUtilization(value) {
  const number = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(number) ? String(number) : String(number.toFixed(2)).replace(/0+$/,'').replace(/\.$/,'');
}

function formatPercentage(value) {
  const number = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function shortCapacityUnit(unit) {
  return {Kbps:'Kb', Mbps:'Mb', Gbps:'Gb', Tbps:'Tb'}[unit] || unit || 'Mb';
}

function formatHumanBandwidth(value, unit = 'Mbps') {
  const factors = {Kbps:1, Mbps:1e3, Gbps:1e6, Tbps:1e9};
  const kbps = Math.max(0, Number(value) || 0) * (factors[unit] || 1e3);
  const units = [['Tbps',1e9],['Gbps',1e6],['Mbps',1e3],['Kbps',1]];
  const [targetUnit, factor] = units.find(([,candidate]) => kbps >= candidate) || units[3];
  return `${formatUtilization(kbps / factor)} ${shortCapacityUnit(targetUnit)}`;
}

function formatUsageLabel(format, percentage, usage, unit) {
  return format === 'human'
    ? formatHumanBandwidth(usage, unit)
    : `${formatPercentage(percentage)}%`;
}

function closestPolylinePercentage(verts, point) {
  if (verts.length < 2) return 50;
  const lengths = verts.slice(0, -1).map((p, i) => Math.hypot(verts[i + 1].x - p.x, verts[i + 1].y - p.y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return 50;
  let traveled = 0, bestDistance = Infinity, bestLength = total / 2;
  for (let i = 0; i < lengths.length; i++) {
    const a = verts[i], b = verts[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((point.x-a.x)*dx + (point.y-a.y)*dy) / lengthSq)) : 0;
    const projected = {x:a.x + dx*t, y:a.y + dy*t};
    const distance = Math.hypot(point.x-projected.x, point.y-projected.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLength = traveled + lengths[i] * t;
    }
    traveled += lengths[i];
  }
  return Math.max(5, Math.min(95, Math.round(bestLength / total * 100)));
}

function trimPolylineEnd(verts, distance) {
  const out = verts.map(p => ({...p}));
  while (out.length > 1 && distance > 0) {
    const b = out[out.length - 1], a = out[out.length - 2];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 0.01) { out.pop(); continue; }
    if (distance < len) {
      const t = (len - distance) / len;
      out[out.length - 1] = { x:a.x + (b.x-a.x)*t, y:a.y + (b.y-a.y)*t };
      return out;
    }
    distance -= len;
    out.pop();
  }
  const p = out[0] || verts[0] || {x:0,y:0};
  return [p, {...p}];
}

function trimPolylineStart(verts, distance) {
  return trimPolylineEnd([...verts].reverse(), distance).reverse();
}

function doubleArrowMetrics(point, nextPoint, width) {
  const next = nextPoint || {x:point.x+1, y:point.y};
  const len = Math.hypot(next.x-point.x, next.y-point.y) || 1;
  const ux = (next.x-point.x)/len, uy = (next.y-point.y)/len;
  return {
    ux, uy, px:-uy, py:ux,
    size:Math.max(10, Math.min(24, width+8)),
    gap:Math.max(4, Math.min(10, width*0.65))
  };
}

function maxSegmentLength(verts) {
  return verts.slice(1).reduce((max, p, i) =>
    Math.max(max, Math.hypot(p.x-verts[i].x, p.y-verts[i].y)), 0);
}

function ensureDoubleArrowRoom(link) {
  if (link.midTermination !== 'arrows' || (link.waypoints || []).length) return true;
  const width = Math.max(1, Math.min(24, Number(link.width) || 6));
  const metrics = doubleArrowMetrics({x:0,y:0}, {x:1,y:0}, width);
  const required = 2 * (metrics.size + metrics.gap/2 + width/2);
  if (maxSegmentLength(getLinkVertices(link)) >= required) return true;
  const originalLane = link.routeLane || 0;
  for (let distance=1; distance<=80; distance++) {
    for (const lane of [distance, -distance]) {
      link.routeLane = lane;
      if (maxSegmentLength(getLinkVertices(link)) >= required && !findLinkOverlap(link.id)) return true;
    }
  }
  link.routeLane = originalLane;
  return false;
}

// ─── Draggable connection-point handles on selected node ───
function clearConnectionHandles() {
  document.querySelectorAll('.conn-handle, .conn-slot-grid').forEach(h => h.remove());
}
// Link mode: show only occupied fixed slots. Empty/next circles are intentionally hidden
// to keep the canvas quiet; a new link takes the first available slot automatically.
function renderLinkPointHints() {
  const svg = document.getElementById('overlay-svg');
  svg.querySelectorAll('.link-hint').forEach(el => el.remove());
  if (!document.body.classList.contains('linking') || presentationMode) return;
  const ns = 'http://www.w3.org/2000/svg';
  const sideCol = { top: '#0DBFA6', bottom: '#28C97A', left: '#F09A38', right: '#E86060' };
  nodes.forEach(node => {
    ['top', 'bottom', 'left', 'right'].forEach(side => {
      const onSide = links.filter(l =>
        (l.from === node.id && (l.fromPort || 'center') === side) ||
        (l.to === node.id && (l.toPort || 'center') === side)
      ).map(l => ({
        slot: endpointSlot(l, node.id),
        offset: l.from === node.id ? (l.fromOffset || 0) : (l.toOffset || 0)
      })).sort((a, b) => a.slot - b.slot);
      const col = sideCol[side];
      onSide.forEach(item => {
        const pos = getLinkPortPos(node, side, item.offset);
        const g = document.createElementNS(ns, 'g'); g.classList.add('link-hint');
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', pos.x); c.setAttribute('cy', pos.y); c.setAttribute('r', '9');
        c.setAttribute('fill', col);
        c.setAttribute('stroke', '#070C13');
        c.setAttribute('stroke-width', '1.5');
        g.appendChild(c);
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', pos.x); t.setAttribute('y', pos.y + 3.2);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '10');
        t.setAttribute('font-weight', '700'); t.setAttribute('fill', '#070C13');
        t.setAttribute('font-family', 'Consolas,monospace');
        t.textContent = String(item.slot);
        g.appendChild(t);
        svg.appendChild(g);
      });
    });
  });
}
function renderConnectionHandles(nodeId) {
  clearConnectionHandles();
  if (currentTool !== 'select') return;
  const n = nodes.find(x => x.id === nodeId); if (!n) return;
  const svg = document.getElementById('overlay-svg'); // renders above HTML nodes

  // Ten fixed positions per side. Occupied positions are solid; available ones
  // remain hollow so the user can see exactly where an endpoint may be moved.
  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  grid.classList.add('conn-slot-grid');
  const sideColors = {top:'#0DBFA6', bottom:'#28C97A', left:'#F09A38', right:'#E86060'};
  ['top','bottom','left','right'].forEach(side => {
    const occupied = usedPortSlots(nodeId, side);
    for (let slot = 1; slot <= PORT_SLOT_COUNT; slot++) {
      const pos = getPortPos(n, side, portSlotOffset(n, side, slot));
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', pos.x); dot.setAttribute('cy', pos.y); dot.setAttribute('r', occupied.has(slot) ? '5' : '3.5');
      dot.setAttribute('fill', occupied.has(slot) ? sideColors[side] : 'rgba(7,12,19,.78)');
      dot.setAttribute('stroke', sideColors[side]); dot.setAttribute('stroke-width', occupied.has(slot) ? '1.5' : '1');
      dot.setAttribute('pointer-events', 'none');
      grid.appendChild(dot);
    }
  });
  svg.appendChild(grid);

  links.forEach(link => {
    // When a link is selected, only show handles for that specific link
    if (selectedLinkId && link.id !== selectedLinkId) return;
    let isFrom = null;
    if      (link.from === nodeId) isFrom = true;
    else if (link.to   === nodeId) isFrom = false;
    if (isFrom === null) return;

    const port   = isFrom ? (link.fromPort   || 'center') : (link.toPort   || 'center');
    const offset = isFrom ? (link.fromOffset || 0)        : (link.toOffset || 0);
    if (port === 'center') return;

    const pos = getPortPos(n, port, offset);
    const isHoriz = port === 'top' || port === 'bottom';
    const maxOff  = (isHoriz ? n.w : n.h) * 0.4; // 80% / 2

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.classList.add('conn-handle');

    // Track line showing movable range
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const tp = getPortPos(n, port, 0);
    const tOff = maxOff;
    track.setAttribute('x1', isHoriz ? tp.x - tOff : tp.x);
    track.setAttribute('y1', isHoriz ? tp.y : tp.y - tOff);
    track.setAttribute('x2', isHoriz ? tp.x + tOff : tp.x);
    track.setAttribute('y2', isHoriz ? tp.y : tp.y + tOff);
    track.setAttribute('stroke', '#F09A3855'); track.setAttribute('stroke-width', '2');
    track.setAttribute('stroke-dasharray', '4 3'); track.setAttribute('pointer-events', 'none');
    g.appendChild(track);

    // Handle circle
    const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('cx', pos.x); circ.setAttribute('cy', pos.y); circ.setAttribute('r', '6');
    circ.setAttribute('fill', '#F09A38'); circ.setAttribute('stroke', '#070C13');
    circ.setAttribute('stroke-width', '2'); circ.setAttribute('pointer-events', 'all');
    circ.style.cursor = 'move';
    circ.dataset.connHandle = '1';
    circ.addEventListener('mousedown', ev => {
      ev.stopPropagation(); ev.preventDefault();
      geometryChangeSnapshot = getSnapshot();
      draggingConnHandle = { linkId: link.id, isFrom, nodeId };
    });
    circ.addEventListener('dblclick', ev => {
      ev.stopPropagation();
      draggingConnHandle = null; // cancel any pending drag
      const l = links.find(x => x.id === link.id); if (!l) return;
      geometryChangeSnapshot = getSnapshot();
      // Place initial waypoint one step outside the port
      const dir = { top:{x:0,y:-1}, bottom:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} }[port] || {x:0,y:0};
      const pp  = getPortPos(n, port, offset);
      const wp  = { x: snap(pp.x + dir.x * 40), y: snap(pp.y + dir.y * 40) };
      if (isFrom) { l.waypoints.unshift(wp); }
      else        { l.waypoints.push(wp); }
      setConnHandlesMode(false);
      selectLink(l.id);
      renderLinks();
      const wpIdx = isFrom ? 0 : l.waypoints.length - 1;
      draggingWaypoint = { linkId: l.id, wpIndex: wpIdx };
    });
    g.appendChild(circ);

    // Port label
    const other = isFrom ? nodes.find(x => x.id === link.to) : nodes.find(x => x.id === link.from);
    if (other) {
      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lbl.setAttribute('x', pos.x + (isHoriz ? 0 : 9));
      lbl.setAttribute('y', pos.y + (isHoriz ? -9 : 4));
      lbl.setAttribute('text-anchor', isHoriz ? 'middle' : 'start');
      lbl.setAttribute('font-size', '9'); lbl.setAttribute('fill', '#F09A3899');
      lbl.setAttribute('font-family', 'monospace'); lbl.setAttribute('pointer-events', 'none');
      lbl.textContent = other.name;
      g.appendChild(lbl);
    }
    svg.appendChild(g);
  });
}

function updateConnectedPorts() {
  // Clear all connected markers first
  document.querySelectorAll('.node-port.connected').forEach(p => p.classList.remove('connected'));
  // Mark ports that have an active link
  links.forEach(l => {
    const fromEl = document.getElementById(l.from);
    const toEl   = document.getElementById(l.to);
    if (fromEl && l.fromPort && l.fromPort !== 'center')
      fromEl.querySelector(`.node-port[data-port="${l.fromPort}"]`)?.classList.add('connected');
    if (toEl && l.toPort && l.toPort !== 'center')
      toEl.querySelector(`.node-port[data-port="${l.toPort}"]`)?.classList.add('connected');
  });
}

function distPtToSeg(p, a, b) {
  const dx = b.x-a.x, dy = b.y-a.y, lenSq = dx*dx+dy*dy;
  if (lenSq === 0) return Math.hypot(p.x-a.x, p.y-a.y);
  const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/lenSq));
  return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy));
}
function findNearestSegmentIdx(allPts, pt, fromPort) {
  // Returns index to splice into l.waypoints (0 = before first existing wp)
  const verts = buildVertices(allPts, fromPort);
  // Build mapping: vert segment k → allPts segment i
  const segMap = [];
  for (let i = 0; i < allPts.length-1; i++) {
    const p1 = allPts[i], p2 = allPts[i+1];
    if (p1.x !== p2.x && p1.y !== p2.y) { segMap.push(i); segMap.push(i); }
    else { segMap.push(i); }
  }
  let minDist = Infinity, bestAllPtsIdx = 0;
  for (let k = 0; k < verts.length-1; k++) {
    const d = distPtToSeg(pt, verts[k], verts[k+1]);
    if (d < minDist) { minDist = d; bestAllPtsIdx = segMap[k] ?? 0; }
  }
  return bestAllPtsIdx;
}

function createMidpointMarker(point, nextPoint, type, width, firstColor, secondColor) {
  if (!type || type === 'none' || !point) return null;
  const fallback = { x: point.x + 1, y: point.y };
  const next = nextPoint || fallback;
  const len = Math.hypot(next.x - point.x, next.y - point.y) || 1;
  const ux = (next.x - point.x) / len, uy = (next.y - point.y) / len;
  const px = -uy, py = ux;
  const size = Math.max(9, Math.min(24, width + 8));
  const half = size * 0.48;
  const ns = 'http://www.w3.org/2000/svg';
  let shape;

  if (type === 'arrows') {
    const group = document.createElementNS(ns, 'g');
    const metrics = doubleArrowMetrics(point, nextPoint, width);
    const wing = metrics.size * 0.4;
    const makeArrow = (direction, color) => {
      const polygon = document.createElementNS(ns, 'polygon');
      const tipX = point.x - metrics.ux * metrics.gap/2 * direction;
      const tipY = point.y - metrics.uy * metrics.gap/2 * direction;
      const bx = tipX - metrics.ux * metrics.size * direction;
      const by = tipY - metrics.uy * metrics.size * direction;
      polygon.setAttribute('points', `${tipX},${tipY} ${bx + metrics.px*wing},${by + metrics.py*wing} ${bx - metrics.px*wing},${by - metrics.py*wing}`);
      polygon.setAttribute('fill', color);
      polygon.setAttribute('stroke', '#070C13');
      polygon.setAttribute('stroke-width', '1');
      group.appendChild(polygon);
    };
    makeArrow(1, firstColor);
    makeArrow(-1, secondColor);
    group.setAttribute('pointer-events', 'none');
    group.classList.add('link-termination');
    return group;
  } else if (type === 'diamond') {
    shape = document.createElementNS(ns, 'polygon');
    shape.setAttribute('points',
      `${point.x + ux*half},${point.y + uy*half} ${point.x + px*half},${point.y + py*half} ` +
      `${point.x - ux*half},${point.y - uy*half} ${point.x - px*half},${point.y - py*half}`);
    shape.setAttribute('fill', '#070C13');
  } else if (type === 'circle') {
    const r = Math.max(5, width/2 + 2);
    shape = document.createElementNS(ns, 'circle');
    shape.setAttribute('cx', point.x);
    shape.setAttribute('cy', point.y);
    shape.setAttribute('r', r);
    shape.setAttribute('fill', '#070C13');
  } else if (type === 'square') {
    const side = Math.max(9, width + 5);
    shape = document.createElementNS(ns, 'rect');
    shape.setAttribute('x', point.x - side/2);
    shape.setAttribute('y', point.y - side/2);
    shape.setAttribute('width', side); shape.setAttribute('height', side);
    shape.setAttribute('rx', '1'); shape.setAttribute('fill', '#070C13');
  } else if (type === 'bar') {
    shape = document.createElementNS(ns, 'line');
    shape.setAttribute('x1', point.x + px * half); shape.setAttribute('y1', point.y + py * half);
    shape.setAttribute('x2', point.x - px * half); shape.setAttribute('y2', point.y - py * half);
    shape.setAttribute('stroke', '#5A7090'); shape.setAttribute('stroke-width', Math.max(3, width * 0.6));
    shape.setAttribute('stroke-linecap', 'square');
  }
  if (!shape) return null;
  shape.setAttribute('stroke', type === 'bar' ? '#5A7090' : '#344E6A');
  if (type !== 'bar') shape.setAttribute('stroke-width', '1.5');
  shape.setAttribute('pointer-events', 'none');
  shape.classList.add('link-termination');
  return shape;
}

function renderLinks() {
  const svg = document.getElementById('links-svg');
  svg.querySelectorAll('.link-group').forEach(g => g.remove());
  document.getElementById('overlay-svg').querySelectorAll('.conn-dot').forEach(el => el.remove());

  links.forEach(link => {
    const from = nodes.find(n => n.id === link.from), to = nodes.find(n => n.id === link.to);
    if (!from || !to) return;

    const fp = getLinkPortPos(from, link.fromPort || 'center', link.fromOffset || 0);
    const tp = getLinkPortPos(to,   link.toPort   || 'center', link.toOffset   || 0);
    const wps = link.waypoints || [];
    // All control points: from → waypoints → to
    const allPts = [fp, ...wps, tp];
    const linkScale = link.scaleOverride && Array.isArray(link.scale) ? link.scale : currentScale;
    const inC = presentationMode ? getColor(link.inPct, linkScale) : EDITOR_IN_COLOR;
    const outC = presentationMode ? getColor(link.outPct, linkScale) : EDITOR_OUT_COLOR;
    const isSel = link.id === selectedLinkId || selectedLinkIds.has(link.id);
    const baseW = Math.max(1, Math.min(24, Number(link.width) || 6));
    const hasRealTelemetry = !!link.dataSource && link.telemetryTimestamp != null && !link.telemetryError;
    const hasRealCapacity = !!link.dataSource && Number(link.dataSource.capacityBps) > 0;
    const W = baseW + (isSel ? 2 : 0);

    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.classList.add('link-group'); g.dataset.linkId = link.id; g.style.cursor = 'default';
    if (link.description) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = link.description;
      g.appendChild(title);
    }
    g.addEventListener('click', e => {
      const clickPoint = getCanvasPos(e);
      const tolerance = Math.max(5, baseW / 2 + 2);
      if (pointToPolylineDistance(clickPoint, routeVerts) > tolerance) return;
      e.stopPropagation(); e.preventDefault();
      if (presentationMode) showPresentationLinkInfo(link.id);
      else if (e.shiftKey || e.ctrlKey || e.metaKey) toggleLinkSelection(link.id);
      else selectLink(link.id);
    });
    g.addEventListener('mouseenter', () => g.classList.add('hover'));
    g.addEventListener('mouseleave', () => g.classList.remove('hover'));

    const routeVerts = getLinkVertices(link);
    const renderedFromPoint = routeVerts[0] || fp;
    const renderedToPoint = routeVerts[routeVerts.length - 1] || tp;
    const fullD = verticesToPath(routeVerts);

    // Two color halves through all waypoints
    const markerType = link.midTermination || 'circle';
    const split = splitPathAtMidpoint(routeVerts, 'center', link.dividerPosition ?? 50);
    const midPt = split.midPt;
    const nextMidPoint = split.second.find((p, i) => i > 0 && Math.hypot(p.x-midPt.x, p.y-midPt.y) > 0.01);
    let firstVerts = split.first, secondVerts = split.second;
    if (markerType === 'arrows') {
      const metrics = doubleArrowMetrics(midPt, nextMidPoint, W);
      const cutDistance = metrics.size + metrics.gap/2 + W/2;
      firstVerts = trimPolylineEnd(firstVerts, cutDistance);
      secondVerts = trimPolylineStart(secondVerts, cutDistance);
    }
    const firstHalf = verticesToPath(firstVerts);
    const secondHalf = verticesToPath(secondVerts);

    // Selection highlight follows the same cuts as the visible halves.
    if (isSel) {
      [firstHalf, secondHalf].forEach(d => {
        const hl = document.createElementNS('http://www.w3.org/2000/svg','path');
        hl.setAttribute('d', d);
        hl.setAttribute('stroke', '#0DBFA640'); hl.setAttribute('stroke-width', String(W + 12));
        hl.setAttribute('fill', 'none'); hl.setAttribute('stroke-linecap', 'butt');
        g.appendChild(hl);
      });
    }
    const mkHalf = (d, stroke) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d', d); p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', W); p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', 'square');
      p.style.cursor = 'pointer';
      return p;
    };
    g.appendChild(mkHalf(firstHalf,  inC));
    g.appendChild(mkHalf(secondHalf, outC));

    // Hit area matches the visible width; empty canvas must keep its normal cursor.
    const hit = document.createElementNS('http://www.w3.org/2000/svg','path');
    hit.setAttribute('d', fullD);
    hit.setAttribute('stroke', 'transparent'); hit.setAttribute('stroke-width', String(baseW));
    hit.setAttribute('fill', 'none'); hit.setAttribute('pointer-events', 'all');
    if (isSel) {
      hit.style.cursor = 'crosshair';
      hit.addEventListener('mousedown', e => {
        if (e.button !== 0) return;
        e.stopPropagation(); e.preventDefault();
        const pos = getCanvasPos(e);
        const clickPt = { x: snap(pos.x), y: snap(pos.y) };
        const l = links.find(x => x.id === link.id); if (!l) return;
        geometryChangeSnapshot = getSnapshot();
        let insertIdx;
        if (l.routeLane && !(l.waypoints || []).length) {
          l.routeLane = 0;
          l.waypoints = [clickPt];
          insertIdx = 0;
        } else {
          const curAllPts = [fp, ...(l.waypoints||[]), tp];
          insertIdx = findNearestSegmentIdx(curAllPts, clickPt, l.fromPort);
          l.waypoints.splice(insertIdx, 0, clickPt);
        }
        renderLinks();
        draggingWaypoint = { linkId: l.id, wpIndex: insertIdx };
      });
    } else hit.style.cursor = 'pointer';
    g.appendChild(hit);

    // Connection point dots — rendered in overlay-svg so they appear above HTML nodes
    const overlaySvg = document.getElementById('overlay-svg');
    const mkConnDot = (pt, col, isFrom) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.setAttribute('r', W/2 + 3);
      c.setAttribute('fill', col); c.setAttribute('stroke', '#070C13'); c.setAttribute('stroke-width', '2');
      c.setAttribute('pointer-events', 'all'); c.style.cursor = 'move';
      c.classList.add('conn-dot');
      c.addEventListener('mousedown', e => {
        if (!showConnHandles) return;
        e.stopPropagation(); e.preventDefault();
        geometryChangeSnapshot = getSnapshot();
        draggingConnHandle = { linkId: link.id, isFrom, nodeId: isFrom ? link.from : link.to };
      });
      return c;
    };
    overlaySvg.appendChild(mkConnDot(renderedFromPoint, inC, true));
    overlaySvg.appendChild(mkConnDot(renderedToPoint, outC, false));

    // Configurable marker separating both colored halves.
    const midMarker = createMidpointMarker(midPt, nextMidPoint, markerType, W, inC, outC);
    if (midMarker) {
      g.appendChild(midMarker);
      if (isSel && !presentationMode) {
        const dividerHit = document.createElementNS('http://www.w3.org/2000/svg','circle');
        dividerHit.setAttribute('cx', midPt.x); dividerHit.setAttribute('cy', midPt.y);
        dividerHit.setAttribute('r', String(Math.max(12, W + 7)));
        dividerHit.setAttribute('fill', 'transparent'); dividerHit.setAttribute('stroke', '#0DBFA688');
        dividerHit.setAttribute('stroke-width', '1.5'); dividerHit.setAttribute('stroke-dasharray', '3 2');
        dividerHit.setAttribute('pointer-events', 'all'); dividerHit.style.cursor = 'grab';
        dividerHit.classList.add('divider-drag-handle');
        dividerHit.addEventListener('mousedown', e => {
          if (e.button !== 0) return;
          e.stopPropagation(); e.preventDefault();
          geometryChangeSnapshot = getSnapshot();
          draggingDivider = {linkId:link.id, startPosition:link.dividerPosition ?? 50};
        });
        g.appendChild(dividerHit);
      }
    }

    // Both editor and presentation use real telemetry when a datasource is available.
    {
      const unit = link.capacityUnit || 'Mbps';
      const labelFormat = link.usageLabelFormat === 'human' ? 'human' : 'percentage';
      const inPercentage = link.inPct;
      const outPercentage = link.outPct;
      const inValue = link.inUsage;
      const outValue = link.outUsage;
      const labelPosition = ['center','above','below'].includes(link.usageLabelPosition) ? link.usageLabelPosition : 'above';
      const labelData = [
        ['in', metricsAtPolylinePercentage(firstVerts, link.usageLabelInPosition ?? 50), inC, hasRealTelemetry ? formatUsageLabel(labelFormat, inPercentage, inValue, unit) : 'NS'],
        ['out', metricsAtPolylinePercentage(secondVerts, link.usageLabelOutPosition ?? 50), outC, hasRealTelemetry ? formatUsageLabel(labelFormat, outPercentage, outValue, unit) : 'NS']
      ];
      labelData.forEach(([sideName, metrics, col, txt]) => {
        const routeRadians = metrics.angle * Math.PI / 180;
        const normal = {x:-Math.sin(routeRadians), y:Math.cos(routeRadians)};
        const side = labelPosition === 'above' ? -1 : labelPosition === 'below' ? 1 : 0;
        const offset = side * (W/2 + 12);
        const x = metrics.point.x + normal.x * offset;
        const y = metrics.point.y + normal.y * offset;
        let textAngle = link.usageLabelRotate ? metrics.angle : 0;
        if (textAngle > 90 || textAngle < -90) textAngle += 180;
        const isVerticalSegment = Math.abs(Math.sin(routeRadians)) > Math.abs(Math.cos(routeRadians));
        if (link.usageLabelRotate && link.usageLabelFlip && isVerticalSegment) textAngle += 180;
        const charW = 6.4, pad = 5, bh = 17;
        const bw = txt.length * charW + pad * 2;
        const labelGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
        const isActiveLabel = activeUsageLabel?.linkId === link.id && activeUsageLabel.side === sideName;
        labelGroup.setAttribute('transform', `translate(${x} ${y}) rotate(${textAngle})`);
        labelGroup.setAttribute('pointer-events', presentationMode ? 'none' : 'all');
        if (!presentationMode) labelGroup.style.cursor = isActiveLabel ? 'grab' : 'pointer';
        const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
        bg.setAttribute('x', -bw/2); bg.setAttribute('y', -bh/2);
        bg.setAttribute('width', bw); bg.setAttribute('height', bh);
        bg.setAttribute('fill', '#070C13E8'); bg.setAttribute('rx', '3');
        if (isActiveLabel) {
          bg.setAttribute('stroke', '#0DBFA6'); bg.setAttribute('stroke-width', '1.5');
          bg.setAttribute('stroke-dasharray', '3 2');
        }
        labelGroup.appendChild(bg);
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x', '0'); t.setAttribute('y', '4'); t.setAttribute('text-anchor','middle');
        t.setAttribute('font-size', '11'); t.setAttribute('fill', col);
        t.setAttribute('font-family', "Consolas,'SF Mono',monospace");
        t.setAttribute('font-weight', '700'); t.setAttribute('letter-spacing', '0.2');
        t.textContent = txt; labelGroup.appendChild(t);
        if (!presentationMode) {
          labelGroup.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); });
          labelGroup.addEventListener('dblclick', e => {
            e.stopPropagation(); e.preventDefault();
            if (selectedLinkId !== link.id) selectLink(link.id);
            activeUsageLabel = {linkId:link.id, side:sideName};
            renderLinks();
            setStatus(`Etiqueta de ${sideName === 'in' ? 'entrada' : 'salida'} activa · arrástrala dentro de su lado`);
          });
          labelGroup.addEventListener('mousedown', e => {
            if (e.button !== 0 || !isActiveLabel) return;
            e.stopPropagation(); e.preventDefault();
            geometryChangeSnapshot = getSnapshot();
            const field = sideName === 'in' ? 'usageLabelInPosition' : 'usageLabelOutPosition';
            draggingUsageLabel = {linkId:link.id, side:sideName, startPosition:link[field] ?? 50};
          });
        }
        g.appendChild(labelGroup);
      });
    }

    // Capacity tag — fixed in one of four quadrants around the divider.
    if (link.capacityLabelVisible !== false) {
      const metrics = metricsAtPolylinePercentage(routeVerts, link.dividerPosition ?? 50);
      const radians = metrics.angle * Math.PI / 180;
      const side = ['above','below','left','right'].includes(link.capacityLabelSide) ? link.capacityLabelSide : 'right';
      const fontSize = Math.max(8, Math.min(72, Number(link.capacityLabelFontSize) || 11));
      const height = fontSize + 6;
      const txt = hasRealCapacity
        ? `${formatUtilization(link.capacity)} ${shortCapacityUnit(link.capacityUnit || 'Mbps')}`
        : 'NS';
      const width = txt.length * fontSize * 0.59 + 12;
      const markerGap = Math.max(10, W + 5);
      const x = metrics.point.x + (side === 'left' ? -(width/2 + markerGap) : side === 'right' ? (width/2 + markerGap) : 0);
      const y = metrics.point.y + (side === 'above' ? -(height/2 + markerGap) : side === 'below' ? (height/2 + markerGap) : 0);
      let angle = link.capacityLabelRotate ? metrics.angle : 0;
      if (angle > 90 || angle < -90) angle += 180;
      const vertical = Math.abs(Math.sin(radians)) > Math.abs(Math.cos(radians));
      if (link.capacityLabelRotate && link.capacityLabelFlip && vertical) angle += 180;
      const group = document.createElementNS('http://www.w3.org/2000/svg','g');
      group.setAttribute('transform', `translate(${x} ${y}) rotate(${angle})`);
      group.setAttribute('pointer-events', 'none');
      const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      bg.setAttribute('x', -width/2); bg.setAttribute('y', -height/2);
      bg.setAttribute('width', width); bg.setAttribute('height', height);
      bg.setAttribute('fill', '#070C13E8'); bg.setAttribute('rx', '3');
      group.appendChild(bg);
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x','0'); text.setAttribute('y',String(fontSize * 0.36)); text.setAttribute('text-anchor','middle');
      text.setAttribute('font-size',String(fontSize)); text.setAttribute('fill','#F6C85F');
      text.setAttribute('font-family',"Consolas,'SF Mono',monospace"); text.setAttribute('font-weight','700');
      text.textContent = txt; group.appendChild(text);
      g.appendChild(group);
    }

    // ── Waypoint handles (only when selected) ─────────────────
    if (isSel) {
      // Existing waypoint handles: draggable squares
      wps.forEach((wp, wpIdx) => {
        const sq = document.createElementNS('http://www.w3.org/2000/svg','rect');
        const SZ = 10;
        sq.setAttribute('x', wp.x - SZ/2); sq.setAttribute('y', wp.y - SZ/2);
        sq.setAttribute('width', SZ); sq.setAttribute('height', SZ);
        sq.setAttribute('fill', '#0DBFA6'); sq.setAttribute('stroke', '#070C13');
        sq.setAttribute('stroke-width', '2'); sq.setAttribute('rx', '2');
        sq.setAttribute('pointer-events', 'all'); sq.style.cursor = 'move';
        sq.dataset.wpHandle = '1'; sq.dataset.linkId = link.id; sq.dataset.wpIdx = wpIdx;
        sq.addEventListener('mousedown', e => {
          e.stopPropagation(); e.preventDefault();
          geometryChangeSnapshot = getSnapshot();
          draggingWaypoint = { linkId: link.id, wpIndex: wpIdx };
        });
        sq.addEventListener('dblclick', e => {
          e.stopPropagation();
          const l = links.find(x => x.id === link.id); if (!l) return;
          const beforeDelete = getSnapshot();
          l.waypoints.splice(wpIdx, 1);
          renderLinks(); updatePropsPanel();
          if (!revertIfLinksOverlap(beforeDelete)) pushHistory();
        });
        g.appendChild(sq);
      });

      // Hint text when no waypoints yet
      if (wps.length === 0) {
        const hint = document.createElementNS('http://www.w3.org/2000/svg','text');
        const midPtH = allPts[Math.floor(allPts.length / 2)];
        hint.setAttribute('x', midPtH.x + 8); hint.setAttribute('y', midPtH.y - 12);
        hint.setAttribute('font-size', '10'); hint.setAttribute('fill', '#0DBFA666');
        hint.setAttribute('font-family', 'sans-serif'); hint.setAttribute('pointer-events', 'none');
        hint.textContent = 'drag to bend';
        g.appendChild(hint);
      }
    }

    svg.appendChild(g);
  });
  updateConnectedPorts();
  if (selectedId && showConnHandles) renderConnectionHandles(selectedId);
  renderLinkPointHints();
  // Arrange badges only in the "ordenamiento" view.
  if (_arrangeState && document.body.classList.contains('arranging')) renderArrangeOverlays();
}

// ════════════════════════════════════════════════════
// SELECTION
// ════════════════════════════════════════════════════
function setNodeSelection(ids) {
  activeUsageLabel = null; draggingUsageLabel = null;
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
  const n = selectedId && nodes.find(x => x.id === selectedId);
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
  activeUsageLabel = null; draggingUsageLabel = null;
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
  activeUsageLabel = null; draggingUsageLabel = null;
  selectedLinkId = id; selectedId = null; selectedNodeIds = new Set(); selectedLinkIds = new Set();
  nodes.forEach(n => document.getElementById(n.id)?.classList.remove('selected', 'link-endpoint'));
  const l = links.find(x => x.id === id);
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
  activeUsageLabel = null; draggingUsageLabel = null;
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
  const n = nodes.find(x => x.id === id); if (!n) return;
  const typeNames = {switch:'Nodo',server:'Icono',text:'Texto',chart:'Gráfica'};
  const rows = [
    ['Nombre', n.name || 'Sin nombre'],
    ['Tipo', typeNames[n.type] || n.type],
    ['Entrada', `${n.inPct ?? 0}%`],
    ['Salida', `${n.outPct ?? 0}%`],
    ['Tamaño', `${Math.round(n.w)} × ${Math.round(n.h)} px`],
    ['Conexiones', String(links.filter(l => l.from===id || l.to===id).length)],
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
  const l = links.find(x => x.id === id); if (!l) return;
  const from = nodes.find(n => n.id === l.from), to = nodes.find(n => n.id === l.to);
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
  localStorage.setItem('mapgen_presentation_refresh', String(minutes));
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
  localStorage.setItem('mapgen_presentation_view_mode', mode);
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
      <button class="tb-btn primary" type="button" onclick="openCactiBindingModal('${link.id}')">${binding ? 'Cambiar fuente' : 'Vincular fuente'}</button>
      ${binding ? `<button class="tb-btn" type="button" onclick="testCactiBinding('${link.id}')">Probar</button><button class="tb-btn" type="button" onclick="clearCactiBinding('${link.id}')">Quitar</button>` : ''}
    </div>
  </div>`;
}

function openCactiBindingModal(linkId) {
  const link = links.find(item => item.id === linkId);
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
    const response = await fetch('/api/cacti/metrics', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
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
    const link = links.find(item => item.id === linkId);
    picker.innerHTML = `<div class="cacti-modal-grid">
      <label><span>Equipo</span><select class="prop-val" id="cacti-device-${linkId}" onchange="loadCactiGraphs('${linkId}',this.value)">
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
    const graphs = cactiCatalog.graphs.get(hostId), link = links.find(item => item.id === linkId);
    const sources = graphs.flatMap(graph => (graph.dataSources || []).map(source => ({
      ...source, graphId:graph.id, graphName:graph.name
    })));
    cactiCatalog.sources.set(hostId, sources);
    wrap.innerHTML = `<div id="cacti-source-wrap-${linkId}"><div class="cacti-modal-grid">
      <label><span>Fuente de la gráfica</span><select class="prop-val" id="cacti-source-${linkId}" ${sources.length ? '' : 'disabled'} onchange="renderCactiDsPicker('${linkId}',${hostId},this.value,this.selectedOptions[0]?.dataset?.graphId)">
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
  const link = links.find(item => item.id === linkId);
  wrap.innerHTML = `<div class="cacti-modal-grid">
    <label><span>Fuente de la gráfica</span><select class="prop-val" id="cacti-source-${linkId}" onchange="renderCactiDsPicker('${linkId}',${hostId},this.value,${graphId})">
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
    const sources = cactiCatalog.sources.get(hostId), link = links.find(item => item.id === linkId);
    wrap.innerHTML = `<label class="prop-label" style="margin-top:8px">Interfaz / fuente</label>
      <select class="prop-val" id="cacti-source-${linkId}" onchange="renderCactiDsPicker('${linkId}',${hostId},this.value)">
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
  const link = links.find(item => item.id === linkId), names = source.dataSourceNames;
  const guess = side => names.find(name => new RegExp(`(^|_)${side}($|_)`, 'i').test(name)) || '';
  const inDs = link?.dataSource?.localDataId === localDataId ? link.dataSource.inDs : guess('in');
  const outDs = link?.dataSource?.localDataId === localDataId ? link.dataSource.outDs : guess('out');
  const options = selected => `<option value="">Ninguna</option>${names.map(name => `<option value="${escapeHtml(name)}" ${name===selected?'selected':''}>${escapeHtml(name)}</option>`).join('')}`;
  wrap.innerHTML = `<div class="cacti-ds-grid"><label>Entrada<select class="prop-val" id="cacti-in-${linkId}" onchange="previewCactiBinding('${linkId}',${hostId},${localDataId})">${options(inDs)}</select></label><label>Salida<select class="prop-val" id="cacti-out-${linkId}" onchange="previewCactiBinding('${linkId}',${hostId},${localDataId})">${options(outDs)}</select></label></div>
    ${cactiPreviewHtml('Calculando vista previa…')}`;
  previewCactiBinding(linkId, hostId, localDataId);
}

async function applyCactiBinding(linkId, hostId, localDataId, graphId = null) {
  const link = links.find(item => item.id === linkId);
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
  const link = links.find(item => item.id === linkId); if (!link) return;
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
  const response = await fetch('/api/cacti/metrics', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
    ...(date ? {date} : {}), bindings:bound.map(link => ({linkId:link.id, localDataId:link.dataSource.localDataId,
      inDs:link.dataSource.inDs, outDs:link.dataSource.outDs, multiplier:link.dataSource.multiplier}))
  })});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudieron consultar las métricas');
  let updated = 0, errors = 0;
  result.metrics.forEach(metric => {
    const link = links.find(item => item.id === metric.linkId); if (!link) return;
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
    const link = links.find(item => item.id === linkId); if (link) link.telemetryError = error.message;
    updatePropsPanel(); setStatus('⚠ No se pudieron consultar las métricas');
  }
}

// ════════════════════════════════════════════════════
// PROPS PANEL
// ════════════════════════════════════════════════════
const MID_TERMINATIONS = [
  ['circle', 'Círculo'], ['square', 'Cuadrado'], ['diamond', 'Diamante'],
  ['bar', 'Barra'], ['arrows', 'Flechas →←'], ['none', 'Ninguno']
];
const LINK_CAPACITY_UNITS = ['Kbps','Mbps','Gbps','Tbps'];

// ── Premium segmented toggles: universally recognized glyphs ──
const SEG_OPTIONS = {
  marker: [
    ['circle','●','Círculo'], ['square','■','Cuadrado'], ['diamond','◆','Diamante'],
    ['bar','▮','Barra'], ['arrows','⇄','Flechas'], ['none','⊘','Ninguno']
  ],
  usageFormat: [['percentage','%','Mostrar porcentaje'], ['human','1K','Utilización legible']],
  capacityUnit: [['Kbps','K','Kbps'], ['Mbps','M','Mbps'], ['Gbps','G','Gbps'], ['Tbps','T','Tbps']],
  usagePosition: [['above','↑','Arriba'], ['below','↓','Abajo'], ['center','⊙','Centro']],
  placement: [['above','↑','Arriba'], ['below','↓','Abajo'], ['left','←','Izquierda'], ['right','→','Derecha']],
  chartType: [
    ['bar','<svg viewBox="0 0 24 24"><path d="M5 19V10h4v9M10 19V5h4v14M15 19v-7h4v7M3 19h18"/></svg>','Barras'],
    ['line','<svg viewBox="0 0 24 24"><path d="M4 15l5-6 4 4 6-8"/><path d="M3 19h18"/></svg>','Línea'],
    ['donut','<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="3"/></svg>','Dona']
  ]
};
function segToggleHtml(name, value, options, call, opts = {}) {
  const dis = !!opts.disabled;
  return `<div class="seg-toggle" role="group"${opts.label ? ` aria-label="${opts.label}"` : ''}${dis ? ' aria-disabled="true"' : ''}>`
    + options.map(([val, glyph, title]) =>
        `<label class="seg-opt"${title ? ` title="${title}"` : ''}>`
        + `<input type="radio" name="${name}" value="${val}" ${String(val) === String(value) ? 'checked' : ''}${dis ? ' disabled' : ''} onchange="${call.replace(/%v/g, val)}" />`
        + `<span class="seg-glyph" aria-hidden="true">${glyph}</span></label>`
      ).join('')
    + `</div>`;
}
function segToggleValue(name) {
  const el = document.querySelector(`.seg-toggle input[name="${name}"]:checked`);
  return el ? el.value : null;
}
function syncSegToggle(name, value, disabled) {
  const radios = document.querySelectorAll(`.seg-toggle input[name="${name}"]`);
  radios.forEach(r => { r.checked = (r.value === String(value)); if (disabled !== undefined) r.disabled = !!disabled; });
  if (disabled !== undefined && radios[0]) radios[0].closest('.seg-toggle')?.setAttribute('aria-disabled', disabled ? 'true' : 'false');
}
const NODE_ICONS = ['🖼️','🔲','🔷','🛡️','🖥️','☁️','📡','🌐','🗄️','💻','⚙️','⚠️','📍','🏷️','📊','🔌'];
const NODE_FONTS = [
  ['system-ui','Sistema'], ['Arial','Arial'], ['Georgia','Georgia'],
  ['Consolas','Consolas'], ['Times New Roman','Times New Roman']
];
function nodeFontOptions(selected) {
  return NODE_FONTS.map(([value,label]) => `<option value="${value}" ${selected===value?'selected':''}>${label}</option>`).join('');
}
function linkThresholdEditorHtml(link) {
  if (!link.scaleOverride) return '';
  const scale = Array.isArray(link.scale) && link.scale.length >= 2 ? link.scale : currentScale;
  return `
    <div style="height:10px;display:flex;border-radius:3px;overflow:hidden;margin:7px 0 9px">
      ${scale.map(item => `<span style="flex:1;background:${item.color}"></span>`).join('')}
    </div>
    ${scale.map((item,index) => `
      <div class="scale-threshold-row">
        <div class="sth-color" style="background:${item.color}">
          <input type="color" value="${item.color}" onchange="updateLinkThresholdColor('${link.id}',${index},this.value)" />
          <div class="sth-swatch" style="background:${item.color}"></div>
        </div>
        <div class="sth-pct-wrap">
          <input class="sth-pct" type="number" min="0" max="100" value="${item.pct}"
                 onchange="updateLinkThresholdPct('${link.id}',${index},this.value)" />
          <span class="sth-pct-unit">%</span>
        </div>
        <div style="flex:1;height:10px;border-radius:3px;background:${item.color}"></div>
        ${scale.length > 2 ? `<button class="sth-del" onclick="removeLinkThreshold('${link.id}',${index})" title="Eliminar">✕</button>` : '<div style="width:22px"></div>'}
      </div>`).join('')}
    <div style="display:flex;gap:5px;margin-top:7px">
      <button class="tb-btn" style="flex:1;font-size:10px" onclick="addLinkThreshold('${link.id}')">+ Umbral</button>
      <button class="tb-btn" style="flex:1;font-size:10px" onclick="copyGeneralScaleToLink('${link.id}')">Copiar general</button>
    </div>`;
}
function iconGridHtml(node) {
  return `<div class="icon-grid">${NODE_ICONS.map(icon => `
    <button class="icon-choice ${!node.image && node.icon===icon ? 'selected' : ''}"
            title="${icon}" onclick="setNodeVisual('${node.id}','${icon}')">${icon}</button>`).join('')}</div>`;
}

const PROPERTY_TAB_CONFIG = {
  regular: [
    ['content','Contenido'], ['appearance','Apariencia'], ['layout','Diseño'], ['arrange','Ordenar']
  ],
  text: [
    ['content','Contenido'], ['appearance','Apariencia'], ['transform','Transformar'], ['arrange','Ordenar']
  ],
  chart: [
    ['data','Datos'], ['appearance','Apariencia'], ['layout','Diseño'], ['arrange','Ordenar']
  ],
  link: [
    ['data','Datos'], ['style','Estilo'], ['labels','Etiquetas'], ['thresholds','Umbrales']
  ]
};
const PROPERTY_TAB_ICONS = {
  content:'<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  appearance:'<path d="M12 3a9 9 0 1 0 9 9c0-2-1-3-3-3h-2a2 2 0 0 1-2-2V5c0-1-1-2-2-2z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="8.5" cy="15" r="1"/>',
  layout:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16M9 10h11"/>',
  transform:'<path d="M4 8V4h4M20 16v4h-4M16 4h4v4M8 20H4v-4"/><path d="m8 8 8 8M16 8l-8 8"/>',
  data:'<path d="M5 19V9h4v10M10 19V5h4v14M15 19v-7h4v7M3 19h18"/>',
  style:'<path d="m4 16 9-9 4 4-9 9H4z"/><path d="m14 6 2-2 4 4-2 2"/>',
  labels:'<path d="M4 5h11l5 5-10 10-6-6z"/><circle cx="9" cy="10" r="1.5"/>',
  thresholds:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  arrange:'<path d="M5 5v14M19 5v14M5 8h6l2 4h6M5 16h6l2-4"/><circle cx="5" cy="8" r="2"/><circle cx="5" cy="16" r="2"/><circle cx="19" cy="12" r="2"/>'
};
function checkControlIcon(text) {
  if (/ocultar|visible|mostrar/i.test(text)) return '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/>';
  if (/transparente|fondo/i.test(text)) return '<rect x="5" y="5" width="10" height="10" rx="2"/><path d="M9 9h10v10H9z"/>';
  if (/borde/i.test(text)) return '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h8v8H8z"/>';
  if (/rotar|girar|vertical/i.test(text)) return '<path d="M19 8V4l-2 2a7 7 0 1 0 2 9"/><path d="M19 4h-4"/>';
  if (/negrita/i.test(text)) return '<path d="M8 5h5a4 4 0 0 1 0 8H8zM8 13h6a3 3 0 0 1 0 6H8z"/>';
  if (/cursiva/i.test(text)) return '<path d="M10 5h7M7 19h7M14 5l-4 14"/>';
  if (/umbral|escala/i.test(text)) return PROPERTY_TAB_ICONS.thresholds;
  if (/nombre|texto/i.test(text)) return PROPERTY_TAB_ICONS.content;
  return '<path d="m5 12 4 4L19 6"/>';
}
function enhanceCheckControls(root = document) {
  root.querySelectorAll('.prop-check:not([data-premium-check])').forEach(label => {
    const input = label.querySelector(':scope > input[type="checkbox"]');
    if (!input) return;
    const text = label.textContent.trim();
    const content = document.createElement('span'); content.className = 'prop-check-copy';
    Array.from(label.childNodes).filter(node => node !== input).forEach(node => content.appendChild(node));
    const icon = document.createElement('span'); icon.className = 'prop-check-icon';
    icon.innerHTML = `<svg viewBox="0 0 24 24">${checkControlIcon(text)}</svg>`;
    label.replaceChildren(icon, content, input);
    label.dataset.premiumCheck = 'true';
  });
  root.querySelectorAll('.prop-row').forEach(row => {
    const children = Array.from(row.children);
    for (let index = 0; index < children.length;) {
      if (!children[index].classList.contains('prop-check')) { index++; continue; }
      const run = [];
      while (index < children.length && children[index].classList.contains('prop-check')) run.push(children[index++]);
      if (run.length < 2 || run[0].parentElement?.classList.contains('prop-check-row')) continue;
      const checkRow = document.createElement('div');
      checkRow.className = 'prop-check-row';
      run[0].before(checkRow);
      run.forEach(control => checkRow.appendChild(control));
    }
  });
}
function propertyTabForElement(element, profile) {
  const label = element.querySelector('.prop-label')?.textContent.trim() || '';
  const html = element.innerHTML || '';
  const source = `${html} ${element.getAttribute('onclick') || ''}`;
  if (profile === 'link') {
    if (/^Enlace$|^Descripción$|^Capacidad del enlace/.test(label)) return 'data';
    if (/^Etiqueta de capacidad$|^Texto de utilización$/.test(label)) return 'labels';
    if (/^Alineación|^Acciones del enlace|^Grosor visual|^Marcador intermedio$|^Posición del divisor/.test(label) || source.includes('useGeneralLinkConfig')) return 'style';
    return 'thresholds';
  }
  if (profile === 'text') {
    if (/^Texto$|^Tipografía$|^Contenido$/.test(label)) return 'content';
    if (/^Apariencia del nodo$|^Contenedor del texto$/.test(label) || source.includes('useGeneralNodeAppearance')) return 'appearance';
    return 'transform';
  }
  if (profile === 'chart') {
    if (/^Nombre$|^Gráfica$/.test(label) || source.includes('nameInside') || source.includes('hideName')) return 'data';
    if (/^Tipografía$|^Apariencia del nodo$|^Contenedor del texto$/.test(label) || source.includes('useGeneralNodeAppearance')) return 'appearance';
    return 'layout';
  }
  if (/^Nombre$|^Icono \/ imagen$/.test(label) || source.includes('nameInside') || source.includes('hideName')) return 'content';
  if (/^Tipografía$|^Apariencia del nodo$|^Contenedor del texto$/.test(label) || source.includes('useGeneralNodeAppearance')) return 'appearance';
  return 'layout';
}
function mountPropertyTabs(container, profile, title, subtitle, entityId = null) {
  const tabs = PROPERTY_TAB_CONFIG[profile];
  if (!tabs) return;
  const originalChildren = Array.from(container.children);
  container.closest('.panel-section')?.classList.add('has-property-tabs');
  const shell = document.createElement('div'); shell.className = `props-tabs-shell props-profile-${profile}`;
  const head = document.createElement('div'); head.className = 'props-entity-head';
  head.innerHTML = `<span class="props-entity-icon"><svg viewBox="0 0 24 24">${profile === 'link' ? PROPERTY_TAB_ICONS.style : profile === 'chart' ? PROPERTY_TAB_ICONS.data : profile === 'text' ? PROPERTY_TAB_ICONS.content : PROPERTY_TAB_ICONS.layout}</svg></span><span class="props-entity-copy"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></span><span class="props-live-dot" title="Elemento seleccionado"></span>`;
  const nav = document.createElement('div'); nav.className = 'props-tab-nav'; nav.setAttribute('role','tablist');
  const stage = document.createElement('div'); stage.className = 'props-tab-stage';
  const storageKey = `mapgen_props_tab_${profile}`;
  const availableKeys = tabs.map(([key]) => key);
  let activeKey = localStorage.getItem(storageKey);
  if (!availableKeys.includes(activeKey)) activeKey = tabs[0][0];
  // Never auto-open "arrange" on a fresh selection; keep it only while the arrange view is active.
  if (activeKey === 'arrange' && !document.body.classList.contains('arranging')) activeKey = tabs[0][0];
  const activate = key => {
    activeKey = key; localStorage.setItem(storageKey, key);
    nav.querySelectorAll('.props-tab').forEach(button => {
      const active = button.dataset.tab === key;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    });
    stage.querySelectorAll('.props-tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === key));
  };
  tabs.forEach(([key,label]) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'props-tab'; button.dataset.tab = key;
    button.setAttribute('role','tab'); button.innerHTML = `<svg viewBox="0 0 24 24">${PROPERTY_TAB_ICONS[key]}</svg><span>${label}</span>`;
    button.addEventListener('click', () => {
      activate(key);
      if (key === 'arrange' && entityId) enterArrangeView(entityId);
      else exitArrangeView();
    });
    nav.appendChild(button);
    const panel = document.createElement('div'); panel.className = 'props-tab-panel'; panel.dataset.panel = key; panel.setAttribute('role','tabpanel'); stage.appendChild(panel);
  });
  originalChildren.forEach(element => stage.querySelector(`[data-panel="${propertyTabForElement(element, profile)}"]`)?.appendChild(element));
  container.replaceChildren(shell); shell.append(head, nav, stage); activate(activeKey); enhanceCheckControls(container);
  if (activeKey === 'arrange' && entityId) showArrangeForm(entityId, true);
}

function mountConfigTabs() {
  const editor = document.getElementById('config-editor');
  if (!editor || editor.classList.contains('config-tabs-mounted')) return;
  const rows = Array.from(editor.children).filter(element => element.classList.contains('prop-row'));
  const tabs = [
    ['general','General','<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z"/>'],
    ['nodes','Nodos',PROPERTY_TAB_ICONS.layout],
    ['text','Texto',PROPERTY_TAB_ICONS.content],
    ['labels','Etiquetas',PROPERTY_TAB_ICONS.labels]
  ];
  const shell = document.createElement('div'); shell.className = 'props-tabs-shell config-tabs-shell';
  const head = document.createElement('div'); head.className = 'props-entity-head config-entity-head';
  head.innerHTML = `<span class="props-entity-icon"><svg viewBox="0 0 24 24">${tabs[0][2]}</svg></span><span class="props-entity-copy"><strong>Configuración general</strong><small>Valores predeterminados</small></span><span class="props-live-dot" title="Configuración activa"></span>`;
  const nav = document.createElement('div'); nav.className = 'props-tab-nav config-tab-nav'; nav.setAttribute('role','tablist');
  const stage = document.createElement('div'); stage.className = 'props-tab-stage';
  let activeKey = localStorage.getItem('mapgen_config_tab');
  if (!tabs.some(([key]) => key === activeKey)) activeKey = 'general';
  const activate = key => {
    activeKey = key; localStorage.setItem('mapgen_config_tab', key);
    nav.querySelectorAll('.props-tab').forEach(button => {
      const active = button.dataset.tab === key;
      button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active));
    });
    stage.querySelectorAll('.props-tab-panel').forEach(panel => panel.classList.toggle('active', panel.dataset.panel === key));
  };
  tabs.forEach(([key,label,icon]) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'props-tab'; button.dataset.tab = key;
    button.setAttribute('role','tab'); button.innerHTML = `<svg viewBox="0 0 24 24">${icon}</svg><span>${label}</span>`;
    button.addEventListener('click', () => activate(key)); nav.appendChild(button);
    const panel = document.createElement('div'); panel.className = 'props-tab-panel config-tab-panel'; panel.dataset.panel = key; panel.setAttribute('role','tabpanel'); stage.appendChild(panel);
  });
  rows.forEach(row => {
    const label = row.querySelector('.prop-label')?.textContent.trim() || '';
    const key = /nodos de texto/i.test(label) ? 'text'
      : /Apariencia predeterminada · nodos/i.test(label) ? 'nodes'
      : /Texto de utilización|Tag de capacidad/i.test(label) ? 'labels'
      : 'general';
    stage.querySelector(`[data-panel="${key}"]`)?.appendChild(row);
  });
  editor.replaceChildren(shell); editor.classList.add('config-tabs-mounted'); shell.append(head, nav, stage); activate(activeKey); enhanceCheckControls(editor);
}

// Reusable premium inspector panel (.ins-panel): empty state + multi-selection share one design.
function inspectorEmptyHtml() {
  return `<div class="ins-panel">
    <header class="ins-head">
      <span class="ins-head-icon"><svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h5M8 16h7"/></svg></span>
      <span class="ins-head-text"><strong>Propiedades</strong><small>Inspector contextual</small></span>
      <span class="ins-head-dot" title="Esperando selección"></span>
    </header>
    <div class="ins-body">
      <div class="ins-hero ins-hero--orbit" aria-hidden="true"><span class="ins-hero-icon"><svg viewBox="0 0 48 48"><rect x="9" y="10" width="20" height="20" rx="5"/><path d="M19 30v8M14 38h10M29 20h10M35 16l4 4-4 4"/><path class="cursor" d="m28 27 10 6-5 2-2 5z"/></svg></span><i></i><i></i></div>
      <span class="ins-kicker"><b></b> Inspector listo</span>
      <strong class="ins-title">Selecciona un elemento</strong>
      <p class="ins-copy">Elige un nodo o enlace del canvas para descubrir y editar todos sus detalles.</p>
    </div>
    <footer class="ins-footer">
      <span class="ins-footer-label">Elementos compatibles</span>
      <div class="ins-chips"><span><svg viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="3"/></svg>Nodo</span><span><svg viewBox="0 0 20 20"><path d="M3 10h14M6 7l-3 3 3 3M14 7l3 3-3 3"/></svg>Enlace</span></div>
      <div class="ins-tip"><kbd>↖</kbd><span>Selecciona para comenzar</span></div>
    </footer>
  </div>`;
}
function automaticAlignmentInfo() {
  // Alignment is strictly a node operation. Selected links must keep their
  // routes and must never pull their unselected endpoint nodes into the task.
  const alignmentNodes = nodes.filter(node => selectedNodeIds.has(node.id));
  if (alignmentNodes.length < 2) return null;
  const xs = alignmentNodes.map(node => node.x);
  const ys = alignmentNodes.map(node => node.y);
  const horizontal = Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys);
  const crossField = horizontal ? 'y' : 'x';
  const crossSize = horizontal ? 'h' : 'w';
  const groups = [];
  const orderedNodes = [...alignmentNodes].sort((a, b) => a[crossField] - b[crossField]);

  // Nodes whose perpendicular bounds substantially overlap belong to the same
  // row/column. This keeps separate rows and columns from collapsing together.
  orderedNodes.forEach(node => {
    let bestGroup = null;
    let bestDistance = Infinity;
    groups.forEach(group => {
      const distance = Math.abs(node[crossField] - group.coordinate);
      const overlapTolerance = (node[crossSize] + group.averageSize) * .45;
      if (distance <= overlapTolerance && distance < bestDistance) {
        bestGroup = group;
        bestDistance = distance;
      }
    });
    if (!bestGroup) {
      groups.push({ nodes:[node], coordinate:node[crossField], averageSize:node[crossSize] });
      return;
    }
    bestGroup.nodes.push(node);
    bestGroup.coordinate = bestGroup.nodes.reduce((sum, item) => sum + item[crossField], 0) / bestGroup.nodes.length;
    bestGroup.averageSize = bestGroup.nodes.reduce((sum, item) => sum + item[crossSize], 0) / bestGroup.nodes.length;
  });

  // With only two elements there is no evidence of multiple rows/columns.
  if (alignmentNodes.length === 2 && groups.length === 2) {
    groups.splice(0, groups.length, {
      nodes:alignmentNodes,
      coordinate:alignmentNodes.reduce((sum, node) => sum + node[crossField], 0) / 2,
      averageSize:alignmentNodes.reduce((sum, node) => sum + node[crossSize], 0) / 2
    });
  }
  return {
    nodes: alignmentNodes,
    orientation: horizontal ? 'horizontal' : 'vertical',
    groups
  };
}
function alignSelectionAutomatically() {
  const alignment = automaticAlignmentInfo();
  if (!alignment) {
    setStatus('Selecciona al menos dos nodos; los enlaces no participan en la alineación');
    return;
  }
  let changed = false;
  const field = alignment.orientation === 'horizontal' ? 'y' : 'x';
  alignment.groups.forEach(group => {
    if (group.nodes.length < 2) return;
    const target = snap(group.coordinate);
    group.nodes.forEach(node => {
      if (node[field] === target) return;
      node[field] = target;
      changed = true;
      renderNode(node);
    });
  });
  if (!changed) {
    setStatus(`La selección ya está alineada en ${alignment.orientation}`);
    return;
  }
  renderLinks();
  pushHistory();
  updatePropsPanel();
  const alignedGroups = alignment.groups.filter(group => group.nodes.length > 1).length;
  const groupName = alignment.orientation === 'horizontal' ? 'fila' : 'columna';
  setStatus(`Alineación ${alignment.orientation}: ${alignedGroups} ${groupName}${alignedGroups === 1 ? '' : 's'}`);
}
function cancelCustomAlignment() {
  customAlignmentPending = null;
  document.body.classList.remove('custom-aligning');
  document.querySelectorAll('.custom-align-candidate').forEach(element => element.classList.remove('custom-align-candidate'));
}
function startCustomAlignment() {
  const alignment = automaticAlignmentInfo();
  if (!alignment) {
    setStatus('Selecciona al menos dos nodos; los enlaces conservarán su recorrido');
    return;
  }
  cancelCustomAlignment();
  customAlignmentPending = {
    nodeIds:new Set(alignment.nodes.map(node => node.id)),
    orientation:alignment.orientation
  };
  document.body.classList.add('custom-aligning');
  alignment.nodes.forEach(node => document.getElementById(node.id)?.classList.add('custom-align-candidate'));
  setStatus(`Alineación custom ${alignment.orientation}: selecciona el nodo de referencia`);
}
function alignSelectionToReferenceNode(referenceId) {
  const pending = customAlignmentPending;
  if (!pending) return;
  if (!pending.nodeIds.has(referenceId)) {
    setStatus('El nodo de referencia debe pertenecer a la selección de nodos');
    return;
  }
  const reference = nodes.find(node => node.id === referenceId);
  if (!reference) { cancelCustomAlignment(); return; }
  const field = pending.orientation === 'horizontal' ? 'y' : 'x';
  const target = reference[field];
  let affected = 0;
  nodes.forEach(node => {
    if (!pending.nodeIds.has(node.id) || node.id === referenceId) return;
    if (node[field] !== target) affected++;
    node[field] = target;
    renderNode(node);
  });
  cancelCustomAlignment();
  renderLinks();
  if (affected) pushHistory();
  updatePropsPanel();
  setStatus(`Alineación custom ${pending.orientation} usando ${reference.name} como referencia`);
}
function selectedAlignmentNodes() {
  return nodes.filter(node => selectedNodeIds.has(node.id));
}
function multiSelectionDimension(field) {
  const selectedNodes = selectedAlignmentNodes();
  if (!selectedNodes.length) return '';
  const values = selectedNodes.map(node => Math.round(node[field]));
  return values.every(value => value === values[0]) ? values[0] : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
function resizeSelectedNodes(field, rawValue) {
  const selectedNodes = selectedAlignmentNodes();
  const requested = Number(rawValue);
  if (!selectedNodes.length || !Number.isFinite(requested)) return;
  selectedNodes.forEach(node => {
    const minimum = node.type === 'text' ? getTextNodeAutoSize(node) : {w:32,h:32};
    node[field] = Math.max(minimum[field], Math.min(2000, Math.round(requested)));
    node.sizeOverride = true;
    renderNode(node);
  });
  renderLinks(); pushHistory(); updatePropsPanel();
  setStatus(`${field === 'w' ? 'Ancho' : 'Alto'} aplicado a ${selectedNodes.length} nodos`);
}
function multiSelectionSpacing(alignment) {
  if (!alignment) return 0;
  const horizontal = alignment.orientation === 'horizontal';
  const positionField = horizontal ? 'x' : 'y';
  const sizeField = horizontal ? 'w' : 'h';
  const gaps = [];
  alignment.groups.forEach(group => {
    const ordered = [...group.nodes].sort((a, b) => a[positionField] - b[positionField]);
    for (let index = 1; index < ordered.length; index++) {
      gaps.push(ordered[index][positionField] - ordered[index - 1][positionField]
        - ordered[index][sizeField] / 2 - ordered[index - 1][sizeField] / 2);
    }
  });
  return gaps.length ? Math.max(0, Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length)) : 0;
}
function setMultiSelectionSpacing(rawValue) {
  const alignment = automaticAlignmentInfo();
  const spacing = Math.max(0, Math.min(2000, Math.round(Number(rawValue) || 0)));
  if (!alignment) return;
  const horizontal = alignment.orientation === 'horizontal';
  const positionField = horizontal ? 'x' : 'y';
  const sizeField = horizontal ? 'w' : 'h';
  let affected = 0;
  alignment.groups.forEach(group => {
    const ordered = [...group.nodes].sort((a, b) => a[positionField] - b[positionField]);
    if (ordered.length < 2) return;
    const oldMin = Math.min(...ordered.map(node => node[positionField] - node[sizeField] / 2));
    const oldMax = Math.max(...ordered.map(node => node[positionField] + node[sizeField] / 2));
    const totalSize = ordered.reduce((sum, node) => sum + node[sizeField], 0) + spacing * (ordered.length - 1);
    let cursor = (oldMin + oldMax - totalSize) / 2;
    ordered.forEach(node => {
      node[positionField] = cursor + node[sizeField] / 2;
      cursor += node[sizeField] + spacing;
      renderNode(node);
      affected++;
    });
  });
  if (!affected) { setStatus('No hay una fila o columna con varios nodos'); return; }
  renderLinks(); pushHistory(); updatePropsPanel();
  setStatus(`Separación ${horizontal ? 'horizontal' : 'vertical'}: ${spacing}px`);
}
function multiSelectPanelHtml(count) {
  const alignment = automaticAlignmentInfo();
  const alignedGroups = alignment?.groups.filter(group => group.nodes.length > 1).length || 0;
  const groupName = alignment?.orientation === 'horizontal' ? 'fila' : 'columna';
  const spacingDirection = alignment?.orientation === 'horizontal' ? 'Horizontal' : 'Vertical';
  const alignmentLabel = alignment
    ? `Alinear ${alignedGroups > 1 ? `${alignedGroups} ${groupName}s` : alignment.orientation === 'horizontal' ? 'horizontalmente' : 'verticalmente'}`
    : 'Alinear automáticamente';
  return `<div class="ins-panel ins-panel--multi">
    <header class="ins-head">
      <span class="ins-head-icon"><svg viewBox="0 0 24 24"><path d="m12 3 8 4-8 4-8-4z"/><path d="m4 12 8 4 8-4M4 16.5l8 4 8-4"/></svg></span>
      <span class="ins-head-text"><strong>Selección múltiple</strong><small>Inspector contextual</small></span>
      <span class="ins-head-dot"></span>
    </header>
    <div class="ins-body">
      <div class="ins-hero"><span class="ins-hero-icon">${count}</span></div>
      <span class="ins-kicker"><b></b> Selección activa</span>
      <strong class="ins-title">${count} elementos seleccionados</strong>
      <p class="ins-copy">Arrástralos juntos o deja que el editor detecte si forman una fila o una columna.</p>
      <div class="ins-batch-controls">
        <label><span>Ancho</span><input type="number" min="32" max="2000" value="${multiSelectionDimension('w')}" onchange="resizeSelectedNodes('w',this.value)"><small>px</small></label>
        <label><span>Alto</span><input type="number" min="32" max="2000" value="${multiSelectionDimension('h')}" onchange="resizeSelectedNodes('h',this.value)"><small>px</small></label>
        <label class="ins-spacing-control"><span>Separación ${spacingDirection}</span><input type="number" min="0" max="2000" value="${multiSelectionSpacing(alignment)}" onchange="setMultiSelectionSpacing(this.value)"><small>px</small></label>
      </div>
      <div class="ins-actions">
        <button class="tb-btn ins-align-btn" onclick="alignSelectionAutomatically()" ${alignment ? '' : 'disabled'}
                title="Detecta la orientación dominante y alinea los centros">${alignmentLabel}</button>
        <button class="tb-btn" onclick="startCustomAlignment()" ${alignment ? '' : 'disabled'}
                title="Después selecciona el nodo que servirá como referencia">Alineación custom</button>
        <button class="tb-btn" onclick="deleteSelected()">Eliminar selección</button>
      </div>
    </div>
    <footer class="ins-footer">
      <span class="ins-footer-label">Atajos</span>
      <div class="ins-tip"><kbd>Shift</kbd><span>clic añade o quita</span><kbd>Ctrl</kbd><span>arrastre mueve el lienzo</span><kbd>Esc</kbd><span>deselecciona</span></div>
    </footer>
  </div>`;
}
function updatePropsPanel() {
  const c = document.getElementById('props-content');
  c.closest('.panel-section')?.classList.remove('has-property-tabs');
  let tabContext = null;
  if (selectionCount() > 1) {
    c.innerHTML = multiSelectPanelHtml(selectionCount());
    return;
  }
  if (selectedId) {
    const n = nodes.find(x => x.id === selectedId); if (!n) return;
    const visualValue = n.image && !n.image.startsWith('data:') ? n.image : (n.image ? '' : n.icon || '');
    const nodeBg = n.nodeBackground || '#101e30';
    const nodeBgTransparent = !!n.nodeBackgroundTransparent;
    const nodeBorderHidden = !!n.nodeBorderHidden;
    const nodeBorder = n.nodeBorderColor || '#1b2e46';
    const textColor = n.textColor || '#c2d4e8';
    const textBg = n.textBackground || (n.type === 'text' ? '#101e30' : '#070c13');
    const textBgTransparent = n.textBackgroundTransparent ?? (n.type === 'text');
    const textBorderHidden = !!n.textBorderHidden;
    const textBorder = n.textBorderColor || '#1b2e46';
    c.innerHTML = `
      <div class="prop-row">
        <div class="prop-label">${n.type === 'text' ? 'Texto' : 'Nombre'}</div>
        <input class="prop-val editable" type="text" value="${escapeHtml(n.name)}"
               onchange="renameNode('${n.id}',this.value.trim())" />
      </div>
      <div class="prop-row">
        <div class="prop-label">Tipografía</div>
        <select class="prop-val" onchange="updateNodeAppearance('${n.id}','fontFamily',this.value)">
          ${nodeFontOptions(n.fontFamily || 'system-ui')}
        </select>
        <div class="format-toolbar">
          <div class="prop-pair">
            <input class="prop-val coord" type="number" min="8" max="120" value="${getNodeFontSize(n)}"
                   title="Tamaño de fuente" onchange="updateNodeAppearance('${n.id}','fontSize',this.value)" />
            <span style="font-size:11px;color:var(--text2)">px</span>
          </div>
          <div class="text-format-group" role="group" aria-label="Estilo de texto">
            <label class="format-toggle" data-format="bold" title="Negrita"><input type="checkbox" ${n.fontBold?'checked':''}
                   onchange="updateNodeAppearance('${n.id}','fontBold',this.checked)" /><span class="format-glyph" aria-hidden="true">B</span></label>
            <label class="format-toggle" data-format="italic" title="Cursiva"><input type="checkbox" ${n.fontItalic?'checked':''}
                   onchange="updateNodeAppearance('${n.id}','fontItalic',this.checked)" /><span class="format-glyph" aria-hidden="true">I</span></label>
          </div>
        </div>
        <div class="prop-label" style="margin-top:7px">Color del texto</div>
        <input class="prop-val" type="color" value="${textColor}" style="height:31px;padding:3px"
               onchange="updateNodeAppearance('${n.id}','textColor',this.value)" />
      </div>
      <div class="prop-row">
        <div class="prop-label">Apariencia del nodo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <label style="font-size:10px;color:var(--text2)">Fondo
            <input class="prop-val" type="color" value="${nodeBg}" style="height:31px;padding:3px" ${nodeBgTransparent?'disabled':''}
                   onchange="updateNodeAppearance('${n.id}','nodeBackground',this.value)" />
          </label>
          <label style="font-size:10px;color:var(--text2)">Borde
            <input class="prop-val" type="color" value="${nodeBorder}" style="height:31px;padding:3px" ${nodeBorderHidden?'disabled':''}
                   onchange="updateNodeAppearance('${n.id}','nodeBorderColor',this.value)" />
          </label>
        </div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${nodeBgTransparent?'checked':''}
               onchange="updateNodeAppearance('${n.id}','nodeBackgroundTransparent',this.checked)" /> Fondo transparente</label>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${nodeBorderHidden?'checked':''}
               onchange="updateNodeAppearance('${n.id}','nodeBorderHidden',this.checked)" /> Ocultar borde del nodo</label>
        <div class="stack-field${nodeBorderHidden?' is-disabled':''}">
          <span class="stack-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 17h18"/></svg></span>
          <span class="stack-field-copy">Grosor del borde</span>
          <div class="input-unit stack-field-control">
            <input class="prop-val coord" type="number" min="0" max="12" step="0.5" ${nodeBorderHidden?'disabled':''}
                   value="${n.nodeBorderWidth ?? 1.5}" onchange="updateNodeAppearance('${n.id}','nodeBorderWidth',this.value)" />
            <span class="input-unit-suffix">px</span>
          </div>
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Contenedor del texto</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <label style="font-size:10px;color:var(--text2)">Fondo
            <input class="prop-val" type="color" value="${textBg}" style="height:31px;padding:3px" ${textBgTransparent?'disabled':''}
                   onchange="updateNodeAppearance('${n.id}','textBackground',this.value)" />
          </label>
          <label style="font-size:10px;color:var(--text2)">Borde
            <input class="prop-val" type="color" value="${textBorder}" style="height:31px;padding:3px" ${textBorderHidden?'disabled':''}
                   onchange="updateNodeAppearance('${n.id}','textBorderColor',this.value)" />
          </label>
        </div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${textBgTransparent?'checked':''}
               onchange="updateNodeAppearance('${n.id}','textBackgroundTransparent',this.checked)" /> Fondo transparente</label>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${textBorderHidden?'checked':''}
               onchange="updateNodeAppearance('${n.id}','textBorderHidden',this.checked)" /> Ocultar borde del texto</label>
        <div class="stack-field${textBorderHidden?' is-disabled':''}">
          <span class="stack-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 17h18"/></svg></span>
          <span class="stack-field-copy">Grosor del borde</span>
          <div class="input-unit stack-field-control">
            <input class="prop-val coord" type="number" min="0" max="12" step="0.5" ${textBorderHidden?'disabled':''}
                   value="${n.textBorderWidth ?? (n.type === 'text' ? 0 : 1)}" onchange="updateNodeAppearance('${n.id}','textBorderWidth',this.value)" />
            <span class="input-unit-suffix">px</span>
          </div>
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Tamaño</div>
        <div class="prop-pair">
          <input class="prop-val coord" type="number" min="32" max="2000" value="${n.w}"
                 title="Ancho" onchange="resizeNodeFromProps('${n.id}','w',this.value)" />
          <span style="color:var(--text3)">×</span>
          <input class="prop-val coord" type="number" min="32" max="2000" value="${n.h}"
                 title="Alto" onchange="resizeNodeFromProps('${n.id}','h',this.value)" />
        </div>
      </div>
      ${n.appearanceOverride ? `
        <button class="tb-btn" style="width:100%;font-size:11px;margin-bottom:9px" onclick="useGeneralNodeAppearance('${n.id}')">
          ↺ Usar apariencia general
        </button>` : ''}
      <div class="prop-row">
        <div class="prop-label">Separación de enlaces</div>
        <div class="prop-pair">
          <input class="prop-val coord" type="number" min="0" max="100"
                 value="${n.linkPadding ?? DEFAULT_LINK_PADDING}"
                 onchange="updateNodeLinkPadding('${n.id}',this.value)" />
          <span style="font-size:11px;color:var(--text2)">px</span>
        </div>
      </div>
      ${(n.type !== 'text' && (n.sizeOverride || n.linkPaddingOverride)) ? `
        <button class="tb-btn" style="width:100%;font-size:11px;margin-bottom:9px" onclick="useGeneralNodeConfig('${n.id}')">
          ↺ Usar configuración general
        </button>` : ''}
      ${n.type === 'chart' ? `
        <div class="prop-row">
          <div class="prop-label">Gráfica</div>
          <button class="tb-btn primary" style="width:100%;font-size:12px" onclick="openChartWizard('${n.id}')">📊 Editar gráfica</button>
        </div>` : n.type === 'text' ? `
        <div class="prop-row">
          <div class="prop-label">Contenido</div>
          <div class="prop-val" style="color:var(--text2);font-size:11px">El texto se adapta al ancho y alto del cuadro.</div>
        </div>
        <div class="prop-row">
          <div class="prop-label">Rotación</div>
          <div class="prop-pair">
            <input class="prop-val coord" type="number" min="0" max="359" value="${Number(n.textRotation)||0}"
                   onchange="updateTextRotation('${n.id}',this.value)" />
            <span style="font-size:11px;color:var(--text2)">°</span>
          </div>
          <div class="prop-label" style="margin-top:7px">Orientación</div>
          <div style="display:flex;gap:5px;margin-top:5px">
            <button class="tb-btn ${((Number(n.textRotation)||0) % 180) === 0 ? 'active' : ''}" style="flex:1;font-size:11px" onclick="updateTextRotation('${n.id}',0)">Horizontal</button>
            <button class="tb-btn ${((Number(n.textRotation)||0) % 180) === 90 ? 'active' : ''}" style="flex:1;font-size:11px" onclick="updateTextRotation('${n.id}',90)">Vertical</button>
          </div>
          <div style="display:flex;gap:4px;margin-top:5px">
            ${[0,90,180,270].map(angle => `<button class="tb-btn" style="flex:1;font-size:11px" onclick="updateTextRotation('${n.id}',${angle})">${angle}°</button>`).join('')}
          </div>
        </div>` : `
        <div class="prop-row">
          <div class="prop-label">Icono / imagen</div>
          ${iconGridHtml(n)}
          <input class="prop-val editable" type="text" value="${escapeHtml(visualValue)}"
                 placeholder="Emoji o URL de imagen" onchange="setNodeVisual('${n.id}',this.value.trim())" />
          <input class="prop-file" type="file" accept="image/*" onchange="uploadNodeImage('${n.id}',this)" />
          ${n.image ? `<button class="tb-btn" style="width:100%;font-size:11px;margin-top:5px" onclick="clearNodeImage('${n.id}')">Usar icono</button>` : ''}
        </div>`}
      ${n.type === 'text' ? '' : `<div class="prop-row">
        <label class="prop-check">
          <input type="checkbox" ${n.nameInside ? 'checked' : ''}
                 onchange="setNodeLabelOption('${n.id}','nameInside',this.checked)" />
          Nombre dentro del cuadro
        </label>
        <label class="prop-check">
          <input type="checkbox" ${n.hideName ? 'checked' : ''}
                 onchange="setNodeLabelOption('${n.id}','hideName',this.checked)" />
          Ocultar nombre
        </label>
      </div>`}
      `;
    tabContext = {profile:n.type === 'text' ? 'text' : n.type === 'chart' ? 'chart' : 'regular', title:n.name, subtitle:n.type === 'text' ? 'Nodo de texto' : n.type === 'chart' ? 'Gráfica' : 'Nodo visual', entityId:n.id};
  } else if (selectedLinkId) {
    const l = links.find(x => x.id === selectedLinkId); if (!l) return;
    const from = nodes.find(x => x.id === l.from), to = nodes.find(x => x.id === l.to);
    c.innerHTML = `
      <div class="prop-row">
        <div class="prop-label">Enlace</div>
        <div class="prop-val" style="font-size:11px">${escapeHtml(from?.name)} → ${escapeHtml(to?.name)}</div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Acciones del enlace</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <button class="tb-btn" onclick="redrawLink('${l.id}')" title="Regenera únicamente la geometría de la ruta">Redibujar</button>
          <button class="tb-btn" onclick="cloneLink('${l.id}')" title="Copia el enlace y conserva su configuración">Clonar enlace</button>
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Descripción</div>
        <textarea class="prop-val editable" placeholder="Descripción del enlace"
                  onchange="updateLinkDescription('${l.id}',this.value)">${escapeHtml(l.description || '')}</textarea>
      </div>
      ${cactiBindingHtml(l)}
      <div class="prop-row">
        <div class="prop-label">Capacidad del enlace para umbrales</div>
        <input class="prop-val" type="number" min="0.01" step="0.01" value="${l.capacity ?? 100}"
               onchange="updateLinkTraffic('${l.id}','capacity',this.value)" />
        ${segToggleHtml(`cap-unit-${l.id}`, LINK_CAPACITY_UNITS.includes(l.capacityUnit) ? l.capacityUnit : 'Mbps', SEG_OPTIONS.capacityUnit, `updateLinkTraffic('${l.id}','capacityUnit','%v')`, {label:'Unidad de capacidad'})}
      </div>
      <div class="prop-row">
        <div class="prop-label">Etiqueta de capacidad</div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${l.capacityLabelVisible!==false?'checked':''}
               onchange="updateLinkCapacityLabel('${l.id}','capacityLabelVisible',this.checked)" /> Mostrar tag de capacidad</label>
        <div class="prop-label" style="margin-top:7px">Posición del tag</div>
        ${segToggleHtml(`cap-place-${l.id}`, ['above','below','left'].includes(l.capacityLabelSide) ? l.capacityLabelSide : 'right', SEG_OPTIONS.placement, `updateLinkCapacityLabelPlacement('${l.id}','%v')`, {label:'Posición del tag', disabled:l.capacityLabelVisible===false})}
        <div class="prop-label" style="margin-top:7px">Tamaño del texto</div>
        <div class="prop-pair"><input class="prop-val coord" type="number" min="8" max="72"
             value="${l.capacityLabelFontSize ?? 11}" ${l.capacityLabelVisible===false?'disabled':''}
             onchange="updateLinkCapacityLabel('${l.id}','capacityLabelFontSize',this.value)" /><span>px</span></div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${l.capacityLabelRotate?'checked':''} ${l.capacityLabelVisible===false?'disabled':''}
               onchange="updateLinkCapacityLabel('${l.id}','capacityLabelRotate',this.checked)" /> Rotar siguiendo el enlace</label>
        <label class="prop-check" style="margin-top:5px"><input type="checkbox" ${l.capacityLabelFlip?'checked':''} ${!l.capacityLabelRotate||l.capacityLabelVisible===false?'disabled':''}
               onchange="updateLinkCapacityLabel('${l.id}','capacityLabelFlip',this.checked)" /> Girar 180° sólo en vertical</label>
      </div>
      <div class="prop-row">
        <div class="prop-label">Grosor visual del enlace</div>
        <div class="prop-pair">
          <input class="prop-val coord" type="number" min="1" max="24" value="${l.width || 6}"
                 onchange="updateLinkWidth('${l.id}',this.value)" />
          <span style="font-size:11px;color:var(--text2)">px</span>
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Marcador intermedio</div>
        ${segToggleHtml(`mid-term-${l.id}`, l.midTermination || 'circle', SEG_OPTIONS.marker, `updateLinkTermination('${l.id}','%v')`, {label:'Marcador intermedio'})}
      </div>
      <div class="prop-row">
        <div class="prop-label" style="display:flex;justify-content:space-between">
          <span>Posición del divisor</span><span id="divider-position-value">${l.dividerPosition ?? 50}%</span>
        </div>
        <input id="divider-position-slider" class="prop-val" type="range" min="5" max="95" step="1"
               value="${l.dividerPosition ?? 50}" data-start="${l.dividerPosition ?? 50}"
               oninput="previewLinkDivider('${l.id}',this.value)"
               onchange="commitLinkDivider('${l.id}',this.value,this.dataset.start)" />
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3)"><span>Entrada</span><span>Salida</span></div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Texto de utilización</div>
        ${segToggleHtml(`usage-fmt-${l.id}`, l.usageLabelFormat==='human'?'human':'percentage', SEG_OPTIONS.usageFormat, `updateLinkUsageLabel('${l.id}','usageLabelFormat','%v')`, {label:'Formato del texto'})}
        <div class="prop-label" style="margin-top:7px">Ubicación</div>
        ${segToggleHtml(`usage-pos-${l.id}`, ['above','below','center'].includes(l.usageLabelPosition)?l.usageLabelPosition:'above', SEG_OPTIONS.usagePosition, `updateLinkUsageLabel('${l.id}','usageLabelPosition','%v')`, {label:'Ubicación'})}
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${l.usageLabelRotate?'checked':''}
               onchange="updateLinkUsageLabel('${l.id}','usageLabelRotate',this.checked)" /> Rotar siguiendo el enlace</label>
        <label class="prop-check" style="margin-top:5px"><input type="checkbox" ${l.usageLabelFlip?'checked':''} ${!l.usageLabelRotate?'disabled':''}
               onchange="updateLinkUsageLabel('${l.id}','usageLabelFlip',this.checked)" /> Girar 180° sólo en vertical</label>
      </div>
      <div class="prop-row">
        <label class="prop-check">
          <input type="checkbox" ${l.scaleOverride ? 'checked' : ''}
                 onchange="setLinkScaleOverride('${l.id}',this.checked)" />
          Usar umbrales individuales
        </label>
        ${linkThresholdEditorHtml(l)}
      </div>
      ${(l.styleOverride || l.dividerPositionOverride || l.usageLabelOverride || l.capacityLabelOverride) ? `
        <button class="tb-btn" style="width:100%;font-size:11px;margin-bottom:9px" onclick="useGeneralLinkConfig('${l.id}')">
          ↺ Usar estilo general
        </button>` : ''}
      `;
    tabContext = {profile:'link', title:`${from?.name || 'Origen'} → ${to?.name || 'Destino'}`, subtitle:'Enlace de red'};
  } else {
    c.innerHTML = inspectorEmptyHtml();
  }
  if (tabContext) mountPropertyTabs(c, tabContext.profile, tabContext.title, tabContext.subtitle, tabContext.entityId);
  else enhanceCheckControls(c);
}

function autoAssignPort(link, nodeId) {
  const isFrom = link.from === nodeId;
  const isLocked = isFrom ? link.fromPortLocked : link.toPortLocked;
  if (isLocked) return;
  const port = isFrom ? (link.fromPort || 'center') : (link.toPort || 'center');
  // Once a side has been chosen it remains fixed, even if either node moves.
  if (port !== 'center') return;
  const self  = nodes.find(x => x.id === nodeId);
  const other = nodes.find(x => x.id === (isFrom ? link.to : link.from));
  if (!self || !other) return;
  const dx = other.x - self.x, dy = other.y - self.y;
  const p = Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? 'right' : 'left')
    : (dy >= 0 ? 'bottom' : 'top');
  if (isFrom) { link.fromPort = p; link.fromPortLocked = true; }
  else { link.toPort = p; link.toPortLocked = true; }
}

function distributePortLinks(nodeId) {
  const n = nodes.find(x => x.id === nodeId); if (!n) return;
  // Migration only: legacy center endpoints receive a side once.
  links.forEach(l => {
    if (l.from === nodeId || l.to === nodeId) autoAssignPort(l, nodeId);
  });
  ['top', 'bottom', 'left', 'right'].forEach(port => {
    const pl = links.filter(l =>
      (l.from === nodeId && (l.fromPort || 'center') === port) ||
      (l.to   === nodeId && (l.toPort   || 'center') === port)
    );
    if (pl.length === 0) return;
    const used = new Set();
    const pending = [];
    pl.forEach(link => {
      const slot = endpointSlot(link, nodeId);
      if (Number.isInteger(slot) && slot >= 1 && slot <= PORT_SLOT_COUNT && !used.has(slot)) {
        used.add(slot);
        setEndpointSlot(link, nodeId, port, slot);
      } else pending.push(link);
    });
    // Preserve legacy visual order by choosing the nearest available fixed slot.
    pending.sort((a, b) => {
      const ao = a.from === nodeId ? Number(a.fromOffset) || 0 : Number(a.toOffset) || 0;
      const bo = b.from === nodeId ? Number(b.fromOffset) || 0 : Number(b.toOffset) || 0;
      return ao - bo;
    }).forEach(link => {
      const oldOffset = link.from === nodeId ? Number(link.fromOffset) || 0 : Number(link.toOffset) || 0;
      const available = Array.from({length:PORT_SLOT_COUNT}, (_, i) => i + 1).filter(slot => !used.has(slot));
      if (!available.length) return;
      const slot = available.reduce((best, candidate) =>
        Math.abs(portSlotOffset(n, port, candidate) - oldOffset) < Math.abs(portSlotOffset(n, port, best) - oldOffset)
          ? candidate : best, available[0]);
      used.add(slot);
      setEndpointSlot(link, nodeId, port, slot);
    });
  });
}

// Arrange form state: { nodeId, groups: { top:[linkIds], bottom:[], left:[], right:[] } }
let _arrangeState = null;
let _dragSide = null, _dragIdx = null;

function renderArrangeOverlays() {
  document.querySelectorAll('.arrange-badge').forEach(el => el.remove());
  if (!_arrangeState) return;
  if (!document.body.classList.contains('arranging')) return;   // arrange badges only in the "ordenamiento" view
  const { nodeId, groups } = _arrangeState;
  const n = nodes.find(x => x.id === nodeId); if (!n) return;
  const canvas = document.getElementById('canvas');
  const sideColors = { top:'#63b3ed', bottom:'#68d391', left:'#f6ad55', right:'#fc8181' };
  ['top','bottom','left','right'].forEach(side => {
    groups[side].forEach((item, i) => {
      const l = links.find(x => x.id === item.linkId); if (!l) return;
      const isFrom = l.from === nodeId;
      const port   = isFrom ? (l.fromPort || 'center') : (l.toPort || 'center');
      const offset = isFrom ? (l.fromOffset || 0) : (l.toOffset || 0);
      const pos = getPortPos(n, port, offset);
      const col = sideColors[side] || '#90cdf4';
      const badge = document.createElement('div');
      badge.className = 'arrange-badge';
      badge.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;` +
        `transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;` +
        `background:${col};border:1.5px solid #070C13;display:flex;align-items:center;` +
        `justify-content:center;font-size:9px;font-weight:700;color:#070C13;` +
        `pointer-events:none;z-index:50;font-family:Consolas,monospace;`;
      badge.textContent = String(item.slot);
      canvas.appendChild(badge);
    });
  });
}

function _arrangeDragStart(side, idx) {
  _dragSide = side; _dragIdx = idx;
}
function _arrangeDrop(e, targetSide, targetIdx) {
  e.preventDefault(); e.stopPropagation();
  if (_dragSide === null || _dragIdx === null) return;
  const srcSide = _dragSide, srcIdx = _dragIdx;
  _dragSide = null; _dragIdx = null;
  const srcGrp = _arrangeState.groups[srcSide];
  const tgtGrp = _arrangeState.groups[targetSide];
  const item = srcGrp[srcIdx], target = tgtGrp[targetIdx];
  if (!item || !target) return;
  if (srcSide === targetSide) {
    [item.slot, target.slot] = [target.slot, item.slot];
  } else {
    const freeSlot = firstFreeArrangeSlot(targetSide);
    if (freeSlot === null) { showArrangeSideFull(targetSide); return; }
    srcGrp.splice(srcIdx, 1);
    item.slot = freeSlot; tgtGrp.push(item);
  }
  sortArrangeGroups();
  _previewArrange();
  setStatus('Posición actualizada sin modificar la ruta');
  renderArrangeForm();
}
function _arrangeDropOnSection(e, side) {
  e.preventDefault(); e.stopPropagation();
  if (_dragSide === null || _dragIdx === null) return;
  const srcSide = _dragSide, srcIdx = _dragIdx;
  _dragSide = null; _dragIdx = null;
  const [item] = _arrangeState.groups[srcSide].splice(srcIdx, 1);
  const freeSlot = firstFreeArrangeSlot(side);
  if (freeSlot === null) {
    _arrangeState.groups[srcSide].splice(srcIdx, 0, item);
    showArrangeSideFull(side); return;
  }
  item.slot = freeSlot;
  _arrangeState.groups[side].push(item);
  sortArrangeGroups();
  _previewArrange();
  setStatus('Lado actualizado sin modificar la ruta');
  renderArrangeForm();
}

function firstFreeArrangeSlot(side) {
  const used = new Set((_arrangeState?.groups[side] || []).map(item => item.slot));
  for (let slot = 1; slot <= PORT_SLOT_COUNT; slot++) if (!used.has(slot)) return slot;
  return null;
}
function sortArrangeGroups() {
  Object.values(_arrangeState?.groups || {}).forEach(group => group.sort((a, b) => a.slot - b.slot));
}
function showArrangeSideFull(side) {
  showAlert(`El lado ${portSideLabel(side)} ya tiene ${PORT_SLOT_COUNT} enlaces. Libera una posición o selecciona otro lado.`, 'Lado completo');
}

// Third view: "ordenamiento". Mutually exclusive with select and link views.
function enterArrangeView(nodeId) {
  setTool('select');                     // clears link/arrange, base state
  document.body.classList.add('arranging');
  document.getElementById('mode-label').textContent = 'Modo: Ordenar';
  showArrangeForm(nodeId, true);
}
function exitArrangeView() {
  if (!document.body.classList.contains('arranging') && !_arrangeState) return;
  document.body.classList.remove('arranging');
  _arrangeState = null;
  document.querySelectorAll('.arrange-badge').forEach(el => el.remove());
  document.getElementById('mode-label').textContent = currentTool === 'link' ? 'Modo: Conectar' : 'Modo: Seleccionar';
}
function showArrangeForm(nodeId, embedded = false) {
  const n = nodes.find(x => x.id === nodeId); if (!n) return;
  saveForCancel(); // snapshot for Cancelar revert
  arrangeEmbeddedInTab = embedded;

  // Build groups: port → [ {linkId, otherName} ] in current offset order
  const groups = { top:[], bottom:[], left:[], right:[] };
  links.forEach(l => {
    const isFrom = l.from === nodeId, isTo = l.to === nodeId;
    if (!isFrom && !isTo) return;
    const port   = isFrom ? (l.fromPort || 'center') : (l.toPort || 'center');
    const offset = isFrom ? (l.fromOffset || 0) : (l.toOffset || 0);
    const slot = endpointSlot(l, nodeId);
    const other  = nodes.find(x => x.id === (isFrom ? l.to : l.from));
    if (!groups[port]) return; // skip center
    groups[port].push({ linkId: l.id, slot, offset, name: other?.name || '?' });
  });

  // Fixed positions may contain gaps; keep their real slot numbers visible.
  Object.values(groups).forEach(g => g.sort((a, b) => a.slot - b.slot));

  _arrangeState = { nodeId, groups: structuredClone(groups) };
  renderArrangeForm();
}

function renderArrangeForm() {
  if (!_arrangeState) return;
  const { nodeId, groups } = _arrangeState;
  const n = nodes.find(x => x.id === nodeId); if (!n) return;

  const sideLabel = { top:'↑ Arriba', bottom:'↓ Abajo', left:'← Izq', right:'→ Der' };
  const sideHint  = { top:'izq → der', bottom:'izq → der', left:'arriba → abajo', right:'arriba → abajo' };

  let html = `<div class="arrange-guide"><strong>10 posiciones fijas por lado</strong><span>Mueve cada enlace sin redistribuir ni regenerar las rutas existentes.</span></div>`;

  ['top','bottom','left','right'].forEach(side => {
    const grp = groups[side];
    html += `<div class="arrange-section"
      ondragover="event.preventDefault();this.style.background='color-mix(in srgb, var(--accent) 8%, transparent)'"
      ondragleave="this.style.background=''"
      ondrop="_arrangeDropOnSection(event,'${side}');this.style.background=''">
      <div class="arrange-side-title">${sideLabel[side]}
        <span>(${sideHint[side]})</span>
      </div>`;
    if (!grp.length) {
      html += `<div class="arrange-empty">Arrastra aquí</div>`;
    } else {
      const col = {top:'#0DBFA6',bottom:'#28C97A',left:'#F09A38',right:'#E86060'}[side];
      grp.forEach((item, i) => {
        html += `<div draggable="true"
          ondragstart="_arrangeDragStart('${side}',${i})"
          ondragover="event.preventDefault()"
          ondrop="_arrangeDrop(event,'${side}',${i})"
          class="arrange-row">
          <span class="arrange-grip">⠿</span>
          <span class="arrange-index" style="background:${col}" title="Posición fija ${item.slot} de ${PORT_SLOT_COUNT}">${item.slot}</span>
          <span class="arrange-item-name" title="${item.name}">${item.name}</span>
          <select class="arrange-side-select" title="Cambiar lado" onchange="_arrangeMoveToSide('${side}',${i},this.value)">
            <option value="top" ${side==='top'?'selected':''}>↑</option>
            <option value="bottom" ${side==='bottom'?'selected':''}>↓</option>
            <option value="left" ${side==='left'?'selected':''}>←</option>
            <option value="right" ${side==='right'?'selected':''}>→</option>
          </select>
          <button class="tb-btn compact-icon" ${item.slot===1?'disabled':''} onclick="_arrangeMoveUp('${side}',${i})">↑</button>
          <button class="tb-btn compact-icon" ${item.slot===PORT_SLOT_COUNT?'disabled':''} onclick="_arrangeMoveDown('${side}',${i})">↓</button>
        </div>`;
      });
    }
    html += `</div>`;
  });

  html += `<div class="arrange-actions">
    <button class="tb-btn primary" style="flex:1;font-size:12px" onclick="applyArrange()">Guardar</button>
    <button class="tb-btn" style="flex:1;font-size:12px" onclick="_cancelArrange()">Cancelar</button>
  </div>`;

  if (arrangeEmbeddedInTab) {
    const panel = document.querySelector('.props-tab-panel[data-panel="arrange"]');
    if (panel) panel.innerHTML = `<div class="props-arrange-inline">${html}</div>`;
  } else {
    const container = document.getElementById('props-content');
    container.closest('.panel-section')?.classList.add('has-property-tabs');
    container.innerHTML = `<div class="props-arrange-shell">
    <div class="props-arrange-head">
      <button type="button" class="props-arrange-back" onclick="_cancelArrange()" title="Volver a propiedades" aria-label="Volver a propiedades">←</button>
      <span class="props-entity-icon"><svg viewBox="0 0 24 24"><path d="M5 5v14M19 5v14M5 8h6l2 4h6M5 16h6l2-4"/><circle cx="5" cy="8" r="2"/><circle cx="5" cy="16" r="2"/><circle cx="19" cy="12" r="2"/></svg></span>
      <span class="props-entity-copy"><strong>Ordenar enlaces</strong><small>${escapeHtml(n.name)}</small></span>
    </div>
    <div class="props-arrange-body">${html}</div>
  </div>`;
  }
  renderArrangeOverlays();
}

function _previewArrange() {
  if (!_arrangeState) return;
  const { nodeId, groups } = _arrangeState;
  const n = nodes.find(x => x.id === nodeId); if (!n) return;
  ['top','bottom','left','right'].forEach(side => {
    const grp = groups[side]; if (!grp.length) return;
    grp.forEach(item => {
      const l = links.find(x => x.id === item.linkId); if (!l) return;
      setEndpointSlot(l, nodeId, side, item.slot);
    });
  });
  renderLinks();
  renderArrangeOverlays();
}

function _arrangeMoveUp(side, idx) {
  const grp = _arrangeState.groups[side];
  const item = grp[idx]; if (!item || item.slot <= 1) return;
  const neighbor = grp.find(other => other.slot === item.slot - 1);
  if (neighbor) neighbor.slot++;
  item.slot--;
  sortArrangeGroups();
  _previewArrange();
  setStatus('Posición movida hacia arriba');
  renderArrangeForm();
}
function _arrangeMoveToSide(sourceSide, idx, targetSide) {
  if (sourceSide === targetSide || !_arrangeState?.groups[targetSide]) return;
  const freeSlot = firstFreeArrangeSlot(targetSide);
  if (freeSlot === null) { showArrangeSideFull(targetSide); renderArrangeForm(); return; }
  const [item] = _arrangeState.groups[sourceSide].splice(idx, 1);
  if (!item) return;
  item.slot = freeSlot;
  _arrangeState.groups[targetSide].push(item);
  sortArrangeGroups();
  _previewArrange();
  setStatus(`Enlace movido a ${targetSide} sin modificar la ruta`);
  renderArrangeForm();
}
function _arrangeMoveDown(side, idx) {
  const grp = _arrangeState.groups[side];
  const item = grp[idx]; if (!item || item.slot >= PORT_SLOT_COUNT) return;
  const neighbor = grp.find(other => other.slot === item.slot + 1);
  if (neighbor) neighbor.slot--;
  item.slot++;
  sortArrangeGroups();
  _previewArrange();
  setStatus('Posición movida hacia abajo');
  renderArrangeForm();
}
function _cancelArrange() {
  const nodeId = _arrangeState?.nodeId || null;
  const node = nodeId ? nodes.find(item => item.id === nodeId) : null;
  revertCancel(); // revert to snapshot taken in showArrangeForm
  if (arrangeEmbeddedInTab && node) localStorage.setItem(`mapgen_props_tab_${node.type === 'text' ? 'text' : node.type === 'chart' ? 'chart' : 'regular'}`, node.type === 'text' ? 'transform' : 'layout');
  arrangeEmbeddedInTab = false;
  _arrangeState = null; renderArrangeOverlays();
  if (nodeId && nodes.some(item => item.id === nodeId)) selectNode(nodeId); else updatePropsPanel();
}

function applyArrange() {
  if (!_arrangeState) return;
  const node = nodes.find(item => item.id === _arrangeState.nodeId);
  _previewArrange(); // ensure final state is applied
  savedStateForCancel = null; // commit
  if (arrangeEmbeddedInTab && node) localStorage.setItem(`mapgen_props_tab_${node.type === 'text' ? 'text' : node.type === 'chart' ? 'chart' : 'regular'}`, node.type === 'text' ? 'transform' : 'layout');
  arrangeEmbeddedInTab = false;
  _arrangeState = null; renderArrangeOverlays(); pushHistory(); updatePropsPanel();
}

function redistributeNode(nodeId) {
  const beforeRedistribute = getSnapshot();
  distributePortLinks(nodeId);
  // Also redistribute the other endpoint of every link touching this node
  const touched = new Set();
  links.forEach(l => {
    if (l.from === nodeId) touched.add(l.to);
    if (l.to   === nodeId) touched.add(l.from);
  });
  touched.forEach(id => distributePortLinks(id));
  renderLinks(); updatePropsPanel();
  if (!revertIfLinksOverlap(beforeRedistribute)) pushHistory();
}

function renameNode(id, name) {
  const n = nodes.find(x => x.id === id); if (!n) return;
  const clean = name.trim();
  if (!clean || clean === n.name) { updatePropsPanel(); return; }
  n.name = clean;
  if (n.type === 'text') { autoFitTextNode(n); distributePortLinks(id); }
  renderNode(n); renderLinks(); updatePropsPanel(); pushHistory();
}

function updateNodeAppearance(id, field, rawValue) {
  const n = nodes.find(x => x.id === id); if (!n) return;
  const numericLimits = {fontSize:[8,120], nodeBorderWidth:[0,12], textBorderWidth:[0,12]};
  const colorFields = ['textColor','nodeBackground','nodeBorderColor','textBackground','textBorderColor'];
  const booleanFields = ['fontBold','fontItalic','nodeBackgroundTransparent','textBackgroundTransparent','nodeBorderHidden','textBorderHidden'];
  let value;
  if (numericLimits[field]) {
    const [min,max] = numericLimits[field];
    const parsed = Number(rawValue);
    value = Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : min));
  } else if (colorFields.includes(field)) {
    if (!/^#[0-9a-f]{6}$/i.test(String(rawValue))) return;
    value = String(rawValue).toLowerCase();
  } else if (booleanFields.includes(field)) {
    value = !!rawValue;
  } else if (field === 'fontFamily') {
    if (!NODE_FONTS.some(([font]) => font === rawValue)) return;
    value = rawValue;
  } else return;
  if (n[field] === value) { updatePropsPanel(); return; }

  const beforeStyle = getSnapshot();
  n[field] = value;
  n.appearanceOverride = true;
  const affectsTextSize = ['fontSize','fontFamily','fontBold','fontItalic','textBorderWidth','textBorderHidden'].includes(field);
  if (n.type === 'text' && affectsTextSize) {
    autoFitTextNode(n);
    distributePortLinks(id);
  }
  renderNode(n); renderLinks(); updatePropsPanel();
  const touching = links.filter(l => l.from===id || l.to===id).map(l => l.id);
  if (n.type === 'text' && affectsTextSize && revertIfLinksOverlap(beforeStyle, touching)) return;
  pushHistory();
  setStatus('Apariencia del nodo actualizada');
}

function useGeneralNodeAppearance(id) {
  const n = nodes.find(x => x.id === id); if (!n) return;
  const beforeReset = getSnapshot();
  Object.assign(n, getGeneralNodeAppearance(n.type));
  n.appearanceOverride = false;
  if (n.type === 'text') autoFitTextNode(n);
  distributePortLinks(id); renderNode(n); renderLinks(); updatePropsPanel();
  const touching = links.filter(l => l.from === id || l.to === id).map(l => l.id);
  if (!revertIfLinksOverlap(beforeReset, touching)) {
    pushHistory(); setStatus('Nodo vinculado a la apariencia general');
  }
}

function updateTextRotation(id, value) {
  const n = nodes.find(x => x.id===id); if (!n || n.type!=='text') return;
  const rotation = ((Math.round(Number(value) || 0) % 360) + 360) % 360;
  if (rotation === (Number(n.textRotation) || 0)) { updatePropsPanel(); return; }
  const beforeRotation = getSnapshot();
  n.textRotation = rotation; autoFitTextNode(n); distributePortLinks(id);
  renderNode(n); renderLinks(); updatePropsPanel();
  const touching = links.filter(l => l.from===id || l.to===id).map(l => l.id);
  if (!revertIfLinksOverlap(beforeRotation,touching)) {
    pushHistory(); setStatus(`Texto rotado a ${rotation}°`);
  }
}

function resizeNodeFromProps(id, dimension, value) {
  const n = nodes.find(x => x.id === id); if (!n || !['w','h'].includes(dimension)) return;
  const textMinimum = n.type === 'text' ? getTextNodeAutoSize(n) : {w:32,h:32};
  const next = Math.max(textMinimum[dimension], Math.min(2000, Math.round(Number(value) || 32)));
  if (next === n[dimension]) { updatePropsPanel(); return; }
  const beforeResize = getSnapshot();
  n[dimension] = next;
  if (n.type === 'text') {
    n.w = Math.max(n.w, textMinimum.w);
    n.h = Math.max(n.h, textMinimum.h);
  }
  n.sizeOverride = true;
  distributePortLinks(id);
  renderNode(n); renderLinks(); updatePropsPanel();
  if (!revertIfLinksOverlap(beforeResize)) {
    pushHistory();
    setStatus(`Tamaño actualizado: ${n.w} × ${n.h}`);
  }
}

function updateNodeLinkPadding(id, value) {
  const n = nodes.find(x => x.id === id); if (!n) return;
  const padding = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  if (padding === (n.linkPadding ?? DEFAULT_LINK_PADDING)) { updatePropsPanel(); return; }
  const beforePadding = getSnapshot();
  const touchingLinks = links.filter(l => l.from === id || l.to === id).map(l => l.id);
  n.linkPadding = padding;
  n.linkPaddingOverride = true;
  renderLinks(); updatePropsPanel();
  if (!revertIfLinksOverlap(beforePadding, touchingLinks)) {
    pushHistory();
    setStatus(`Separación de enlaces: ${padding}px`);
  }
}

function isImageSource(value) {
  return /^(https?:\/\/|data:image\/|blob:|\.\.?\/|\/)/i.test(value) ||
         /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value);
}

function setNodeVisual(id, value) {
  const n = nodes.find(x => x.id === id); if (!n) return;
  if (isImageSource(value)) n.image = value;
  else { n.image = null; n.icon = value || '⬜'; }
  renderNode(n); updatePropsPanel(); pushHistory();
  setStatus(n.image ? 'Imagen actualizada' : 'Icono actualizado');
}

function uploadNodeImage(id, input) {
  const file = input.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { setStatus('⚠ Selecciona un archivo de imagen'); return; }
  if (file.size > 2 * 1024 * 1024) { setStatus('⚠ La imagen debe pesar menos de 2 MB'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const n = nodes.find(x => x.id === id); if (!n) return;
    n.image = String(reader.result);
    renderNode(n); updatePropsPanel(); pushHistory();
    setStatus(`Imagen cargada: ${file.name}`);
  };
  reader.onerror = () => setStatus('⚠ No se pudo leer la imagen');
  reader.readAsDataURL(file);
}

function clearNodeImage(id) {
  const n = nodes.find(x => x.id === id); if (!n || !n.image) return;
  n.image = null;
  renderNode(n); updatePropsPanel(); pushHistory();
  setStatus('Imagen eliminada; se usa el icono');
}

function setNodeLabelOption(id, option, checked) {
  if (!['nameInside','hideName'].includes(option)) return;
  const n = nodes.find(x => x.id === id); if (!n) return;
  n[option] = !!checked;
  renderNode(n); updatePropsPanel(); pushHistory();
}

function updateLinkDescription(id, description) {
  const l = links.find(x => x.id === id); if (!l || l.description === description) return;
  l.description = description;
  renderLinks(); updatePropsPanel(); pushHistory();
  setStatus('Descripción del enlace actualizada');
}

function redrawLink(id) {
  const link = links.find(item => item.id === id); if (!link) return;
  const from = nodes.find(node => node.id === link.from);
  const to = nodes.find(node => node.id === link.to);
  if (!from || !to) return;
  const beforeRedraw = getSnapshot();
  const dx = to.x - from.x, dy = to.y - from.y;
  const fromPort = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
  const toPort = fromPort === 'right' ? 'left' : fromPort === 'left' ? 'right' : fromPort === 'bottom' ? 'top' : 'bottom';
  const fromSlot = closestFreePortSlot(from.id, fromPort, {x:to.x,y:to.y}, id);
  const toSlot = closestFreePortSlot(to.id, toPort, {x:from.x,y:from.y}, id);
  if (fromSlot !== null) setEndpointSlot(link, from.id, fromPort, fromSlot);
  if (toSlot !== null) setEndpointSlot(link, to.id, toPort, toSlot);
  link.waypoints = [];
  link.routeLane = 0;
  ensureDoubleArrowRoom(link);
  accommodateLinkOverlaps([id]);
  renderLinks(); updatePropsPanel(); pushHistory();
  setStatus('Enlace redibujado; sus datos y configuración se conservaron');
}

function cloneLink(id) {
  const source = links.find(item => item.id === id); if (!source) return;
  const from = nodes.find(node => node.id === source.from);
  const to = nodes.find(node => node.id === source.to);
  if (!from || !to) return;
  const fromPort = source.fromPort || 'center';
  const toPort = source.toPort || 'center';
  const fromSlot = fromPort === 'center' ? null : closestFreePortSlot(from.id, fromPort, getPortPos(from, fromPort, source.fromOffset || 0));
  const toSlot = toPort === 'center' ? null : closestFreePortSlot(to.id, toPort, getPortPos(to, toPort, source.toOffset || 0));
  if ((fromPort !== 'center' && fromSlot === null) || (toPort !== 'center' && toSlot === null)) {
    showAlert('No hay otra posición libre en uno de los lados del enlace. Reorganiza los puertos antes de clonarlo.', 'Lado completo');
    return;
  }
  linkCounter++;
  const clone = structuredClone(source);
  clone.id = `l${linkCounter}`;
  clone.waypoints = [];
  clone.routeLane = 0;
  if (fromSlot !== null) {
    clone.fromSlot = fromSlot;
    clone.fromOffset = portSlotOffset(from, fromPort, fromSlot);
  }
  if (toSlot !== null) {
    clone.toSlot = toSlot;
    clone.toOffset = portSlotOffset(to, toPort, toSlot);
  }
  links.push(clone);
  ensureDoubleArrowRoom(clone);
  accommodateLinkOverlaps([clone.id]);
  renderLinks(); updateCounter(); pushHistory(); selectLink(clone.id);
  setStatus('Enlace clonado; cambia únicamente la interfaz o fuente de datos');
}

function recalculateLinkUtilization(link) {
  const capacity = Math.max(.01, Number(link.capacity) || .01);
  link.capacity = capacity;
  link.inUsage = Math.max(0, Number(link.inUsage) || 0);
  link.outUsage = Math.max(0, Number(link.outUsage) || 0);
  link.inPct = Math.round(link.inUsage / capacity * 1000) / 10;
  link.outPct = Math.round(link.outUsage / capacity * 1000) / 10;
}

function updateLinkTraffic(id, field, rawValue) {
  const l = links.find(x => x.id === id); if (!l) return;
  let value;
  if (field === 'capacityUnit') {
    if (!LINK_CAPACITY_UNITS.includes(rawValue)) return;
    value = rawValue;
  } else if (field === 'capacity') {
    value = Math.max(.01, Number(rawValue) || .01);
  } else if (field === 'inUsage' || field === 'outUsage') {
    value = Math.max(0, Number(rawValue) || 0);
  } else return;
  if (l[field] === value) { updatePropsPanel(); return; }
  l[field] = value;
  recalculateLinkUtilization(l);
  renderLinks(); updatePropsPanel(); pushHistory();
  setStatus('Capacidad y utilización real actualizadas');
}

function updateLinkUsageLabel(id, field, rawValue) {
  const l = links.find(x => x.id === id); if (!l) return;
  let value;
  if (field === 'usageLabelPosition') {
    if (!['center','above','below'].includes(rawValue)) return;
    value = rawValue;
  } else if (field === 'usageLabelFormat') {
    if (!['percentage','human'].includes(rawValue)) return;
    value = rawValue;
  } else if (field === 'usageLabelRotate' || field === 'usageLabelFlip') value = !!rawValue;
  else return;
  if (l[field] === value) return;
  l[field] = value;
  l.usageLabelOverride = true;
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Texto de utilización actualizado');
}

function updateLinkCapacityLabel(id, field, rawValue) {
  const l = links.find(x => x.id === id); if (!l) return;
  let value;
  if (field === 'capacityLabelSide') {
    if (!['left','right'].includes(rawValue)) return;
    value = rawValue;
  } else if (field === 'capacityLabelFontSize') {
    value = Math.max(8, Math.min(72, Math.round(Number(rawValue) || 11)));
  } else if (['capacityLabelVisible','capacityLabelRotate','capacityLabelFlip'].includes(field)) value = !!rawValue;
  else return;
  if (l[field] === value) { updatePropsPanel(); return; }
  l[field] = value;
  l.capacityLabelOverride = true;
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Etiqueta de capacidad actualizada');
}

function updateLinkCapacityLabelPlacement(id, placement) {
  const l = links.find(x => x.id === id); if (!l) return;
  if (!['above','below','left','right'].includes(placement)) return;
  if (l.capacityLabelSide === placement) return;
  l.capacityLabelSide = placement;
  l.capacityLabelOverride = true;
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Posición de la capacidad actualizada');
}

function randomizeEditorLink(id) {
  const l = links.find(x => x.id===id); if (!l) return;
  l.editorInPct = Math.floor(Math.random()*101);
  l.editorOutPct = Math.floor(Math.random()*101);
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Valores ficticios del editor actualizados');
}

function updateLinkWidth(id, value) {
  const l = links.find(x => x.id === id); if (!l) return;
  const width = Math.max(1, Math.min(24, Math.round(Number(value) || 1)));
  if (width === l.width) { updatePropsPanel(); return; }
  const beforeStyle = getSnapshot();
  l.width = width;
  l.styleOverride = true;
  ensureDoubleArrowRoom(l);
  renderLinks(); updatePropsPanel();
  if (!revertIfLinksOverlap(beforeStyle, [id])) {
    pushHistory(); setStatus(`Tamaño del enlace: ${width}px`);
  }
}

function updateLinkTermination(id, value) {
  if (!MID_TERMINATIONS.some(([type]) => type === value)) return;
  const l = links.find(x => x.id === id); if (!l || l.midTermination === value) return;
  const beforeStyle = getSnapshot();
  l.midTermination = value;
  l.styleOverride = true;
  ensureDoubleArrowRoom(l);
  renderLinks(); updatePropsPanel();
  if (!revertIfLinksOverlap(beforeStyle, [id])) {
    pushHistory(); setStatus('Terminación del enlace actualizada');
  }
}

function previewLinkDivider(id, value) {
  const l = links.find(x => x.id === id); if (!l) return;
  l.dividerPosition = Math.max(5, Math.min(95, Math.round(Number(value) || 50)));
  l.dividerPositionOverride = true;
  renderLinks();
  const label = document.getElementById('divider-position-value');
  if (label) label.textContent = `${l.dividerPosition}%`;
}

function commitLinkDivider(id, value, startValue) {
  const l = links.find(x => x.id === id); if (!l) return;
  const start = Math.max(5, Math.min(95, Math.round(Number(startValue) || 50)));
  previewLinkDivider(id, value);
  if (l.dividerPosition !== start) pushHistory();
  updatePropsPanel();
  setStatus(`Posición del divisor: ${l.dividerPosition}%`);
}

function setLinkScaleOverride(id, enabled) {
  const l = links.find(x => x.id === id); if (!l || l.scaleOverride === enabled) return;
  l.scaleOverride = enabled;
  l.scale = enabled ? currentScale.map(item => ({...item})) : null;
  renderLinks(); updatePropsPanel(); pushHistory();
  setStatus(enabled ? 'Umbrales individuales habilitados' : 'El enlace usa los umbrales generales');
}

function updateLinkThresholdPct(id, index, rawValue) {
  const l = links.find(x => x.id === id); if (!l?.scaleOverride || !Array.isArray(l.scale)) return;
  const item = l.scale[index]; if (!item) return;
  const min = index > 0 ? l.scale[index-1].pct + 1 : 0;
  const max = index < l.scale.length-1 ? l.scale[index+1].pct - 1 : 100;
  const value = Math.max(min, Math.min(max, Math.round(Number(rawValue) || 0)));
  if (value === item.pct) { updatePropsPanel(); return; }
  item.pct = value;
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Umbral individual actualizado');
}

function updateLinkThresholdColor(id, index, color) {
  const l = links.find(x => x.id === id); if (!l?.scaleOverride || !Array.isArray(l.scale)) return;
  if (!/^#[0-9a-f]{6}$/i.test(color) || !l.scale[index] || l.scale[index].color === color) return;
  l.scale[index].color = color.toLowerCase();
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Color del umbral actualizado');
}

function addLinkThreshold(id) {
  const l = links.find(x => x.id === id); if (!l?.scaleOverride || !Array.isArray(l.scale)) return;
  let gapIndex = -1, largestGap = 0;
  for (let i=0; i<l.scale.length-1; i++) {
    const gap = l.scale[i+1].pct - l.scale[i].pct;
    if (gap > largestGap) { largestGap = gap; gapIndex = i; }
  }
  if (gapIndex < 0 || largestGap <= 1) { setStatus('No hay espacio para otro umbral'); return; }
  const pct = Math.floor((l.scale[gapIndex].pct + l.scale[gapIndex+1].pct) / 2);
  const color = lerpColor(l.scale[gapIndex].color, l.scale[gapIndex+1].color, .5);
  l.scale.splice(gapIndex+1, 0, {pct,color});
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Umbral individual agregado');
}

function removeLinkThreshold(id, index) {
  const l = links.find(x => x.id === id); if (!l?.scaleOverride || !Array.isArray(l.scale) || l.scale.length <= 2) return;
  l.scale.splice(index,1);
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Umbral individual eliminado');
}

function copyGeneralScaleToLink(id) {
  const l = links.find(x => x.id === id); if (!l) return;
  l.scaleOverride = true;
  l.scale = currentScale.map(item => ({...item}));
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Umbrales generales copiados al enlace');
}

function renderConfigUI() {
  const values = {
    'cfg-node-width': generalConfig.nodeWidth,
    'cfg-node-height': generalConfig.nodeHeight,
    'cfg-link-padding': generalConfig.linkPadding,
    'cfg-link-width': generalConfig.linkWidth,
    'cfg-divider-position': generalConfig.dividerPosition,
    'cfg-capacity-label-font-size':generalConfig.capacityLabelFontSize,
    'cfg-regular-font-size':generalConfig.regularFontSize, 'cfg-regular-font-family':generalConfig.regularFontFamily,
    'cfg-regular-text-color':generalConfig.regularTextColor, 'cfg-regular-node-background':generalConfig.regularNodeBackground,
    'cfg-regular-node-border-color':generalConfig.regularNodeBorderColor, 'cfg-regular-node-border-width':generalConfig.regularNodeBorderWidth,
    'cfg-regular-text-background':generalConfig.regularTextBackground, 'cfg-regular-text-border-color':generalConfig.regularTextBorderColor,
    'cfg-regular-text-border-width':generalConfig.regularTextBorderWidth,
    'cfg-text-node-font-size':generalConfig.textNodeFontSize, 'cfg-text-node-font-family':generalConfig.textNodeFontFamily,
    'cfg-text-node-text-color':generalConfig.textNodeTextColor, 'cfg-text-node-background':generalConfig.textNodeBackground,
    'cfg-text-node-border-color':generalConfig.textNodeBorderColor, 'cfg-text-node-border-width':generalConfig.textNodeBorderWidth,
    'cfg-text-node-text-background':generalConfig.textNodeTextBackground, 'cfg-text-node-text-border-color':generalConfig.textNodeTextBorderColor,
    'cfg-text-node-text-border-width':generalConfig.textNodeTextBorderWidth
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id); if (el) el.value = value;
  });
  [
    ['cfg-mid-termination-host', 'cfg-mid-termination', generalConfig.midTermination, SEG_OPTIONS.marker, "updateGeneralConfig('midTermination','%v')", false],
    ['cfg-usage-label-format-host', 'cfg-usage-label-format', generalConfig.usageLabelFormat, SEG_OPTIONS.usageFormat, "updateGeneralConfig('usageLabelFormat','%v')", false],
    ['cfg-usage-label-position-host', 'cfg-usage-label-position', generalConfig.usageLabelPosition, SEG_OPTIONS.usagePosition, "updateGeneralConfig('usageLabelPosition','%v')", false],
    ['cfg-capacity-label-placement-host', 'cfg-capacity-label-placement', ['above','below','left','right'].includes(generalConfig.capacityLabelSide) ? generalConfig.capacityLabelSide : 'right', SEG_OPTIONS.placement, "updateGeneralCapacityLabelPlacement('%v')", generalConfig.capacityLabelVisible === false]
  ].forEach(([host, name, value, options, call, disabled]) => {
    const el = document.getElementById(host);
    if (el) el.innerHTML = segToggleHtml(name, value, options, call, { disabled });
  });
  const dividerLabel = document.getElementById('cfg-divider-position-value');
  if (dividerLabel) dividerLabel.textContent = `${generalConfig.dividerPosition}%`;
  const rotateLabel = document.getElementById('cfg-usage-label-rotate');
  if (rotateLabel) rotateLabel.checked = !!generalConfig.usageLabelRotate;
  const flipLabel = document.getElementById('cfg-usage-label-flip');
  if (flipLabel) {
    flipLabel.checked = !!generalConfig.usageLabelFlip;
    flipLabel.disabled = !generalConfig.usageLabelRotate;
  }
  const capacityVisible = document.getElementById('cfg-capacity-label-visible');
  if (capacityVisible) capacityVisible.checked = generalConfig.capacityLabelVisible !== false;
  const capacityFontSize = document.getElementById('cfg-capacity-label-font-size');
  if (capacityFontSize) capacityFontSize.disabled = generalConfig.capacityLabelVisible === false;
  const capacityRotate = document.getElementById('cfg-capacity-label-rotate');
  if (capacityRotate) {
    capacityRotate.checked = !!generalConfig.capacityLabelRotate;
    capacityRotate.disabled = generalConfig.capacityLabelVisible === false;
  }
  const capacityFlip = document.getElementById('cfg-capacity-label-flip');
  if (capacityFlip) {
    capacityFlip.checked = !!generalConfig.capacityLabelFlip;
    capacityFlip.disabled = generalConfig.capacityLabelVisible === false || !generalConfig.capacityLabelRotate;
  }
  const checks = {
    'cfg-regular-font-bold':generalConfig.regularFontBold, 'cfg-regular-font-italic':generalConfig.regularFontItalic,
    'cfg-regular-node-background-transparent':generalConfig.regularNodeBackgroundTransparent,
    'cfg-regular-node-border-hidden':generalConfig.regularNodeBorderHidden,
    'cfg-regular-text-background-transparent':generalConfig.regularTextBackgroundTransparent,
    'cfg-regular-text-border-hidden':generalConfig.regularTextBorderHidden,
    'cfg-text-node-font-bold':generalConfig.textNodeFontBold, 'cfg-text-node-font-italic':generalConfig.textNodeFontItalic,
    'cfg-text-node-background-transparent':generalConfig.textNodeBackgroundTransparent,
    'cfg-text-node-border-hidden':generalConfig.textNodeBorderHidden,
    'cfg-text-node-text-background-transparent':generalConfig.textNodeTextBackgroundTransparent,
    'cfg-text-node-text-border-hidden':generalConfig.textNodeTextBorderHidden
  };
  Object.entries(checks).forEach(([id, checked]) => { const el=document.getElementById(id); if (el) el.checked=!!checked; });
  [
    ['cfg-regular-node-background',generalConfig.regularNodeBackgroundTransparent],
    ['cfg-regular-node-border-color',generalConfig.regularNodeBorderHidden], ['cfg-regular-node-border-width',generalConfig.regularNodeBorderHidden],
    ['cfg-regular-text-background',generalConfig.regularTextBackgroundTransparent],
    ['cfg-regular-text-border-color',generalConfig.regularTextBorderHidden], ['cfg-regular-text-border-width',generalConfig.regularTextBorderHidden],
    ['cfg-text-node-background',generalConfig.textNodeBackgroundTransparent],
    ['cfg-text-node-border-color',generalConfig.textNodeBorderHidden], ['cfg-text-node-border-width',generalConfig.textNodeBorderHidden],
    ['cfg-text-node-text-background',generalConfig.textNodeTextBackgroundTransparent],
    ['cfg-text-node-text-border-color',generalConfig.textNodeTextBorderHidden], ['cfg-text-node-text-border-width',generalConfig.textNodeTextBorderHidden]
  ].forEach(([id, disabled]) => { const el=document.getElementById(id); if (el) el.disabled=!!disabled; });
}

function updateGeneralConfig(field, rawValue) {
  const numericLimits = {
    nodeWidth:[32,2000], nodeHeight:[32,2000], linkPadding:[0,100], linkWidth:[1,24], dividerPosition:[5,95],
    regularFontSize:[8,120], regularNodeBorderWidth:[0,12], regularTextBorderWidth:[0,12],
    textNodeFontSize:[8,120], textNodeBorderWidth:[0,12], textNodeTextBorderWidth:[0,12],
    capacityLabelFontSize:[8,72]
  };
  const appearanceMeta = GENERAL_NODE_APPEARANCE[field];
  let value = rawValue;
  if (numericLimits[field]) {
    const [min, max] = numericLimits[field];
    value = Math.max(min, Math.min(max, Number(rawValue)));
    if (!Number.isFinite(value)) value = min;
    if (!field.endsWith('BorderWidth')) value = Math.round(value);
  } else if (appearanceMeta?.[1].endsWith('Color') || ['textColor','nodeBackground','textBackground'].includes(appearanceMeta?.[1])) {
    if (!/^#[0-9a-f]{6}$/i.test(String(rawValue))) return;
    value = String(rawValue).toLowerCase();
  } else if (appearanceMeta?.[1] === 'fontFamily') {
    if (!NODE_FONTS.some(([font]) => font === rawValue)) return;
  } else if (appearanceMeta && ['fontBold','fontItalic','nodeBackgroundTransparent','nodeBorderHidden','textBackgroundTransparent','textBorderHidden'].includes(appearanceMeta[1])) {
    value = !!rawValue;
  } else if (field === 'midTermination') {
    if (!MID_TERMINATIONS.some(([type]) => type === value)) return;
  } else if (field === 'usageLabelFormat') {
    if (!['percentage','human'].includes(value)) return;
  } else if (field === 'usageLabelPosition') {
    if (!['center','above','below'].includes(value)) return;
  } else if (field === 'capacityLabelSide') {
    if (!['left','right','above','below'].includes(value)) return;
  } else if (field === 'usageLabelRotate' || field === 'usageLabelFlip') {
    value = !!rawValue;
  } else if (['capacityLabelVisible','capacityLabelRotate','capacityLabelFlip'].includes(field)) {
    value = !!rawValue;
  } else return;
  const beforeConfig = getSnapshot();
  generalConfig[field] = value;
  if (appearanceMeta) {
    const [target, nodeField] = appearanceMeta;
    nodes.filter(n => target === 'text' ? n.type === 'text' : n.type !== 'text').forEach(n => {
      n[nodeField] = value;
      if (n.type === 'text' && ['fontSize','fontFamily','fontBold','fontItalic','textBorderWidth','textBorderHidden'].includes(nodeField)) autoFitTextNode(n);
      renderNode(n);
      distributePortLinks(n.id);
    });
  } else if (field === 'nodeWidth' || field === 'nodeHeight') {
    const dimension = field === 'nodeWidth' ? 'w' : 'h';
    nodes.forEach(n => { n[dimension] = value; renderNode(n); });
    nodes.forEach(n => distributePortLinks(n.id));
  } else if (field === 'linkPadding') {
    nodes.forEach(n => { n.linkPadding = value; });
  } else if (field === 'linkWidth') {
    links.forEach(l => { l.width = value; });
  } else if (field === 'dividerPosition') {
    links.forEach(l => { l.dividerPosition = value; });
  } else if (['usageLabelFormat','usageLabelPosition','usageLabelRotate','usageLabelFlip'].includes(field)) {
    links.forEach(l => { l[field] = value; });
  } else if (['capacityLabelVisible','capacityLabelSide','capacityLabelRotate','capacityLabelFlip','capacityLabelFontSize'].includes(field)) {
    links.forEach(l => { l[field] = value; });
  } else {
    links.forEach(l => { l[field] = value; });
  }
  links.forEach(ensureDoubleArrowRoom);

  renderLinks(); renderConfigUI();
  if (!revertIfLinksOverlap(beforeConfig, links.map(l => l.id))) {
    pushHistory();
    if (placingItem)
      document.getElementById('preview-box').style.cssText = `width:${generalConfig.nodeWidth}px;height:${generalConfig.nodeHeight}px`;
    setStatus('Configuración general forzada en todos los elementos');
  }
}

function updateGeneralCapacityLabelPlacement(placement) {
  if (!['above','below','left','right'].includes(placement)) return;
  generalConfig.capacityLabelSide = placement;
  links.forEach(l => { l.capacityLabelSide = placement; });
  renderLinks(); renderConfigUI(); pushHistory();
  setStatus('Posición general forzada en todos los enlaces');
}

function useGeneralNodeConfig(id) {
  const n = nodes.find(x => x.id === id); if (!n) return;
  const beforeReset = getSnapshot();
  n.w = generalConfig.nodeWidth; n.h = generalConfig.nodeHeight;
  n.linkPadding = generalConfig.linkPadding;
  n.sizeOverride = false; n.linkPaddingOverride = false;
  distributePortLinks(id); renderNode(n); renderLinks(); updatePropsPanel();
  const touching = links.filter(l => l.from === id || l.to === id).map(l => l.id);
  if (!revertIfLinksOverlap(beforeReset, touching)) {
    pushHistory(); setStatus('Nodo vinculado a la configuración general');
  }
}

function useGeneralLinkConfig(id) {
  const l = links.find(x => x.id === id); if (!l) return;
  const beforeReset = getSnapshot();
  l.width = generalConfig.linkWidth;
  l.midTermination = generalConfig.midTermination;
  l.dividerPosition = generalConfig.dividerPosition;
  l.dividerPositionOverride = false;
  l.usageLabelFormat = generalConfig.usageLabelFormat;
  l.usageLabelPosition = generalConfig.usageLabelPosition;
  l.usageLabelRotate = generalConfig.usageLabelRotate;
  l.usageLabelFlip = generalConfig.usageLabelFlip;
  l.usageLabelOverride = false;
  l.capacityLabelVisible = generalConfig.capacityLabelVisible;
  l.capacityLabelSide = generalConfig.capacityLabelSide;
  l.capacityLabelRotate = generalConfig.capacityLabelRotate;
  l.capacityLabelFlip = generalConfig.capacityLabelFlip;
  l.capacityLabelFontSize = generalConfig.capacityLabelFontSize;
  l.capacityLabelOverride = false;
  l.styleOverride = false;
  ensureDoubleArrowRoom(l);
  renderLinks(); updatePropsPanel();
  if (!revertIfLinksOverlap(beforeReset, [id])) {
    pushHistory(); setStatus('Enlace vinculado a la configuración general');
  }
}


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
  localStorage.setItem('mapgen_grid_enabled', String(gridEnabled));
  updateMenuState();
  setStatus(gridEnabled ? 'Cuadrícula visible' : 'Cuadrícula oculta');
}
function setSnapEnabled(enabled) {
  snapEnabled = !!enabled;
  localStorage.setItem('mapgen_snap_enabled', String(snapEnabled));
  updateMenuState();
  setStatus(snapEnabled ? 'Ajuste magnético activado' : 'Ajuste magnético desactivado');
}
function setAutoOrderEnabled(enabled) {
  autoOrderEnabled = !!enabled;
  localStorage.setItem('mapgen_auto_order_enabled', String(autoOrderEnabled));
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
    <button type="button" class="hotkey-capture" onkeydown="captureHotkey(event,'${tool.id}')" aria-label="Cambiar atajo de ${tool.label}" title="Haz clic y presiona una tecla"><kbd>${hotkeyDraft[tool.id].toUpperCase()}</kbd><small>Cambiar</small></button>
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
  localStorage.setItem('mapgen_tool_hotkeys', JSON.stringify(toolHotkeys));
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
document.addEventListener('keydown', e => {
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
    localStorage.setItem('mapgen_current_server_id', currentServerMapId);
    localStorage.setItem('mapgen_current_server_name', currentServerMapName);
    localStorage.setItem('mapgen_current_server_date', date);
  } else {
    localStorage.removeItem('mapgen_current_server_id');
    localStorage.removeItem('mapgen_current_server_name');
    localStorage.removeItem('mapgen_current_server_date');
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
    localStorage.setItem('mapgen_current_server_date', selectedMapDate);
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
      localStorage.setItem('mapgen_current_server_date', selectedMapDate);
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
      <div class="map-card" data-id="${map.id}" data-name="${escapeHtml(map.name.toLowerCase())}" onclick="openServerMap('${map.id}');closeMapModal()">
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
  const n = nodes.find(x => x.id === id);
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
const _storedTheme = localStorage.getItem('mapgen_theme') || 'dark';
let activeTheme = THEMES[_storedTheme] ? _storedTheme : (LEGACY_THEME_MAP[_storedTheme] || 'dark');

function applyTheme(name) {
  const theme = THEMES[name];
  if (!theme) return;
  activeTheme = name;
  const root = document.documentElement;
  root.dataset.theme = name;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  localStorage.setItem('mapgen_theme', name);
  document.getElementById('tool-theme')?.classList.remove('active');
}

function toggleTheme() {
  applyTheme(activeTheme === 'dark' ? 'light' : 'dark');
  saveLocalDraft();
  setStatus(`Tema: ${THEMES[activeTheme].name}`);
}

renderScaleUI();
renderConfigUI();
applyTheme(activeTheme);
const localDraftRestored = restoreLocalDraft();
if (!localDraftRestored) loadDemo();
updateMenuState();
document.getElementById('presentation-date').value = selectedMapDate;
document.getElementById('presentation-refresh').value = String(presentationRefreshMinutes);
updatePresentationViewControls();
updatePaletteHotkeyTitles();
// Seed history with the initial state so undo can't go below it
history = [getSnapshot()]; historyIdx = 0; updateUndoBtns();
if (localDraftRestored) {
  setStatus('✓ Borrador local recuperado');
  showToast('Tu avance se restauró automáticamente.', 'success');
}
// Restore the active server map after a refresh. If its selected date no longer
// exists, openServerMap transparently falls back to the latest saved snapshot.
if (currentServerMapId && !localDraftRestored) openServerMap(currentServerMapId, selectedMapDate);
window.addEventListener('beforeunload', () => {
  if (localDraftEnabled) saveLocalDraft();
});
