const studioForm = document.querySelector('#studio-form');
const studioCatalog = window.SerpMeCatalog;
const studioCategory = document.querySelector('#studio-category');
const studioConcept = document.querySelector('#studio-concept');
const modelProfiles = {
  cafe: {label: 'Cafe / quick service', front: .14, service: .19, back: .18, circulation: .20, sqmPerGuest: 1.65, defaultTurns: 3.2},
  restaurant: {label: 'Restaurant', front: .10, service: .28, back: .17, circulation: .22, sqmPerGuest: 1.95, defaultTurns: 2.2},
  retail: {label: 'Retail', front: .10, service: .09, back: .20, circulation: .25, sqmPerGuest: 2.3, defaultTurns: 4.2},
  studio: {label: 'Studio / fitness', front: .10, service: .12, back: .16, circulation: .22, sqmPerGuest: 3.1, defaultTurns: 2.2}
};
const serviceParameters = {
  cafe: [['counterLength','Counter length (m)',4,1,20],['avgDwell','Average visit duration (min)',55,15,180],['deliveryShare','Delivery share (%)',15,0,80]],
  restaurant: [['kitchenRatio','Kitchen area (%)',28,15,45],['tableTurns','Table turns / day',2.2,1,6,.1],['avgParty','Average party size',2.4,1,10,.1]],
  retail: [['displayRatio','Display area (%)',55,20,80],['warehouseShare','Storage area (%)',20,8,55],['avgBasket','Average basket (TRY)',650,50,20000]],
  studio: [['workstations','Workstations',6,1,50],['appointmentMinutes','Appointment duration (min)',60,15,240],['meetingRooms','Private / meeting rooms',2,0,20]]
};
const integer = value => Math.max(0, Math.round(Number(value) || 0));
const text = value => { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; };

function fillStudioConcepts() {
  const category = studioCatalog.getCategory(studioCategory.value);
  studioConcept.innerHTML = category.concepts.map(concept => `<option value="${concept.id}">${text(concept.label)}</option>`).join('');
  studioForm.elements.model.value = category.concepts[0].model;
  renderStudioParameters();
}
function activeParameterSet() {
  const concept = studioCatalog.getConcept(studioConcept.value);
  const model = studioForm.elements.model.value;
  return model === concept.model ? concept.params : serviceParameters[model];
}
function updateTurnControl() {
  const concept = studioCatalog.getConcept(studioConcept.value);
  const model = studioForm.elements.model.value;
  const modelNeedsServiceTurns = model === 'cafe' || model === 'restaurant';
  const conceptUsesOwnVolumeMetric = ['fast-food', 'nightlife'].includes(concept.id) && model === concept.model;
  document.querySelector('#turns-control').hidden = !modelNeedsServiceTurns || conceptUsesOwnVolumeMetric;
}
function renderStudioParameters() {
  const concept = studioCatalog.getConcept(studioConcept.value);
  const model = studioForm.elements.model.value;
  const isConceptModel = model === concept.model;
  const parameters = activeParameterSet();
  document.querySelector('#studio-parameters').innerHTML = `<p class="eyebrow">${isConceptModel ? 'CONCEPT-SPECIFIC PARAMETERS' : 'SELECTED SERVICE MODEL PARAMETERS'}</p><div>${parameters.map(([key, label, value, min, max, step]) => `<label>${text(label)}<input name="param-${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step || 1}" /></label>`).join('')}</div>`;
  updateTurnControl();
}
function initializeStudioCatalog() {
  studioCategory.innerHTML = studioCatalog.categories.map(category => `<option value="${category.id}">${text(category.label)}</option>`).join('');
  fillStudioConcepts();
  studioCategory.addEventListener('change', fillStudioConcepts);
  studioConcept.addEventListener('change', () => { studioForm.elements.model.value = studioCatalog.getConcept(studioConcept.value).model; renderStudioParameters(); });
  studioForm.elements.model.addEventListener('change', renderStudioParameters);
}
initializeStudioCatalog();

function planLayout({concept, conceptId, model, area, frontage, seating, turns, accessible, parameters}) {
  const profile = modelProfiles[model];
  const kitchenRatio = parameters.kitchenRatio ? parameters.kitchenRatio / 100 : profile.service;
  const storageRatio = parameters.warehouseShare ? parameters.warehouseShare / 100 : profile.back;
  const comfort = seating === 'spacious' ? 1.17 : seating === 'dense' ? .86 : 1;
  const circulation = profile.circulation + (accessible ? .05 : 0);
  const fixedArea = area * (profile.front + kitchenRatio + storageRatio + circulation);
  const displayArea = parameters.displayRatio ? area * parameters.displayRatio / 100 : null;
  const guestArea = Math.max(0, displayArea || area - fixedArea);
  const sqmPerGuest = profile.sqmPerGuest * comfort;
  let peakGuests = Math.max(1, Math.floor(guestArea / sqmPerGuest));
  const serviceTurns = Number(turns || profile.defaultTurns);
  let dailyGuests = Math.round(peakGuests * serviceTurns);
  if (conceptId === 'beauty') { peakGuests = Math.min(peakGuests, parameters.treatmentRooms * 2 + parameters.stations); dailyGuests = Math.round(peakGuests * (480 / parameters.appointmentMinutes)); }
  if (conceptId === 'accommodation') { peakGuests = Math.round(parameters.roomCount * 1.8); dailyGuests = Math.round(peakGuests * parameters.occupancy / 100); }
  if (conceptId === 'repair') { peakGuests = Math.min(peakGuests, parameters.workstations * 2); dailyGuests = Math.round(parameters.workstations * 4); }
  if (conceptId === 'consulting') { peakGuests = Math.min(peakGuests, parameters.workstations + parameters.meetingRooms * 6); dailyGuests = Math.round(parameters.workstations * parameters.billableUtilization / 100 + parameters.meetingRooms * 5); }
  if (conceptId === 'fast-food') dailyGuests = Math.round(peakGuests * (3600 / parameters.serviceSeconds) * 2.5 * (1 + parameters.pickupShare / 100));
  if (conceptId === 'nightlife') { peakGuests = Math.round(peakGuests * (1 + parameters.standingShare / 100)); dailyGuests = Math.round(peakGuests * parameters.peakHours / 2); }
  const depth = area / frontage;
  const efficiency = Math.round(guestArea / area * 100);
  const zones = [
    {key: 'front', name: model === 'retail' ? 'Window / entry' : 'Welcome area', area: area * profile.front, className: 'front'},
    {key: 'service', name: model === 'restaurant' ? 'Kitchen / service' : model === 'retail' ? 'Checkout / fitting' : 'Counter / service', area: area * profile.service, className: 'service'},
    {key: 'guest', name: model === 'retail' ? 'Sales area' : model === 'studio' ? 'Activity area' : 'Guest area', area: guestArea, className: 'guest'},
    {key: 'back', name: 'Storage / back area', area: area * profile.back, className: 'back'},
  ];
  return {concept, conceptId, profile, area, frontage, depth, guestArea, peakGuests, dailyGuests, serviceTurns, efficiency, accessible, zones};
}

function zoneStyle(zone, plan) {
  const percent = Math.max(10, Math.round(zone.area / plan.area * 100));
  if (zone.key === 'front') return `left:3%;bottom:3%;width:${Math.min(28, percent)}%;height:28%`;
  if (zone.key === 'service') return `left:${Math.min(34, percent + 5)}%;bottom:3%;width:${Math.min(30, percent)}%;height:28%`;
  if (zone.key === 'back') return `right:3%;top:3%;width:${Math.min(28, percent + 2)}%;height:31%`;
  return `left:3%;top:3%;width:${Math.max(42, Math.min(63, percent + 9))}%;height:57%`;
}

let layoutEditor = null;
let lastRenderedSignature = '';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
function layoutPayload() {
  const plan = layoutEditor.plan;
  return {
    signature: JSON.stringify({concept: plan.concept, area: plan.area, active: layoutEditor.activeFloor, floors: layoutEditor.floors}),
    active_floor: layoutEditor.activeFloor,
    plan: {concept: plan.concept, model: Object.keys(modelProfiles).find(key => modelProfiles[key] === plan.profile), area: plan.area},
    floors: layoutEditor.floors.map(floor => ({
      name: floor.name,
      zones: floor.zones.map(({id, name, x, y, w, h}) => ({id, name, x, y, w, h})),
      walls: floor.walls.map(({id, x, y, w, h}) => ({id, x, y, w, h})),
      obstacles: floor.obstacles.map(({id, x, y, w, h}) => ({id, x, y, w, h})),
      doors: floor.doors.map(({id, x, y, w, h}) => ({id, x, y, w, h})),
      sinks: floor.sinks.map(({id, x, y, w, h}) => ({id, x, y, w, h}))
    }))
  };
}
let conceptViewAngle = 0;
function drawConceptView() {
  const canvas = document.querySelector('#concept-vision-canvas');
  if (!canvas || !layoutEditor) return;
  const context = canvas.getContext('2d'), floor = activeFloor(), model = layoutPayload().plan.model;
  const width = canvas.width, height = canvas.height, sx = Math.min(width / 290, 4.1), sy = Math.min(height / 260, 1.55), sz = 3;
  const baseY = Math.round(height * .43);
  const point = (x, y, z = 0) => conceptViewAngle ? [width / 2 + (y - x) * sx, baseY + (x + y) * sy - z * sz] : [width / 2 + (x - y) * sx, baseY + (x + y) * sy - z * sz];
  const polygon = (points, fill, stroke = 'rgba(255,255,255,.18)') => { context.beginPath(); points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y)); context.closePath(); context.fillStyle = fill; context.fill(); context.strokeStyle = stroke; context.lineWidth = 2; context.stroke(); };
  const prism = (item, color, tall = 7) => {
    const x = item.x, y = item.y, w = item.w || 5, h = item.h || 5;
    const base = [point(x, y), point(x + w, y), point(x + w, y + h), point(x, y + h)];
    const top = [point(x, y, tall), point(x + w, y, tall), point(x + w, y + h, tall), point(x, y + h, tall)];
    polygon([base[1], base[2], top[2], top[1]], 'rgba(10,16,35,.36)'); polygon([base[2], base[3], top[3], top[2]], 'rgba(4,9,22,.48)'); polygon(top, color);
  };
  const furniture = (item, color, tall) => prism(item, color, tall);
  const zone = key => floor.zones.find(item => item.className === key);
  const placeTables = guest => {
    const count = Math.max(3, Math.min(14, Math.floor((guest.w * guest.h) / 250))), columns = Math.ceil(Math.sqrt(count));
    for (let index = 0; index < count; index += 1) {
      const row = Math.floor(index / columns), column = index % columns, x = guest.x + 7 + column * Math.max(7, (guest.w - 15) / columns), y = guest.y + 8 + row * Math.max(8, (guest.h - 17) / Math.ceil(count / columns));
      furniture({x, y, w: 4.6, h: 4.6}, '#c98e52', 4.2);
      [[-2, 1], [5, 1], [1, -2], [1, 5]].forEach(([dx, dy]) => furniture({x: x + dx, y: y + dy, w: 1.6, h: 1.6}, '#5d7087', 2.2));
    }
  };
  const placeShelves = guest => {
    const count = Math.max(2, Math.min(6, Math.floor(guest.w / 11)));
    for (let index = 0; index < count; index += 1) furniture({x: guest.x + 6 + index * Math.max(9, (guest.w - 13) / count), y: guest.y + 8, w: 5, h: Math.max(14, guest.h - 16)}, '#9c6e49', 13);
  };
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(width / 2, 145, 20, width / 2, 360, 660); glow.addColorStop(0, '#8d7d64'); glow.addColorStop(.38, '#3c4869'); glow.addColorStop(1, '#10162b'); context.fillStyle = glow; context.fillRect(0, 0, width, height);
  polygon([point(0, 0), point(100, 0), point(100, 100), point(0, 100)], '#b58a5c', 'rgba(255,240,203,.7)');
  context.strokeStyle = 'rgba(79,47,29,.24)'; context.lineWidth = 2;
  for (let line = 10; line < 100; line += 10) { const a = point(line, 0), b = point(line, 100), c = point(0, line), d = point(100, line); context.beginPath(); context.moveTo(...a); context.lineTo(...b); context.moveTo(...c); context.lineTo(...d); context.stroke(); }
  const zoneColors = {front: 'rgba(226,192,133,.47)', service: 'rgba(107,127,177,.43)', guest: 'rgba(99,144,119,.34)', back: 'rgba(126,94,112,.38)'};
  floor.zones.forEach(item => prism(item, zoneColors[item.className] || 'rgba(99,144,119,.35)', .8));
  // Exterior shell, open at the front so the interior remains visible.
  [{x: 0, y: 0, w: 100, h: 3}, {x: 0, y: 0, w: 3, h: 100}, {x: 97, y: 0, w: 3, h: 100}].forEach(item => prism(item, '#4c566f', 27));
  for (let pane = 10; pane < 92; pane += 20) prism({x: pane, y: .8, w: 13, h: 1.1}, '#85bdd0', 20);
  floor.walls.forEach(item => prism(item, '#5a6278', 20));
  floor.obstacles.forEach(item => prism(item, '#80665f', 10));
  floor.doors.forEach(item => prism(item, '#d3a45a', 15));
  floor.sinks.forEach(item => prism(item, '#8ed2dd', 7));
  const front = zone('front'), service = zone('service'), guest = zone('guest'), back = zone('back');
  if (front) furniture({x: front.x + 4, y: front.y + 5, w: Math.max(8, front.w - 8), h: 5}, '#c58c54', 9);
  if (service) {
    furniture({x: service.x + 3, y: service.y + 4, w: Math.max(9, service.w - 6), h: 6}, '#4d6380', 12);
    furniture({x: service.x + 6, y: service.y + 12, w: Math.max(6, service.w - 12), h: 3}, '#d4bd8b', 9);
  }
  if (guest) model === 'retail' ? placeShelves(guest) : placeTables(guest);
  if (back) { furniture({x: back.x + 4, y: back.y + 5, w: Math.max(7, back.w - 8), h: 5}, '#644e5b', 11); furniture({x: back.x + 6, y: back.y + 13, w: 4, h: 4}, '#558d75', 11); }
  [25, 55, 83].forEach(x => { const [px, py] = point(x, 38, 26); const light = context.createRadialGradient(px, py, 1, px, py, 35); light.addColorStop(0, 'rgba(255,240,186,.94)'); light.addColorStop(1, 'rgba(255,240,186,0)'); context.fillStyle = light; context.beginPath(); context.arc(px, py, 34, 0, Math.PI * 2); context.fill(); context.fillStyle = '#fff2c2'; context.beginPath(); context.arc(px, py, 5, 0, Math.PI * 2); context.fill(); });
  context.fillStyle = '#fff5dc'; context.font = '600 25px Arial'; context.fillText(`${layoutEditor.plan.concept} · ${floor.name}`, 34, 52);
  context.fillStyle = 'rgba(255,255,255,.78)'; context.font = '16px Arial'; context.fillText('Live interior model with materials, furniture, lighting, and circulation', 34, 79);
}
function setVisionStatus(message) { document.querySelector('#vision-render-status').textContent = message; }
function updateVisionPreview() {
  const vision = document.querySelector('#concept-vision');
  if (vision.hidden) return;
  drawConceptView();
  document.querySelector('#vision-caption').textContent = 'A free 3D concept model that updates instantly from walls, doors, sinks, obstacles, floors, and business type.';
}
function markVisionStale() {
  const vision = document.querySelector('#concept-vision');
  if (vision.hidden) return;
  vision.dataset.stale = 'true';
  updateVisionPreview();
  setVisionStatus('Floor plan changed. The free 3D concept model updated automatically.');
}
function requestConceptRender() {
  if (!layoutEditor) return;
  const payload = layoutPayload();
  if (lastRenderedSignature === payload.signature) { setVisionStatus('This plan visual is already up to date.'); return; }
  updateVisionPreview();
  document.querySelector('#concept-vision').dataset.stale = 'false';
  lastRenderedSignature = payload.signature;
  setVisionStatus('Free 3D concept model updated. No additional API or credits used.');
}
function initialEditorZones(plan) {
  return plan.zones.map((zone, index) => [
    {x: 4, y: 70, w: 25, h: 24}, {x: 31, y: 70, w: 28, h: 24},
    {x: 4, y: 5, w: 61, h: 57}, {x: 70, y: 5, w: 25, h: 30}
  ][index] && ({...zone, id: `zone-${index}`, ...[
    {x: 4, y: 70, w: 25, h: 24}, {x: 31, y: 70, w: 28, h: 24},
    {x: 4, y: 5, w: 61, h: 57}, {x: 70, y: 5, w: 25, h: 30}
  ][index]}));
}
function activeFloor() { return layoutEditor.floors[layoutEditor.activeFloor]; }
function setEditorStatus(message) { document.querySelector('#editor-status').textContent = message; }
function editorItemStyle(item) { return `left:${item.x}%;top:${item.y}%;width:${item.w || 6}%;height:${item.h || 6}%;transform:rotate(${item.rotate || 0}deg);border-radius:${item.shape === 'circle' ? '50%' : item.shape === 'rounded' ? '12px' : '2px'}`; }
function applyCapacityPenalty() {
  const floor = activeFloor(), plan = layoutEditor.plan;
  const penalty = floor.obstacles.length * 1.6 + floor.sinks.length * 1.4 + floor.walls.length * .7;
  const peak = Math.max(1, Math.round(plan.peakGuests - penalty / plan.profile.sqmPerGuest));
  const daily = Math.max(1, Math.round(plan.dailyGuests * peak / Math.max(plan.peakGuests, 1)));
  document.querySelector('#peak-guests').textContent = `${peak} people`;
  document.querySelector('#daily-guests').textContent = `${daily} people`;
  document.querySelector('#guest-area').textContent = `${Math.max(0, integer(plan.guestArea - penalty))} m²`;
  return {peak, daily, penalty};
}
function updateSelectedControls() {
  const controls = document.querySelector('#selected-item-controls'), item = layoutEditor.selected;
  controls.hidden = !item || item.kind === 'zone';
  if (controls.hidden) return;
  document.querySelector('#item-shape').value = item.shape || 'rectangle';
  document.querySelector('#item-width').value = item.w || 6;
  document.querySelector('#item-height').value = item.h || 6;
  document.querySelector('#item-rotation').value = item.rotate || 0;
  const sync = () => { item.shape = document.querySelector('#item-shape').value; item.w = Number(document.querySelector('#item-width').value); item.h = Number(document.querySelector('#item-height').value); item.rotate = Number(document.querySelector('#item-rotation').value); renderLayoutEditor(); markVisionStale(); setEditorStatus('The selected item shape and size were updated.'); };
  ['#item-shape', '#item-width', '#item-height', '#item-rotation'].forEach(selector => { const control = document.querySelector(selector); control.oninput = sync; control.onchange = sync; });
}
function renderLayoutEditor() {
  if (!layoutEditor) return;
  const floor = activeFloor();
  const tabs = document.querySelector('#floor-tabs');
  tabs.innerHTML = layoutEditor.floors.map((item, index) => `<button type="button" data-floor="${index}" class="${index === layoutEditor.activeFloor ? 'is-active' : ''}">${text(item.name)}</button>`).join('');
  tabs.querySelectorAll('button').forEach(button => button.onclick = () => { layoutEditor.activeFloor = Number(button.dataset.floor); layoutEditor.selected = null; renderLayoutEditor(); markVisionStale(); setEditorStatus(`Editing ${activeFloor().name}.`); });
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.tool === layoutEditor.tool);
    button.onclick = () => { layoutEditor.tool = button.dataset.tool; layoutEditor.selected = null; renderLayoutEditor(); setEditorStatus(layoutEditor.tool === 'select' ? 'Move: drag an area, wall, or obstacle.' : `Click an empty part of the plan to add a ${layoutEditor.tool}.`); };
  });
  const canvas = document.querySelector('#editor-canvas');
  canvas.innerHTML = [
    ...floor.zones.map(zone => `<div class="editor-zone ${zone.className} ${layoutEditor.selected?.id === zone.id ? 'is-selected' : ''}" data-kind="zone" data-id="${zone.id}" style="left:${zone.x}%;top:${zone.y}%;width:${zone.w}%;height:${zone.h}%"><span><b>${text(zone.name)}</b>${integer(zone.area)} m²</span></div>`),
    ...floor.walls.map(item => `<div class="editor-wall ${layoutEditor.selected?.id === item.id ? 'is-selected' : ''}" data-kind="wall" data-id="${item.id}" style="${editorItemStyle(item)}"></div>`),
    ...floor.obstacles.map(item => `<div class="editor-obstacle ${layoutEditor.selected?.id === item.id ? 'is-selected' : ''}" data-kind="obstacle" data-id="${item.id}" style="${editorItemStyle(item)}"></div>`),
    ...floor.doors.map(item => `<div class="editor-door ${layoutEditor.selected?.id === item.id ? 'is-selected' : ''}" data-kind="door" data-id="${item.id}" style="${editorItemStyle(item)}"></div>`),
    ...floor.sinks.map(item => `<div class="editor-sink ${layoutEditor.selected?.id === item.id ? 'is-selected' : ''}" data-kind="sink" data-id="${item.id}" style="${editorItemStyle(item)}"></div>`)
  ].join('');
  updateSelectedControls();
  let drag = null;
  const getItem = (kind, id) => floor[`${kind}s`]?.find(item => item.id === id) || floor.zones.find(item => item.id === id);
  canvas.onpointerdown = event => {
    const itemElement = event.target.closest('[data-kind]');
    const rect = canvas.getBoundingClientRect();
    const point = {x: (event.clientX - rect.left) / rect.width * 100, y: (event.clientY - rect.top) / rect.height * 100};
    if (!itemElement && layoutEditor.tool !== 'select') {
      const kind = layoutEditor.tool;
      const defaults = {wall: {w: 24, h: 3, shape: 'rectangle'}, obstacle: {w: 7, h: 9, shape: 'rounded'}, door: {w: 13, h: 4, shape: 'rounded'}, sink: {w: 6, h: 7, shape: 'circle'}}[kind];
      const item = {id: `${kind}-${Date.now()}`, x: clamp(point.x - defaults.w / 2, 0, 100 - defaults.w), y: clamp(point.y - defaults.h / 2, 0, 100 - defaults.h), rotate: 0, ...defaults};
      item.kind = kind; floor[`${kind}s`].push(item); layoutEditor.selected = item; renderLayoutEditor(); markVisionStale(); setEditorStatus(`${kind === 'wall' ? 'Wall' : kind === 'door' ? 'Door' : kind === 'sink' ? 'Sink' : 'Obstacle'} added. Switch to Move to reposition it.`); return;
    }
    if (!itemElement) return;
    const kind = itemElement.dataset.kind, item = getItem(kind, itemElement.dataset.id);
    item.kind = kind; layoutEditor.selected = item;
    if (layoutEditor.tool !== 'select') { renderLayoutEditor(); return; }
    drag = {item, element: itemElement, kind, dx: point.x - item.x, dy: point.y - item.y};
    canvas.setPointerCapture(event.pointerId);
  };
  canvas.onpointermove = event => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 100, y = (event.clientY - rect.top) / rect.height * 100;
    const maxX = drag.kind === 'zone' ? 100 - drag.item.w : drag.kind === 'wall' ? 100 - drag.item.w : 95;
    const maxY = drag.kind === 'zone' ? 100 - drag.item.h : 95;
    drag.item.x = clamp(x - drag.dx, 0, maxX); drag.item.y = clamp(y - drag.dy, 0, maxY);
    drag.element.style.left = `${drag.item.x}%`; drag.element.style.top = `${drag.item.y}%`;
  };
  canvas.onpointerup = event => { if (drag) { canvas.releasePointerCapture(event.pointerId); drag = null; markVisionStale(); setEditorStatus('Position updated. You can select another floor or add a constraint.'); } };
  document.querySelector('#delete-layout-item').onclick = () => {
    const selected = layoutEditor.selected; if (!selected || selected.kind === 'zone') { setEditorStatus('Select a wall, door, sink, or obstacle to delete it.'); return; }
    floor[`${selected.kind}s`] = floor[`${selected.kind}s`].filter(item => item.id !== selected.id); layoutEditor.selected = null; renderLayoutEditor(); markVisionStale(); setEditorStatus('Selected item deleted.');
  };
  document.querySelector('#add-floor').onclick = () => {
    const next = layoutEditor.floors.length + 1;
    layoutEditor.floors.push({name: `Floor ${next}`, zones: initialEditorZones(layoutEditor.plan), walls: [], obstacles: [], doors: [], sinks: []});
    layoutEditor.activeFloor = next - 1; layoutEditor.selected = null; renderLayoutEditor(); markVisionStale(); setEditorStatus(`Floor ${next} added. Each floor can be edited independently.`);
  };
  document.querySelector('#optimize-layout').onclick = () => {
    const barriers = [...floor.walls, ...floor.obstacles, ...floor.sinks];
    floor.zones.forEach(zone => barriers.forEach(item => {
      const overlap = zone.x < item.x + item.w && zone.x + zone.w > item.x && zone.y < item.y + item.h && zone.y + zone.h > item.y;
      if (overlap) zone.y = clamp(item.y + item.h + 3, 0, 100 - zone.h);
    }));
    const capacity = applyCapacityPenalty(); renderLayoutEditor(); markVisionStale(); setEditorStatus(`Layout updated for the selected constraints. Estimated active-floor capacity: ${capacity.peak} people.`);
  };
  document.querySelector('#approve-layout').onclick = () => {
    const capacity = applyCapacityPenalty(), vision = document.querySelector('#concept-vision');
    vision.hidden = false;
    const materialSet = layoutEditor.plan.profile === modelProfiles.retail ? ['Modular shelving system', 'Durable vinyl flooring', 'Window-display lighting'] : layoutEditor.plan.profile === modelProfiles.studio ? ['Acoustic surfaces', 'Hygienic wet area', 'Flexible partition system'] : ['Warm wood', 'Matte mineral plaster', 'Layered ambient lighting'];
    document.querySelector('#vision-title').textContent = `${layoutEditor.plan.concept} · interior design direction`;
    document.querySelector('#vision-summary').textContent = `The plan for ${activeFloor().name} was approved. The design direction accounts for ${activeFloor().doors.length} doors, ${activeFloor().sinks.length} sinks, and ${activeFloor().walls.length + activeFloor().obstacles.length} physical constraints, with an estimated simultaneous capacity of ${capacity.peak} people.`;
    document.querySelector('#vision-materials').innerHTML = materialSet.map(item => `<span>${text(item)}</span>`).join('');
    vision.dataset.stale = 'true'; updateVisionPreview();
    vision.scrollIntoView({behavior: 'smooth', block: 'start'}); setEditorStatus('Plan approved; the free live preview was updated.');
    requestConceptRender();
  };
}
function initializeLayoutEditor(plan) {
  layoutEditor = {plan, activeFloor: 0, tool: 'select', selected: null, floors: [{name: 'Floor 1', zones: initialEditorZones(plan), walls: [], obstacles: [], doors: [], sinks: []}]};
  renderLayoutEditor();
}

function renderPlan(plan) {
  document.querySelector('.studio-empty').hidden = true;
  document.querySelector('#studio-result').hidden = false;
  document.querySelector('#layout-title').textContent = `${plan.concept} · ${plan.profile.label}`;
  document.querySelector('#layout-badge').textContent = `${integer(plan.area)} m² · ${plan.frontage.toFixed(1)} m frontage`;
  document.querySelector('#layout-plan').innerHTML = `<div class="floor-shell" style="aspect-ratio:${Math.max(.7, Math.min(2.5, plan.frontage / plan.depth))}">${plan.zones.map(zone => `<div class="zone ${zone.className}" style="${zoneStyle(zone, plan)}"><span><b>${text(zone.name)}</b>${integer(zone.area)} m²</span></div>`).join('')}</div>`;
  initializeLayoutEditor(plan);
  document.querySelector('#studio-result').scrollIntoView({behavior: 'smooth', block: 'start'});
  document.querySelector('#peak-guests').textContent = `${plan.peakGuests} people`;
  document.querySelector('#daily-guests').textContent = `${plan.dailyGuests} people`;
  const capacityCopy = plan.conceptId === 'accommodation' ? ['Daily guests staying', 'with occupancy assumption']
    : plan.conceptId === 'beauty' ? ['Daily appointment capacity', 'with rooms and duration']
      : plan.conceptId === 'repair' ? ['Daily work orders', 'with station capacity']
        : plan.conceptId === 'consulting' ? ['Daily clients / visitors', 'with office use']
          : plan.profile === modelProfiles.retail ? ['Daily visit potential', 'with space-flow estimate']
            : ['Daily hosting', 'with service turns'];
  document.querySelector('#daily-capacity-label').textContent = capacityCopy[0];
  document.querySelector('#daily-capacity-note').textContent = capacityCopy[1];
  document.querySelector('#guest-area').textContent = `${integer(plan.guestArea)} m²`;
  document.querySelector('#layout-efficiency').textContent = `%${plan.efficiency}`;
  const circulationNote = plan.accessible ? 'Extra space was reserved for accessible circulation.' : 'Circulation space was allocated for operating flow only.';
  document.querySelector('#layout-summary').textContent = `The ${integer(plan.area)} m² space assumes an approximate depth of ${integer(plan.depth)} m. Guest/sales area is ${integer(plan.guestArea)} m², producing an operating scenario of ${plan.peakGuests} simultaneous people and about ${plan.dailyGuests} people per day. ${circulationNote}`;
  const volumeAction = plan.profile === modelProfiles.retail
    ? `Validate the daily potential of ${plan.dailyGuests} visits weekly using checkout activity and real store traffic.`
    : plan.profile === modelProfiles.studio
      ? `Validate the daily use/appointment target of ${plan.dailyGuests} people weekly with calendar occupancy and team capacity.`
      : `Track the daily scenario of ${plan.dailyGuests} people with the selected ${plan.serviceTurns.toLocaleString('en-GB')} service turns; update it weekly with actual footfall and sales data.`;
  const actions = [
    `Separate welcome and service flow at the frontage; test entry queues on site for the ${plan.frontage.toFixed(1)} m frontage.`,
    plan.efficiency < 35 ? 'The back-area ratio is high. Consider modular equipment in storage and preparation areas to increase guest space.' : 'Guest/sales area looks balanced. Place tables or displays without interrupting the main circulation route.',
    volumeAction,
  ];
  document.querySelector('#layout-actions').innerHTML = actions.map(action => `<li>${text(action)}</li>`).join('');
}

studioForm.addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(studioForm);
  const selected = studioCatalog.getConcept(form.get('concept'));
  const parameterSet = activeParameterSet();
  const parameters = Object.fromEntries(parameterSet.map(([key]) => [key, Number(form.get(`param-${key}`))]));
  renderPlan(planLayout({
    concept: selected.label, conceptId: selected.model === form.get('model') ? selected.id : null, model: form.get('model'), area: Number(form.get('area')),
    frontage: Number(form.get('frontage')), seating: form.get('seating'), turns: form.get('turns'), accessible: form.get('accessible') === 'on', parameters
  }));
});

document.querySelector('#refresh-concept-vision').addEventListener('click', requestConceptRender);
document.querySelector('#rotate-concept-vision').addEventListener('click', () => { conceptViewAngle = conceptViewAngle ? 0 : 1; drawConceptView(); setVisionStatus('3D concept model shown from a different angle.'); });
