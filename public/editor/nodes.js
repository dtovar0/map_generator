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
  const n = nodeId ? getNode(nodeId) : null;
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
    const n = getNode(chartWizardEditingId); if (!n) return closeChartWizard();
    const before = getSnapshot();
    n.graphConfig = graphConfig; n.name = title; n.w = width; n.h = height; n.sizeOverride = true;
    distributePortLinks(n.id); renderNode(n); renderLinks(); updatePropsPanel();
    const touching = linkIdsTouching(n.id);
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
  const node = getNode(id); if (!node || node.type!=='text') return;
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
  const node = getNode(id), host = document.getElementById(id);
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
    const old = snapshot.getNode(id);
    const changed = !old || old.name!==node.name || old.w!==node.w || old.h!==node.h;
    const touching = linkIdsTouching(id);
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
  const from = getNode(linkStart.nodeId); if (!from) return;
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
    const n = getNode(rotatingTextNode);
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
    const n = getNode(draggingNode);
    if (!n) return;
    nodeDraggedFlag = true;
    const newX = snap(pos.x - dragOffX), newY = snap(pos.y - dragOffY);
    if (dragGroupStart.length > 1) {
      const primary = dragGroupStart.find(g => g.id === draggingNode);
      const dx = newX - primary.x, dy = newY - primary.y;
      dragGroupStart.forEach(g => {
        const gn = getNode(g.id); if (!gn) return;
        gn.x = g.x + dx; gn.y = g.y + dy;
        distributePortLinks(g.id); renderNode(gn);
      });
      dragGroupWps.forEach(g => {
        const l = getLink(g.id); if (!l) return;
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
    const n = getNode(resizingNode);
    if (!n) return;
    const dx = pos.x - resizeStartX, dy = pos.y - resizeStartY;
    const dir = resizeDir;
    const resizeTargets = resizeGroupStart.length ? resizeGroupStart : [{id:n.id,w:resizeOrigW,h:resizeOrigH,x:resizeOrigX,y:resizeOrigY}];
    const centeredGroupResize = resizeTargets.length > 1;
    resizeTargets.forEach(original => {
      const target = getNode(original.id); if (!target) return;
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
    const l = getLink(linkId);
    const n = getNode(nodeId);
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
        // Defer the toast until the drag is released so sweeping across several
        // occupied slots doesn't stack up error toasts mid-drag; the status bar
        // gives live feedback in the meantime.
        draggingConnHandle.collisionSlot = `${newPort}:${slot}`;
        draggingConnHandle.pendingToast = `La posición ${slot} del lado ${portSideLabel(newPort)} ya está ocupada.`;
        setStatus(`⚠ Posición ${slot} ocupada`);
        return;
      }
      draggingConnHandle.collisionSlot = null;
      draggingConnHandle.pendingToast = null;
      setEndpointSlot(l, nodeId, newPort, slot);
      renderLinks();
    }
    return;
  }

  if (draggingWaypoint) {
    const l = getLink(draggingWaypoint.linkId); if (l) {
      l.waypoints[draggingWaypoint.wpIndex] = { x: snap(pos.x), y: snap(pos.y) };
      renderLinks();
    }
    return;
  }

  if (draggingDivider) {
    const l = getLink(draggingDivider.linkId);
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
    const l = getLink(draggingUsageLabel.linkId);
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
    const from = getNode(linkStart.nodeId);
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
  const connPendingToast   = draggingConnHandle?.pendingToast || null;
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
  if (connPendingToast) showToast(connPendingToast, 'error');
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
    const n = getNode(rotatedId);
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
    const l = getLink(dividerDrag.linkId);
    if (l && l.dividerPosition !== dividerDrag.startPosition) pushHistory();
    updatePropsPanel();
  }
  if (wasDraggingUsageLabel) {
    const l = getLink(usageLabelDrag.linkId);
    const field = usageLabelDrag.side === 'in' ? 'usageLabelInPosition' : 'usageLabelOutPosition';
    if (l && l[field] !== usageLabelDrag.startPosition) pushHistory();
  }
  if (rotatedId && !wasRotating) savedStateForCancel = null;
  geometryChangeSnapshot = null;
  resizeGroupStart = [];
});
