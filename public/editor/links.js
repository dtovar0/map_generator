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
  const n = getNode(id);
  const pos = getCanvasPos(e);
  dragOffX = pos.x - n.x; dragOffY = pos.y - n.y;
  const dragIds = groupDrag ? [...effective] : [id];
  dragGroupStart = dragIds.map(sid => {
    const sn = getNode(sid);
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
  const n = getNode(id); if (!n) return;
  geometryChangeSnapshot = getSnapshot();
  saveForCancel();
  resizingNode = id; resizeDir = dir;
  const pos = getCanvasPos(e);
  resizeStartX = pos.x; resizeStartY = pos.y;
  resizeOrigW = n.w; resizeOrigH = n.h; resizeOrigX = n.x; resizeOrigY = n.y;
  const resizeIds = selectedNodeIds.has(id) && selectedNodeIds.size > 1 ? [...selectedNodeIds] : [id];
  resizeGroupStart = resizeIds.map(nodeId => {
    const node = getNode(nodeId);
    return node ? {id:node.id, w:node.w, h:node.h, x:node.x, y:node.y} : null;
  }).filter(Boolean);
  if (resizeIds.length === 1) selectNode(id);
}
function onTextRotateStart(e, id) {
  if (e.button !== 0 || currentTool === 'link' || placingItem) return;
  e.stopPropagation(); e.preventDefault();
  const n = getNode(id); if (!n || n.type !== 'text') return;
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
  const n = getNode(nodeId);
  if (isSupportNode(n)) {
    showToast('Los elementos de apoyo (texto, iconos y gráficas) no admiten enlaces.', 'error');
    return;
  }
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
  const target = getNode(toId);
  if (isSupportNode(target)) {
    showToast('Los elementos de apoyo (texto, iconos y gráficas) no admiten enlaces.', 'error');
    return;
  }
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
    scaleOverride:false, scale:null, scaleThemes:{},
    routeLane: 0,
    routeStyle: generalConfig.routeStyle === 'free' ? 'free' : 'ortho',
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
  const node = getNode(nodeId);
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
  const node = getNode(nodeId);
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
  const from = getNode(link.from);
  const to = getNode(link.to);
  if (!from || !to) return [];
  const fp = getLinkPortPos(from, link.fromPort || 'center', link.fromOffset || 0);
  const tp = getLinkPortPos(to, link.toPort || 'center', link.toOffset || 0);
  // Free route: straight segments through the control points, at any angle.
  // No auto-corners, approach stubs or lanes — the waypoints ARE the shape.
  if (link.routeStyle === 'free') {
    return uniqueVertices([fp, ...(link.waypoints || []), tp]);
  }
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

// Free-route waypoints snap by angle — 5° steps measured from the previous
// control point — instead of by grid, so diagonal segments land on clean angles.
const FREE_ROUTE_ANGLE_STEP = 5 * Math.PI / 180;
function snapWaypointAngle(link, wpIndex, pos) {
  const from = getNode(link.from);
  const prev = wpIndex > 0
    ? link.waypoints[wpIndex - 1]
    : from ? getLinkPortPos(from, link.fromPort || 'center', link.fromOffset || 0) : null;
  if (!prev) return { x: Math.round(pos.x), y: Math.round(pos.y) };
  const dx = pos.x - prev.x, dy = pos.y - prev.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return { x: prev.x, y: prev.y };
  const angle = Math.round(Math.atan2(dy, dx) / FREE_ROUTE_ANGLE_STEP) * FREE_ROUTE_ANGLE_STEP;
  return {
    x: Math.round((prev.x + Math.cos(angle) * dist) * 100) / 100,
    y: Math.round((prev.y + Math.sin(angle) * dist) * 100) / 100
  };
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
  if (link.routeStyle === 'free' || (link.waypoints || []).length) return false;
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
// Callers pass FINAL rendered vertices (getLinkVertices) — never re-expand them
// with buildVertices here: it would re-insert 90° corners into free routes.
function splitPathAtMidpoint(allPts, fromPort, percentage = 50) {
  const verts = uniqueVertices(allPts);
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
  // Free routes have no lanes to shuffle; their geometry is already final.
  if (link.midTermination !== 'arrows' || link.routeStyle === 'free' || (link.waypoints || []).length) return true;
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
  const sideCol = { top: '#7C5CFF', bottom: '#28C97A', left: '#F09A38', right: '#E86060' };
  nodes.forEach(node => {
    if (isSupportNode(node)) return; // support elements take no links

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
        c.setAttribute('stroke', '#0A0912');
        c.setAttribute('stroke-width', '1.5');
        g.appendChild(c);
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', pos.x); t.setAttribute('y', pos.y + 3.2);
        t.setAttribute('text-anchor', 'middle'); t.setAttribute('font-size', '10');
        t.setAttribute('font-weight', '700'); t.setAttribute('fill', '#0A0912');
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
  const n = getNode(nodeId); if (!n || isSupportNode(n)) return;
  const svg = document.getElementById('overlay-svg'); // renders above HTML nodes

  // Ten fixed positions per side. Occupied positions are solid; available ones
  // remain hollow so the user can see exactly where an endpoint may be moved.
  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  grid.classList.add('conn-slot-grid');
  const sideColors = {top:'#7C5CFF', bottom:'#28C97A', left:'#F09A38', right:'#E86060'};
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
    circ.setAttribute('fill', '#F09A38'); circ.setAttribute('stroke', '#0A0912');
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
      const l = getLink(link.id); if (!l) return;
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
    const other = isFrom ? getNode(link.to) : getNode(link.from);
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
function findNearestSegmentIdx(allPts, pt, fromPort, freeRoute = false) {
  // Returns index to splice into l.waypoints (0 = before first existing wp)
  if (freeRoute) {
    // Straight segments map 1:1 to control-point pairs — no corner mapping.
    let minDist = Infinity, best = 0;
    for (let i = 0; i < allPts.length - 1; i++) {
      const d = distPtToSeg(pt, allPts[i], allPts[i + 1]);
      if (d < minDist) { minDist = d; best = i; }
    }
    return best;
  }
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
      polygon.setAttribute('stroke', '#0A0912');
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
    shape.setAttribute('fill', '#0A0912');
  } else if (type === 'circle') {
    const r = Math.max(5, width/2 + 2);
    shape = document.createElementNS(ns, 'circle');
    shape.setAttribute('cx', point.x);
    shape.setAttribute('cy', point.y);
    shape.setAttribute('r', r);
    shape.setAttribute('fill', '#0A0912');
  } else if (type === 'square') {
    const side = Math.max(9, width + 5);
    shape = document.createElementNS(ns, 'rect');
    shape.setAttribute('x', point.x - side/2);
    shape.setAttribute('y', point.y - side/2);
    shape.setAttribute('width', side); shape.setAttribute('height', side);
    shape.setAttribute('rx', '1'); shape.setAttribute('fill', '#0A0912');
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

// Event delegation for the per-link handlers that otherwise get rebound on
// every link, every render (selection click, hover, connection dots, usage
// labels). Attached once; individual elements carry data-link-id/data-* so the
// handlers can resolve their link. The selected-link-only drag handles
// (waypoints, divider, hit-area insert) stay as direct listeners since there is
// at most one selected link.
let linkDelegationReady = false;
function ensureLinkDelegation() {
  if (linkDelegationReady) return;
  const svg = document.getElementById('links-svg');
  const overlay = document.getElementById('overlay-svg');
  if (!svg || !overlay) return;

  svg.addEventListener('click', e => {
    if (e.target.closest('.usage-label')) { e.stopPropagation(); e.preventDefault(); return; }
    const g = e.target.closest('.link-group'); if (!g) return;
    const link = getLink(g.dataset.linkId); if (!link) return;
    const routeVerts = getLinkVertices(link);
    const baseW = Math.max(1, Math.min(24, Number(link.width) || 6));
    const tolerance = Math.max(5, baseW / 2 + 2);
    if (pointToPolylineDistance(getCanvasPos(e), routeVerts) > tolerance) return;
    e.stopPropagation(); e.preventDefault();
    if (presentationMode) showPresentationLinkInfo(link.id);
    else if (e.shiftKey || e.ctrlKey || e.metaKey) toggleLinkSelection(link.id);
    else selectLink(link.id);
  });
  svg.addEventListener('dblclick', e => {
    const label = e.target.closest('.usage-label'); if (!label) return;
    const link = getLink(label.dataset.linkId); if (!link || presentationMode) return;
    e.stopPropagation(); e.preventDefault();
    const sideName = label.dataset.labelSide;
    if (selectedLinkId !== link.id) selectLink(link.id);
    activeUsageLabel = { linkId: link.id, side: sideName };
    renderLinks();
    setStatus(`Etiqueta de ${sideName === 'in' ? 'entrada' : 'salida'} activa · arrástrala dentro de su lado`);
  });
  svg.addEventListener('mousedown', e => {
    const label = e.target.closest('.usage-label'); if (!label || e.button !== 0 || presentationMode) return;
    const link = getLink(label.dataset.linkId); if (!link) return;
    const sideName = label.dataset.labelSide;
    if (!(activeUsageLabel?.linkId === link.id && activeUsageLabel.side === sideName)) return;
    e.stopPropagation(); e.preventDefault();
    geometryChangeSnapshot = getSnapshot();
    const field = sideName === 'in' ? 'usageLabelInPosition' : 'usageLabelOutPosition';
    draggingUsageLabel = { linkId: link.id, side: sideName, startPosition: link[field] ?? 50 };
  });
  svg.addEventListener('mouseover', e => {
    const g = e.target.closest('.link-group'); if (g) g.classList.add('hover');
  });
  svg.addEventListener('mouseout', e => {
    const g = e.target.closest('.link-group');
    if (g && (!e.relatedTarget || !g.contains(e.relatedTarget))) g.classList.remove('hover');
  });

  overlay.addEventListener('mousedown', e => {
    const dot = e.target.closest('.conn-dot'); if (!dot || !showConnHandles) return;
    const link = getLink(dot.dataset.linkId); if (!link) return;
    e.stopPropagation(); e.preventDefault();
    const isFrom = dot.dataset.connFrom === '1';
    geometryChangeSnapshot = getSnapshot();
    draggingConnHandle = { linkId: link.id, isFrom, nodeId: isFrom ? link.from : link.to };
  });

  linkDelegationReady = true;
}

function renderLinks() {
  ensureLinkDelegation();
  const svg = document.getElementById('links-svg');
  svg.querySelectorAll('.link-group').forEach(g => g.remove());
  document.getElementById('overlay-svg').querySelectorAll('.conn-dot').forEach(el => el.remove());

  links.forEach(link => {
    const from = getNode(link.from), to = getNode(link.to);
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
    // Selection click and hover are handled by delegation on #links-svg
    // (see ensureLinkDelegation) so we don't rebind them per link every render.
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
        hl.setAttribute('stroke', '#7C5CFF40'); hl.setAttribute('stroke-width', String(W + 12));
        hl.setAttribute('fill', 'none'); hl.setAttribute('stroke-linecap', 'butt');
        hl.setAttribute('pointer-events', 'none'); // decorative halo must not block the canvas
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
        const l = getLink(link.id); if (!l) return;
        const isFree = l.routeStyle === 'free';
        const clickPt = isFree ? { x: pos.x, y: pos.y } : { x: snap(pos.x), y: snap(pos.y) };
        geometryChangeSnapshot = getSnapshot();
        let insertIdx;
        if (l.routeLane && !(l.waypoints || []).length) {
          l.routeLane = 0;
          l.waypoints = [clickPt];
          insertIdx = 0;
        } else {
          const curAllPts = [fp, ...(l.waypoints||[]), tp];
          insertIdx = findNearestSegmentIdx(curAllPts, clickPt, l.fromPort, isFree);
          l.waypoints.splice(insertIdx, 0, clickPt);
        }
        // Free routes: angle-snap the inserted waypoint relative to its predecessor.
        if (isFree) {
          l.waypoints[insertIdx] = snapWaypointAngle(l, insertIdx, pos);
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
      c.setAttribute('fill', col); c.setAttribute('stroke', '#0A0912'); c.setAttribute('stroke-width', '2');
      c.setAttribute('pointer-events', 'all'); c.style.cursor = 'move';
      c.classList.add('conn-dot');
      // mousedown handled by delegation on #overlay-svg (ensureLinkDelegation).
      c.dataset.linkId = link.id; c.dataset.connFrom = isFrom ? '1' : '0';
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
        dividerHit.setAttribute('fill', 'transparent'); dividerHit.setAttribute('stroke', '#7C5CFF88');
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
    // Tags stay visible in presentation; in the editor they follow editorTagsHidden.
    if (presentationMode || !editorTagsHidden) {
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
        labelGroup.classList.add('usage-label');
        labelGroup.dataset.linkId = link.id; labelGroup.dataset.labelSide = sideName;
        labelGroup.setAttribute('transform', `translate(${x} ${y}) rotate(${textAngle})`);
        // Only capture the pointer when the link is selected (editor). Otherwise
        // these labels float over otherwise-empty canvas and would block panning,
        // marquee selection and click-to-deselect, and swap the cursor to a
        // pointer over blank space. Presentation never makes them interactive.
        labelGroup.setAttribute('pointer-events', (!presentationMode && isSel) ? 'all' : 'none');
        if (!presentationMode) labelGroup.style.cursor = isActiveLabel ? 'grab' : 'pointer';
        const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
        bg.setAttribute('x', -bw/2); bg.setAttribute('y', -bh/2);
        bg.setAttribute('width', bw); bg.setAttribute('height', bh);
        bg.setAttribute('fill', activeTheme === 'light' ? '#FFFFFFF2' : '#0A0912E8'); bg.setAttribute('rx', '3');
        if (isActiveLabel) {
          bg.setAttribute('stroke', activeTheme === 'light' ? '#6A45F0' : '#7C5CFF'); bg.setAttribute('stroke-width', '1.5');
          bg.setAttribute('stroke-dasharray', '3 2');
        }
        labelGroup.appendChild(bg);
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x', '0'); t.setAttribute('y', '4'); t.setAttribute('text-anchor','middle');
        t.setAttribute('font-size', '11'); t.setAttribute('fill', col);
        t.setAttribute('font-family', "Consolas,'SF Mono',monospace");
        t.setAttribute('font-weight', '700'); t.setAttribute('letter-spacing', '0.2');
        t.textContent = txt; labelGroup.appendChild(t);
        // click / dblclick / mousedown for labels are delegated on #links-svg
        // (ensureLinkDelegation), keyed by data-link-id / data-label-side.
        g.appendChild(labelGroup);
      });
    }

    // Capacity tag — fixed in one of four quadrants around the divider.
    if (link.capacityLabelVisible !== false && (presentationMode || !editorTagsHidden)) {
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
      bg.setAttribute('fill', activeTheme === 'light' ? '#FFFFFFF2' : '#0A0912E8'); bg.setAttribute('rx', '3');
      group.appendChild(bg);
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x','0'); text.setAttribute('y',String(fontSize * 0.36)); text.setAttribute('text-anchor','middle');
      text.setAttribute('font-size',String(fontSize)); text.setAttribute('fill',activeTheme === 'light' ? '#9A5700' : '#F6C85F');
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
        sq.setAttribute('fill', '#7C5CFF'); sq.setAttribute('stroke', '#0A0912');
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
          const l = getLink(link.id); if (!l) return;
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
        hint.setAttribute('font-size', '10'); hint.setAttribute('fill', '#7C5CFF66');
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
