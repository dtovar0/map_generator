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
        + `<input type="radio" name="${name}" value="${val}" ${String(val) === String(value) ? 'checked' : ''}${dis ? ' disabled' : ''} ${callTemplateToData(call)} />`
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
          <input type="color" value="${item.color}" data-change="updateLinkThresholdColor" data-args='["${link.id}",${index},"$value"]' />
          <div class="sth-swatch" style="background:${item.color}"></div>
        </div>
        <div class="sth-pct-wrap">
          <input class="sth-pct" type="number" min="0" max="100" value="${item.pct}"
                 data-change="updateLinkThresholdPct" data-args='["${link.id}",${index},"$value"]' />
          <span class="sth-pct-unit">%</span>
        </div>
        <div style="flex:1;height:10px;border-radius:3px;background:${item.color}"></div>
        ${scale.length > 2 ? `<button class="sth-del" data-click="removeLinkThreshold" data-args='["${link.id}",${index}]' title="Eliminar">✕</button>` : '<div style="width:22px"></div>'}
      </div>`).join('')}
    <div style="display:flex;gap:5px;margin-top:7px">
      <button class="tb-btn" style="flex:1;font-size:10px" data-click="addLinkThreshold" data-args='["${link.id}"]'>+ Umbral</button>
      <button class="tb-btn" style="flex:1;font-size:10px" data-click="copyGeneralScaleToLink" data-args='["${link.id}"]'>Copiar general</button>
    </div>`;
}
function iconGridHtml(node) {
  return `<div class="icon-grid">${NODE_ICONS.map(icon => `
    <button class="icon-choice ${!node.image && node.icon===icon ? 'selected' : ''}"
            title="${icon}" data-click="setNodeVisual" data-args='["${node.id}","${icon}"]'>${icon}</button>`).join('')}</div>`;
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
  let activeKey = lsGet(storageKey);
  if (!availableKeys.includes(activeKey)) activeKey = tabs[0][0];
  // Never auto-open "arrange" on a fresh selection; keep it only while the arrange view is active.
  if (activeKey === 'arrange' && !document.body.classList.contains('arranging')) activeKey = tabs[0][0];
  const activate = key => {
    activeKey = key; lsSet(storageKey, key);
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
  let activeKey = lsGet('mapgen_config_tab');
  if (!tabs.some(([key]) => key === activeKey)) activeKey = 'general';
  const activate = key => {
    activeKey = key; lsSet('mapgen_config_tab', key);
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
  setStatus('Alineación custom: elige el nodo de referencia (esquina); cada nodo se alineará a su fila o columna');
}
function alignSelectionToReferenceNode(referenceId) {
  const pending = customAlignmentPending;
  if (!pending) return;
  if (!pending.nodeIds.has(referenceId)) {
    setStatus('El nodo de referencia debe pertenecer a la selección de nodos');
    return;
  }
  const reference = getNode(referenceId);
  if (!reference) { cancelCustomAlignment(); return; }
  // Align each node to the reference on whichever axis it is already closer to:
  // a node beside the reference snaps to its row (same y), a node above/below
  // snaps to its column (same x). Forcing every node onto a single axis made
  // 3+ nodes collapse onto one line and overlap; per-axis alignment lets them
  // form a row/column (an L around the reference) instead.
  let affected = 0;
  nodes.forEach(node => {
    if (!pending.nodeIds.has(node.id) || node.id === referenceId) return;
    const field = Math.abs(node.x - reference.x) <= Math.abs(node.y - reference.y) ? 'x' : 'y';
    if (node[field] !== reference[field]) affected++;
    node[field] = reference[field];
    renderNode(node);
  });
  cancelCustomAlignment();
  renderLinks();
  if (affected) pushHistory();
  updatePropsPanel();
  setStatus(`Alineación custom: ${affected} nodo${affected === 1 ? '' : 's'} alineado${affected === 1 ? '' : 's'} a ${reference.name}`);
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
        <label><span>Ancho</span><input type="number" min="32" max="2000" value="${multiSelectionDimension('w')}" data-change="resizeSelectedNodes" data-args='["w","$value"]'><small>px</small></label>
        <label><span>Alto</span><input type="number" min="32" max="2000" value="${multiSelectionDimension('h')}" data-change="resizeSelectedNodes" data-args='["h","$value"]'><small>px</small></label>
        <label class="ins-spacing-control"><span>Separación ${spacingDirection}</span><input type="number" min="0" max="2000" value="${multiSelectionSpacing(alignment)}" data-change="setMultiSelectionSpacing" data-args='["$value"]'><small>px</small></label>
      </div>
      <div class="ins-actions">
        <button class="tb-btn ins-align-btn" data-click="alignSelectionAutomatically" ${alignment ? '' : 'disabled'}
                title="Detecta la orientación dominante y alinea los centros">${alignmentLabel}</button>
        <button class="tb-btn" data-click="startCustomAlignment" ${alignment ? '' : 'disabled'}
                title="Después selecciona el nodo que servirá como referencia">Alineación custom</button>
        <button class="tb-btn" data-click="deleteSelected">Eliminar selección</button>
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
    const n = getNode(selectedId); if (!n) return;
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
               data-change="renameNode" data-args='["${n.id}",this.value.trim()]' />
      </div>
      <div class="prop-row">
        <div class="prop-label">Tipografía</div>
        <select class="prop-val" data-change="updateNodeAppearance" data-args='["${n.id}","fontFamily","$value"]'>
          ${nodeFontOptions(n.fontFamily || 'system-ui')}
        </select>
        <div class="format-toolbar">
          <div class="prop-pair">
            <input class="prop-val coord" type="number" min="8" max="120" value="${getNodeFontSize(n)}"
                   title="Tamaño de fuente" data-change="updateNodeAppearance" data-args='["${n.id}","fontSize","$value"]' />
            <span style="font-size:11px;color:var(--text2)">px</span>
          </div>
          <div class="text-format-group" role="group" aria-label="Estilo de texto">
            <label class="format-toggle" data-format="bold" title="Negrita"><input type="checkbox" ${n.fontBold?'checked':''}
                   data-change="updateNodeAppearance" data-args='["${n.id}","fontBold","$checked"]' /><span class="format-glyph" aria-hidden="true">B</span></label>
            <label class="format-toggle" data-format="italic" title="Cursiva"><input type="checkbox" ${n.fontItalic?'checked':''}
                   data-change="updateNodeAppearance" data-args='["${n.id}","fontItalic","$checked"]' /><span class="format-glyph" aria-hidden="true">I</span></label>
          </div>
        </div>
        <div class="prop-label" style="margin-top:7px">Color del texto</div>
        <input class="prop-val" type="color" value="${textColor}" style="height:31px;padding:3px"
               data-change="updateNodeAppearance" data-args='["${n.id}","textColor","$value"]' />
      </div>
      <div class="prop-row">
        <div class="prop-label">Apariencia del nodo</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <label style="font-size:10px;color:var(--text2)">Fondo
            <input class="prop-val" type="color" value="${nodeBg}" style="height:31px;padding:3px" ${nodeBgTransparent?'disabled':''}
                   data-change="updateNodeAppearance" data-args='["${n.id}","nodeBackground","$value"]' />
          </label>
          <label style="font-size:10px;color:var(--text2)">Borde
            <input class="prop-val" type="color" value="${nodeBorder}" style="height:31px;padding:3px" ${nodeBorderHidden?'disabled':''}
                   data-change="updateNodeAppearance" data-args='["${n.id}","nodeBorderColor","$value"]' />
          </label>
        </div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${nodeBgTransparent?'checked':''}
               data-change="updateNodeAppearance" data-args='["${n.id}","nodeBackgroundTransparent","$checked"]' /> Fondo transparente</label>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${nodeBorderHidden?'checked':''}
               data-change="updateNodeAppearance" data-args='["${n.id}","nodeBorderHidden","$checked"]' /> Ocultar borde del nodo</label>
        <div class="stack-field${nodeBorderHidden?' is-disabled':''}">
          <span class="stack-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 17h18"/></svg></span>
          <span class="stack-field-copy">Grosor del borde</span>
          <div class="input-unit stack-field-control">
            <input class="prop-val coord" type="number" min="0" max="12" step="0.5" ${nodeBorderHidden?'disabled':''}
                   value="${n.nodeBorderWidth ?? 1.5}" data-change="updateNodeAppearance" data-args='["${n.id}","nodeBorderWidth","$value"]' />
            <span class="input-unit-suffix">px</span>
          </div>
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Contenedor del texto</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <label style="font-size:10px;color:var(--text2)">Fondo
            <input class="prop-val" type="color" value="${textBg}" style="height:31px;padding:3px" ${textBgTransparent?'disabled':''}
                   data-change="updateNodeAppearance" data-args='["${n.id}","textBackground","$value"]' />
          </label>
          <label style="font-size:10px;color:var(--text2)">Borde
            <input class="prop-val" type="color" value="${textBorder}" style="height:31px;padding:3px" ${textBorderHidden?'disabled':''}
                   data-change="updateNodeAppearance" data-args='["${n.id}","textBorderColor","$value"]' />
          </label>
        </div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${textBgTransparent?'checked':''}
               data-change="updateNodeAppearance" data-args='["${n.id}","textBackgroundTransparent","$checked"]' /> Fondo transparente</label>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${textBorderHidden?'checked':''}
               data-change="updateNodeAppearance" data-args='["${n.id}","textBorderHidden","$checked"]' /> Ocultar borde del texto</label>
        <div class="stack-field${textBorderHidden?' is-disabled':''}">
          <span class="stack-field-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 17h18"/></svg></span>
          <span class="stack-field-copy">Grosor del borde</span>
          <div class="input-unit stack-field-control">
            <input class="prop-val coord" type="number" min="0" max="12" step="0.5" ${textBorderHidden?'disabled':''}
                   value="${n.textBorderWidth ?? (n.type === 'text' ? 0 : 1)}" data-change="updateNodeAppearance" data-args='["${n.id}","textBorderWidth","$value"]' />
            <span class="input-unit-suffix">px</span>
          </div>
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Tamaño</div>
        <div class="prop-pair">
          <input class="prop-val coord" type="number" min="32" max="2000" value="${n.w}"
                 title="Ancho" data-change="resizeNodeFromProps" data-args='["${n.id}","w","$value"]' />
          <span style="color:var(--text3)">×</span>
          <input class="prop-val coord" type="number" min="32" max="2000" value="${n.h}"
                 title="Alto" data-change="resizeNodeFromProps" data-args='["${n.id}","h","$value"]' />
        </div>
      </div>
      ${n.appearanceOverride ? `
        <button class="tb-btn" style="width:100%;font-size:11px;margin-bottom:9px" data-click="useGeneralNodeAppearance" data-args='["${n.id}"]'>
          ↺ Usar apariencia general
        </button>` : ''}
      <div class="prop-row">
        <div class="prop-label">Separación de enlaces</div>
        <div class="prop-pair">
          <input class="prop-val coord" type="number" min="0" max="100"
                 value="${n.linkPadding ?? DEFAULT_LINK_PADDING}"
                 data-change="updateNodeLinkPadding" data-args='["${n.id}","$value"]' />
          <span style="font-size:11px;color:var(--text2)">px</span>
        </div>
      </div>
      ${(n.type !== 'text' && (n.sizeOverride || n.linkPaddingOverride)) ? `
        <button class="tb-btn" style="width:100%;font-size:11px;margin-bottom:9px" data-click="useGeneralNodeConfig" data-args='["${n.id}"]'>
          ↺ Usar configuración general
        </button>` : ''}
      ${n.type === 'chart' ? `
        <div class="prop-row">
          <div class="prop-label">Gráfica</div>
          <button class="tb-btn primary" style="width:100%;font-size:12px" data-click="openChartWizard" data-args='["${n.id}"]'>📊 Editar gráfica</button>
        </div>` : n.type === 'text' ? `
        <div class="prop-row">
          <div class="prop-label">Contenido</div>
          <div class="prop-val" style="color:var(--text2);font-size:11px">El texto se adapta al ancho y alto del cuadro.</div>
        </div>
        <div class="prop-row">
          <div class="prop-label">Rotación</div>
          <div class="prop-pair">
            <input class="prop-val coord" type="number" min="0" max="359" value="${Number(n.textRotation)||0}"
                   data-change="updateTextRotation" data-args='["${n.id}","$value"]' />
            <span style="font-size:11px;color:var(--text2)">°</span>
          </div>
          <div class="prop-label" style="margin-top:7px">Orientación</div>
          <div style="display:flex;gap:5px;margin-top:5px">
            <button class="tb-btn ${((Number(n.textRotation)||0) % 180) === 0 ? 'active' : ''}" style="flex:1;font-size:11px" data-click="updateTextRotation" data-args='["${n.id}",0]'>Horizontal</button>
            <button class="tb-btn ${((Number(n.textRotation)||0) % 180) === 90 ? 'active' : ''}" style="flex:1;font-size:11px" data-click="updateTextRotation" data-args='["${n.id}",90]'>Vertical</button>
          </div>
          <div style="display:flex;gap:4px;margin-top:5px">
            ${[0,90,180,270].map(angle => `<button class="tb-btn" style="flex:1;font-size:11px" data-click="updateTextRotation" data-args='["${n.id}",${angle}]'>${angle}°</button>`).join('')}
          </div>
        </div>` : `
        <div class="prop-row">
          <div class="prop-label">Icono / imagen</div>
          ${iconGridHtml(n)}
          <input class="prop-val editable" type="text" value="${escapeHtml(visualValue)}"
                 placeholder="Emoji o URL de imagen" data-change="setNodeVisual" data-args='["${n.id}",this.value.trim()]' />
          <input class="prop-file" type="file" accept="image/*" data-change="uploadNodeImage" data-args='["${n.id}","$self"]' />
          ${n.image ? `<button class="tb-btn" style="width:100%;font-size:11px;margin-top:5px" data-click="clearNodeImage" data-args='["${n.id}"]'>Usar icono</button>` : ''}
        </div>`}
      ${n.type === 'text' ? '' : `<div class="prop-row">
        <label class="prop-check">
          <input type="checkbox" ${n.nameInside ? 'checked' : ''}
                 data-change="setNodeLabelOption" data-args='["${n.id}","nameInside","$checked"]' />
          Nombre dentro del cuadro
        </label>
        <label class="prop-check">
          <input type="checkbox" ${n.hideName ? 'checked' : ''}
                 data-change="setNodeLabelOption" data-args='["${n.id}","hideName","$checked"]' />
          Ocultar nombre
        </label>
      </div>`}
      `;
    tabContext = {profile:n.type === 'text' ? 'text' : n.type === 'chart' ? 'chart' : 'regular', title:n.name, subtitle:n.type === 'text' ? 'Nodo de texto' : n.type === 'chart' ? 'Gráfica' : 'Nodo visual', entityId:n.id};
  } else if (selectedLinkId) {
    const l = getLink(selectedLinkId); if (!l) return;
    const from = getNode(l.from), to = getNode(l.to);
    c.innerHTML = `
      <div class="prop-row">
        <div class="prop-label">Enlace</div>
        <div class="prop-val" style="font-size:11px">${escapeHtml(from?.name)} → ${escapeHtml(to?.name)}</div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Acciones del enlace</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <button class="tb-btn" data-click="redrawLink" data-args='["${l.id}"]' title="Regenera únicamente la geometría de la ruta">Redibujar</button>
          <button class="tb-btn" data-click="cloneLink" data-args='["${l.id}"]' title="Copia el enlace y conserva su configuración">Clonar enlace</button>
        </div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Descripción</div>
        <textarea class="prop-val editable" placeholder="Descripción del enlace"
                  data-change="updateLinkDescription" data-args='["${l.id}","$value"]'>${escapeHtml(l.description || '')}</textarea>
      </div>
      ${cactiBindingHtml(l)}
      <div class="prop-row">
        <div class="prop-label">Capacidad del enlace para umbrales</div>
        <input class="prop-val" type="number" min="0.01" step="0.01" value="${l.capacity ?? 100}"
               data-change="updateLinkTraffic" data-args='["${l.id}","capacity","$value"]' />
        ${segToggleHtml(`cap-unit-${l.id}`, LINK_CAPACITY_UNITS.includes(l.capacityUnit) ? l.capacityUnit : 'Mbps', SEG_OPTIONS.capacityUnit, `updateLinkTraffic('${l.id}','capacityUnit','%v')`, {label:'Unidad de capacidad'})}
      </div>
      <div class="prop-row">
        <div class="prop-label">Etiqueta de capacidad</div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${l.capacityLabelVisible!==false?'checked':''}
               data-change="updateLinkCapacityLabel" data-args='["${l.id}","capacityLabelVisible","$checked"]' /> Mostrar tag de capacidad</label>
        <div class="prop-label" style="margin-top:7px">Posición del tag</div>
        ${segToggleHtml(`cap-place-${l.id}`, ['above','below','left'].includes(l.capacityLabelSide) ? l.capacityLabelSide : 'right', SEG_OPTIONS.placement, `updateLinkCapacityLabelPlacement('${l.id}','%v')`, {label:'Posición del tag', disabled:l.capacityLabelVisible===false})}
        <div class="prop-label" style="margin-top:7px">Tamaño del texto</div>
        <div class="prop-pair"><input class="prop-val coord" type="number" min="8" max="72"
             value="${l.capacityLabelFontSize ?? 11}" ${l.capacityLabelVisible===false?'disabled':''}
             data-change="updateLinkCapacityLabel" data-args='["${l.id}","capacityLabelFontSize","$value"]' /><span>px</span></div>
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${l.capacityLabelRotate?'checked':''} ${l.capacityLabelVisible===false?'disabled':''}
               data-change="updateLinkCapacityLabel" data-args='["${l.id}","capacityLabelRotate","$checked"]' /> Rotar siguiendo el enlace</label>
        <label class="prop-check" style="margin-top:5px"><input type="checkbox" ${l.capacityLabelFlip?'checked':''} ${!l.capacityLabelRotate||l.capacityLabelVisible===false?'disabled':''}
               data-change="updateLinkCapacityLabel" data-args='["${l.id}","capacityLabelFlip","$checked"]' /> Girar 180° sólo en vertical</label>
      </div>
      <div class="prop-row">
        <div class="prop-label">Grosor visual del enlace</div>
        <div class="prop-pair">
          <input class="prop-val coord" type="number" min="1" max="24" value="${l.width || 6}"
                 data-change="updateLinkWidth" data-args='["${l.id}","$value"]' />
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
               data-input="previewLinkDivider" data-args='["${l.id}","$value"]'
               data-change="commitLinkDivider" data-args='["${l.id}","$value",this.dataset.start]' />
        <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3)"><span>Entrada</span><span>Salida</span></div>
      </div>
      <div class="prop-row">
        <div class="prop-label">Texto de utilización</div>
        ${segToggleHtml(`usage-fmt-${l.id}`, l.usageLabelFormat==='human'?'human':'percentage', SEG_OPTIONS.usageFormat, `updateLinkUsageLabel('${l.id}','usageLabelFormat','%v')`, {label:'Formato del texto'})}
        <div class="prop-label" style="margin-top:7px">Ubicación</div>
        ${segToggleHtml(`usage-pos-${l.id}`, ['above','below','center'].includes(l.usageLabelPosition)?l.usageLabelPosition:'above', SEG_OPTIONS.usagePosition, `updateLinkUsageLabel('${l.id}','usageLabelPosition','%v')`, {label:'Ubicación'})}
        <label class="prop-check" style="margin-top:7px"><input type="checkbox" ${l.usageLabelRotate?'checked':''}
               data-change="updateLinkUsageLabel" data-args='["${l.id}","usageLabelRotate","$checked"]' /> Rotar siguiendo el enlace</label>
        <label class="prop-check" style="margin-top:5px"><input type="checkbox" ${l.usageLabelFlip?'checked':''} ${!l.usageLabelRotate?'disabled':''}
               data-change="updateLinkUsageLabel" data-args='["${l.id}","usageLabelFlip","$checked"]' /> Girar 180° sólo en vertical</label>
      </div>
      <div class="prop-row">
        <label class="prop-check">
          <input type="checkbox" ${l.scaleOverride ? 'checked' : ''}
                 data-change="setLinkScaleOverride" data-args='["${l.id}","$checked"]' />
          Usar umbrales individuales
        </label>
        ${linkThresholdEditorHtml(l)}
      </div>
      ${(l.styleOverride || l.dividerPositionOverride || l.usageLabelOverride || l.capacityLabelOverride) ? `
        <button class="tb-btn" style="width:100%;font-size:11px;margin-bottom:9px" data-click="useGeneralLinkConfig" data-args='["${l.id}"]'>
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
  const self  = getNode(nodeId);
  const other = getNode(isFrom ? link.to : link.from);
  if (!self || !other) return;
  const dx = other.x - self.x, dy = other.y - self.y;
  const p = Math.abs(dx) >= Math.abs(dy)
    ? (dx >= 0 ? 'right' : 'left')
    : (dy >= 0 ? 'bottom' : 'top');
  if (isFrom) { link.fromPort = p; link.fromPortLocked = true; }
  else { link.toPort = p; link.toPortLocked = true; }
}

function distributePortLinks(nodeId) {
  const n = getNode(nodeId); if (!n) return;
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
  const n = getNode(nodeId); if (!n) return;
  const canvas = document.getElementById('canvas');
  const sideColors = { top:'#63b3ed', bottom:'#68d391', left:'#f6ad55', right:'#fc8181' };
  ['top','bottom','left','right'].forEach(side => {
    groups[side].forEach((item, i) => {
      const l = getLink(item.linkId); if (!l) return;
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
  const n = getNode(nodeId); if (!n) return;
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
    const other  = getNode(isFrom ? l.to : l.from);
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
  const n = getNode(nodeId); if (!n) return;

  const sideLabel = { top:'↑ Arriba', bottom:'↓ Abajo', left:'← Izq', right:'→ Der' };
  const sideHint  = { top:'izq → der', bottom:'izq → der', left:'arriba → abajo', right:'arriba → abajo' };

  let html = `<div class="arrange-guide"><strong>10 posiciones fijas por lado</strong><span>Mueve cada enlace sin redistribuir ni regenerar las rutas existentes.</span></div>`;

  ['top','bottom','left','right'].forEach(side => {
    const grp = groups[side];
    html += `<div class="arrange-section"
      data-dragover="arrangeSectionDragOver" data-dragover-args='["$event","$self"]'
      data-dragleave="arrangeSectionDragLeave" data-dragleave-args='["$self"]'
      data-drop="arrangeSectionDrop" data-drop-args='["$event","${side}","$self"]'>
      <div class="arrange-side-title">${sideLabel[side]}
        <span>(${sideHint[side]})</span>
      </div>`;
    if (!grp.length) {
      html += `<div class="arrange-empty">Arrastra aquí</div>`;
    } else {
      const col = {top:'#0DBFA6',bottom:'#28C97A',left:'#F09A38',right:'#E86060'}[side];
      grp.forEach((item, i) => {
        html += `<div draggable="true"
          data-dragstart="_arrangeDragStart" data-dragstart-args='["${side}",${i}]'
          data-dragover="dragAllow" data-dragover-args='["$event"]'
          data-drop="_arrangeDrop" data-drop-args='["$event","${side}",${i}]'
          class="arrange-row">
          <span class="arrange-grip">⠿</span>
          <span class="arrange-index" style="background:${col}" title="Posición fija ${item.slot} de ${PORT_SLOT_COUNT}">${item.slot}</span>
          <span class="arrange-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <select class="arrange-side-select" title="Cambiar lado" data-change="_arrangeMoveToSide" data-args='["${side}",${i},"$value"]'>
            <option value="top" ${side==='top'?'selected':''}>↑</option>
            <option value="bottom" ${side==='bottom'?'selected':''}>↓</option>
            <option value="left" ${side==='left'?'selected':''}>←</option>
            <option value="right" ${side==='right'?'selected':''}>→</option>
          </select>
          <button class="tb-btn compact-icon" ${item.slot===1?'disabled':''} data-click="_arrangeMoveUp" data-args='["${side}",${i}]'>↑</button>
          <button class="tb-btn compact-icon" ${item.slot===PORT_SLOT_COUNT?'disabled':''} data-click="_arrangeMoveDown" data-args='["${side}",${i}]'>↓</button>
        </div>`;
      });
    }
    html += `</div>`;
  });

  html += `<div class="arrange-actions">
    <button class="tb-btn primary" style="flex:1;font-size:12px" data-click="applyArrange">Guardar</button>
    <button class="tb-btn" style="flex:1;font-size:12px" data-click="_cancelArrange">Cancelar</button>
  </div>`;

  if (arrangeEmbeddedInTab) {
    const panel = document.querySelector('.props-tab-panel[data-panel="arrange"]');
    if (panel) panel.innerHTML = `<div class="props-arrange-inline">${html}</div>`;
  } else {
    const container = document.getElementById('props-content');
    container.closest('.panel-section')?.classList.add('has-property-tabs');
    container.innerHTML = `<div class="props-arrange-shell">
    <div class="props-arrange-head">
      <button type="button" class="props-arrange-back" data-click="_cancelArrange" title="Volver a propiedades" aria-label="Volver a propiedades">←</button>
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
  const n = getNode(nodeId); if (!n) return;
  ['top','bottom','left','right'].forEach(side => {
    const grp = groups[side]; if (!grp.length) return;
    grp.forEach(item => {
      const l = getLink(item.linkId); if (!l) return;
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
  const node = nodeId ? getNode(nodeId) : null;
  revertCancel(); // revert to snapshot taken in showArrangeForm
  if (arrangeEmbeddedInTab && node) lsSet(`mapgen_props_tab_${node.type === 'text' ? 'text' : node.type === 'chart' ? 'chart' : 'regular'}`, node.type === 'text' ? 'transform' : 'layout');
  arrangeEmbeddedInTab = false;
  _arrangeState = null; renderArrangeOverlays();
  if (nodeId && nodes.some(item => item.id === nodeId)) selectNode(nodeId); else updatePropsPanel();
}

function applyArrange() {
  if (!_arrangeState) return;
  const node = getNode(_arrangeState.nodeId);
  _previewArrange(); // ensure final state is applied
  savedStateForCancel = null; // commit
  if (arrangeEmbeddedInTab && node) lsSet(`mapgen_props_tab_${node.type === 'text' ? 'text' : node.type === 'chart' ? 'chart' : 'regular'}`, node.type === 'text' ? 'transform' : 'layout');
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
  const n = getNode(id); if (!n) return;
  const clean = name.trim();
  if (!clean || clean === n.name) { updatePropsPanel(); return; }
  n.name = clean;
  if (n.type === 'text') { autoFitTextNode(n); distributePortLinks(id); }
  renderNode(n); renderLinks(); updatePropsPanel(); pushHistory();
}

function updateNodeAppearance(id, field, rawValue) {
  const n = getNode(id); if (!n) return;
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
  const touching = linkIdsTouching(id);
  if (n.type === 'text' && affectsTextSize && revertIfLinksOverlap(beforeStyle, touching)) return;
  pushHistory();
  setStatus('Apariencia del nodo actualizada');
}

function useGeneralNodeAppearance(id) {
  const n = getNode(id); if (!n) return;
  const beforeReset = getSnapshot();
  Object.assign(n, getGeneralNodeAppearance(n.type));
  n.appearanceOverride = false;
  if (n.type === 'text') autoFitTextNode(n);
  distributePortLinks(id); renderNode(n); renderLinks(); updatePropsPanel();
  const touching = linkIdsTouching(id);
  if (!revertIfLinksOverlap(beforeReset, touching)) {
    pushHistory(); setStatus('Nodo vinculado a la apariencia general');
  }
}

function updateTextRotation(id, value) {
  const n = getNode(id); if (!n || n.type!=='text') return;
  const rotation = ((Math.round(Number(value) || 0) % 360) + 360) % 360;
  if (rotation === (Number(n.textRotation) || 0)) { updatePropsPanel(); return; }
  const beforeRotation = getSnapshot();
  n.textRotation = rotation; autoFitTextNode(n); distributePortLinks(id);
  renderNode(n); renderLinks(); updatePropsPanel();
  const touching = linkIdsTouching(id);
  if (!revertIfLinksOverlap(beforeRotation,touching)) {
    pushHistory(); setStatus(`Texto rotado a ${rotation}°`);
  }
}

function resizeNodeFromProps(id, dimension, value) {
  const n = getNode(id); if (!n || !['w','h'].includes(dimension)) return;
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
  const n = getNode(id); if (!n) return;
  const padding = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  if (padding === (n.linkPadding ?? DEFAULT_LINK_PADDING)) { updatePropsPanel(); return; }
  const beforePadding = getSnapshot();
  const touchingLinks = linkIdsTouching(id);
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
  const n = getNode(id); if (!n) return;
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
    const n = getNode(id); if (!n) return;
    n.image = String(reader.result);
    renderNode(n); updatePropsPanel(); pushHistory();
    setStatus(`Imagen cargada: ${file.name}`);
  };
  reader.onerror = () => setStatus('⚠ No se pudo leer la imagen');
  reader.readAsDataURL(file);
}

function clearNodeImage(id) {
  const n = getNode(id); if (!n || !n.image) return;
  n.image = null;
  renderNode(n); updatePropsPanel(); pushHistory();
  setStatus('Imagen eliminada; se usa el icono');
}

function setNodeLabelOption(id, option, checked) {
  if (!['nameInside','hideName'].includes(option)) return;
  const n = getNode(id); if (!n) return;
  n[option] = !!checked;
  renderNode(n); updatePropsPanel(); pushHistory();
}

function updateLinkDescription(id, description) {
  const l = getLink(id); if (!l || l.description === description) return;
  l.description = description;
  renderLinks(); updatePropsPanel(); pushHistory();
  setStatus('Descripción del enlace actualizada');
}

function redrawLink(id) {
  const link = getLink(id); if (!link) return;
  const from = getNode(link.from);
  const to = getNode(link.to);
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
  const source = getLink(id); if (!source) return;
  const from = getNode(source.from);
  const to = getNode(source.to);
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
  const l = getLink(id); if (!l) return;
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
  const l = getLink(id); if (!l) return;
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
  const l = getLink(id); if (!l) return;
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
  const l = getLink(id); if (!l) return;
  if (!['above','below','left','right'].includes(placement)) return;
  if (l.capacityLabelSide === placement) return;
  l.capacityLabelSide = placement;
  l.capacityLabelOverride = true;
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Posición de la capacidad actualizada');
}

function randomizeEditorLink(id) {
  const l = getLink(id); if (!l) return;
  l.editorInPct = Math.floor(Math.random()*101);
  l.editorOutPct = Math.floor(Math.random()*101);
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Valores ficticios del editor actualizados');
}

function updateLinkWidth(id, value) {
  const l = getLink(id); if (!l) return;
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
  const l = getLink(id); if (!l || l.midTermination === value) return;
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
  const l = getLink(id); if (!l) return;
  l.dividerPosition = Math.max(5, Math.min(95, Math.round(Number(value) || 50)));
  l.dividerPositionOverride = true;
  renderLinks();
  const label = document.getElementById('divider-position-value');
  if (label) label.textContent = `${l.dividerPosition}%`;
}

function commitLinkDivider(id, value, startValue) {
  const l = getLink(id); if (!l) return;
  const start = Math.max(5, Math.min(95, Math.round(Number(startValue) || 50)));
  previewLinkDivider(id, value);
  if (l.dividerPosition !== start) pushHistory();
  updatePropsPanel();
  setStatus(`Posición del divisor: ${l.dividerPosition}%`);
}

function setLinkScaleOverride(id, enabled) {
  const l = getLink(id); if (!l || l.scaleOverride === enabled) return;
  l.scaleOverride = enabled;
  l.scale = enabled ? currentScale.map(item => ({...item})) : null;
  renderLinks(); updatePropsPanel(); pushHistory();
  setStatus(enabled ? 'Umbrales individuales habilitados' : 'El enlace usa los umbrales generales');
}

function updateLinkThresholdPct(id, index, rawValue) {
  const l = getLink(id); if (!l?.scaleOverride || !Array.isArray(l.scale)) return;
  const item = l.scale[index]; if (!item) return;
  const min = index > 0 ? l.scale[index-1].pct + 1 : 0;
  const max = index < l.scale.length-1 ? l.scale[index+1].pct - 1 : 100;
  const value = Math.max(min, Math.min(max, Math.round(Number(rawValue) || 0)));
  if (value === item.pct) { updatePropsPanel(); return; }
  item.pct = value;
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Umbral individual actualizado');
}

function updateLinkThresholdColor(id, index, color) {
  const l = getLink(id); if (!l?.scaleOverride || !Array.isArray(l.scale)) return;
  if (!/^#[0-9a-f]{6}$/i.test(color) || !l.scale[index] || l.scale[index].color === color) return;
  l.scale[index].color = color.toLowerCase();
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Color del umbral actualizado');
}

function addLinkThreshold(id) {
  const l = getLink(id); if (!l?.scaleOverride || !Array.isArray(l.scale)) return;
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
  const l = getLink(id); if (!l?.scaleOverride || !Array.isArray(l.scale) || l.scale.length <= 2) return;
  l.scale.splice(index,1);
  renderLinks(); updatePropsPanel(); pushHistory(); setStatus('Umbral individual eliminado');
}

function copyGeneralScaleToLink(id) {
  const l = getLink(id); if (!l) return;
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
  const n = getNode(id); if (!n) return;
  const beforeReset = getSnapshot();
  n.w = generalConfig.nodeWidth; n.h = generalConfig.nodeHeight;
  n.linkPadding = generalConfig.linkPadding;
  n.sizeOverride = false; n.linkPaddingOverride = false;
  distributePortLinks(id); renderNode(n); renderLinks(); updatePropsPanel();
  const touching = linkIdsTouching(id);
  if (!revertIfLinksOverlap(beforeReset, touching)) {
    pushHistory(); setStatus('Nodo vinculado a la configuración general');
  }
}

function useGeneralLinkConfig(id) {
  const l = getLink(id); if (!l) return;
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

