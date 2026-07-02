// ════════════════════════════════════════════════════
// SAFE STORAGE
// ════════════════════════════════════════════════════
// localStorage lanza en modo privado o cuando la cuota está llena; estos
// envoltorios degradan silenciosamente en vez de romper el editor.
function lsGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { console.warn('localStorage no disponible:', e); } }
function lsRemove(key) { try { localStorage.removeItem(key); } catch { /* sin persistencia */ } }

// Fetch que se aborta tras `ms` para que una petición colgada no bloquee el
// polling: sin esto, un refresh que nunca resuelve deja el guard en vuelo
// activo y el auto-refresco se detiene de forma silenciosa.
async function fetchWithTimeout(url, options = {}, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════
let nodes = [], links = [];
let selectedId = null, selectedLinkId = null;
let selectedNodeIds = new Set();   // multi-selection; selectedId = primary (last picked)
let selectedLinkIds = new Set();   // multi-selection of links (marquee / shift-click)
let nodeCounter = 0, linkCounter = 0;
let gridEnabled = lsGet('mapgen_grid_enabled') !== 'false';
let snapEnabled = lsGet('mapgen_snap_enabled') !== 'false';
let autoOrderEnabled = lsGet('mapgen_auto_order_enabled') === 'true';
// Hide link tags (usage + capacity labels) in the editor only; presentation
// always shows them. Persisted so the choice survives reloads.
let editorTagsHidden = lsGet('mapgen_editor_tags_hidden') === 'true';
let presentationMode = false;
let presentationViewMode = lsGet('mapgen_presentation_view_mode') === 'day' ? 'day' : 'live';
const PRESENTATION_REFRESH_OPTIONS = [5,10,15,30,60];
let presentationRefreshMinutes = Number(lsGet('mapgen_presentation_refresh')) || 5;
if (!PRESENTATION_REFRESH_OPTIONS.includes(presentationRefreshMinutes)) presentationRefreshMinutes = 5;
let presentationRefreshTimer = null;
let presentationRefreshInFlight = false;
const localToday = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};
let selectedMapDate = lsGet('mapgen_current_server_date') || localToday();
let currentServerMapId = lsGet('mapgen_current_server_id') || null;
let currentServerMapName = lsGet('mapgen_current_server_name') || '';
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
    const saved = JSON.parse(lsGet('mapgen_tool_hotkeys') || '{}');
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
const GRID = 20, DEFAULT_LINK_PADDING = 12, PORT_SLOT_COUNT = 11; let zoom = 1;
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
// ID INDEX
// ════════════════════════════════════════════════════
// O(1) lookup by id. The cache rebuilds when the array reference or length
// changes; ids are immutable once assigned and every add/remove changes the
// length, so this stays correct without touching every mutation site.
let _nodeIndex = null, _nodeIndexRef = null, _nodeIndexLen = -1;
let _linkIndex = null, _linkIndexRef = null, _linkIndexLen = -1;
function getNode(id) {
  if (_nodeIndexRef !== nodes || _nodeIndexLen !== nodes.length) {
    _nodeIndex = new Map(nodes.map(n => [n.id, n]));
    _nodeIndexRef = nodes; _nodeIndexLen = nodes.length;
  }
  return _nodeIndex.get(id);
}
function getLink(id) {
  if (_linkIndexRef !== links || _linkIndexLen !== links.length) {
    _linkIndex = new Map(links.map(l => [l.id, l]));
    _linkIndexRef = links; _linkIndexLen = links.length;
  }
  return _linkIndex.get(id);
}

// ════════════════════════════════════════════════════
// EVENT DELEGATION
// ════════════════════════════════════════════════════
// Declarative handlers replace inline on*= attributes so the CSP can drop
// 'unsafe-inline' from script-src. An element carries data-<event>="fnName"
// (e.g. data-click, data-change) plus optional data-args='[...]' whose string
// tokens are resolved at call time: $value, $valueNum, $checked, $self, $event.
function resolveActionArg(token, el, event) {
  switch (token) {
    case '$value': return el.value;
    case '$valueNum': return Number(el.value);
    case '$checked': return el.checked;
    case '$self': return el;
    case '$event': return event;
    default: return token;
  }
}
function runDataAction(el, key, event) {
  const fn = window[el.dataset[key]];
  if (typeof fn !== 'function') return;
  let args = [];
  // Per-event args (data-<event>-args) let one element carry several handlers
  // with different arguments; otherwise fall back to the shared data-args.
  const raw = el.dataset[key + 'Args'] ?? el.dataset.args;
  if (raw) { try { args = JSON.parse(raw).map(t => resolveActionArg(t, el, event)); } catch { args = []; } }
  return fn.apply(null, args);
}
// eventType: real DOM event; key: dataset property (camelCase) / attribute (kebab).
const DELEGATED_EVENTS = [
  ['click', 'click'], ['change', 'change'], ['input', 'input'],
  ['keydown', 'keydown'], ['mousedown', 'mdown'], ['dblclick', 'dblclick'],
  ['dragstart', 'dragstart'], ['dragover', 'dragover'], ['drop', 'drop'],
  ['dragleave', 'dragleave'], ['focusout', 'blur'],
];
function setupActionDelegation() {
  for (const [eventType, key] of DELEGATED_EVENTS) {
    const attr = 'data-' + key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    document.addEventListener(eventType, event => {
      const el = event.target.closest(`[${attr}]`);
      if (!el) return;
      runDataAction(el, key, event);
    });
  }
}

// Small wrappers for the few handlers that chained calls or ran inline logic.
function toolSelectReset() { cancelPlacing(); setTool('select'); }
function toolLinkReset() { cancelPlacing(); setTool('link'); }
function openMapPickerReplace() { openMapPicker(); closeMapModal(); }
function syncDividerPositionLabel(el) {
  const out = document.getElementById('cfg-divider-position-value');
  if (out) out.textContent = el.value + '%';
}
function handlePromptKey(event) {
  if (event.key === 'Enter') resolvePrompt();
  if (event.key === 'Escape') resolvePrompt(null);
}
// Wrappers for generated handlers that chained calls or ran inline drag logic.
function dragAllow(event) { event.preventDefault(); }
function arrangeSectionDragOver(event, el) { event.preventDefault(); el.style.background = 'color-mix(in srgb, var(--accent) 8%, transparent)'; }
function arrangeSectionDragLeave(el) { el.style.background = ''; }
function arrangeSectionDrop(event, side, el) { _arrangeDropOnSection(event, side); el.style.background = ''; }
function openServerMapAndClose(id) { openServerMap(id); closeMapModal(); }
// Convert a legacy "fn('a','%v')" call template (used by seg toggles) into
// delegation data-* attributes, mapping '%v'/this.value to the $value token.
function callTemplateToData(callTemplate, eventName = 'change') {
  const m = /^(\w+)\((.*)\)$/.exec(callTemplate.trim());
  if (!m) return '';
  const args = m[2].trim() === '' ? [] : m[2].split(',').map(t => {
    t = t.trim();
    if (t === "'%v'" || t === '%v' || t === 'this.value') return '$value';
    if (t === 'this.checked') return '$checked';
    if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1);
    const n = Number(t); return Number.isNaN(n) ? t : n;
  });
  return `data-${eventName}="${m[1]}"` + (args.length ? ` data-args='${JSON.stringify(args)}'` : '');
}
