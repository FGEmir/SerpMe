const studioForm = document.querySelector('#studio-form');
const studioCatalog = window.SerpMeCatalog;
const studioCategory = document.querySelector('#studio-category');
const studioConcept = document.querySelector('#studio-concept');
const modelProfiles = {
  cafe: {label: 'Kafe / hızlı servis', front: .14, service: .19, back: .18, circulation: .20, sqmPerGuest: 1.65, defaultTurns: 3.2},
  restaurant: {label: 'Restoran', front: .10, service: .28, back: .17, circulation: .22, sqmPerGuest: 1.95, defaultTurns: 2.2},
  retail: {label: 'Perakende', front: .10, service: .09, back: .20, circulation: .25, sqmPerGuest: 2.3, defaultTurns: 4.2},
  studio: {label: 'Stüdyo / spor', front: .10, service: .12, back: .16, circulation: .22, sqmPerGuest: 3.1, defaultTurns: 2.2}
};
const serviceParameters = {
  cafe: [['counterLength','Bar uzunluğu (m)',4,1,20],['avgDwell','Ortalama kalış (dk)',55,15,180],['deliveryShare','Paket servis payı (%)',15,0,80]],
  restaurant: [['kitchenRatio','Mutfak alanı (%)',28,15,45],['tableTurns','Masa turu / gün',2.2,1,6,.1],['avgParty','Ortalama grup büyüklüğü',2.4,1,10,.1]],
  retail: [['displayRatio','Sergileme alanı (%)',55,20,80],['warehouseShare','Depo alanı (%)',20,8,55],['avgBasket','Ortalama sepet (₺)',650,50,20000]],
  studio: [['workstations','Çalışma istasyonu',6,1,50],['appointmentMinutes','Hizmet süresi (dk)',60,15,240],['meetingRooms','Kapalı oda / toplantı odası',2,0,20]]
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
  document.querySelector('#studio-parameters').innerHTML = `<p class="eyebrow">${isConceptModel ? 'KONSEPTE ÖZGÜ PARAMETRELER' : 'SEÇİLEN SERVİS MODELİ PARAMETRELERİ'}</p><div>${parameters.map(([key, label, value, min, max, step]) => `<label>${text(label)}<input name="param-${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step || 1}" /></label>`).join('')}</div>`;
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
    {key: 'front', name: model === 'retail' ? 'Vitrin / giriş' : 'Karşılama', area: area * profile.front, className: 'front'},
    {key: 'service', name: model === 'restaurant' ? 'Mutfak / servis' : model === 'retail' ? 'Kasa / deneme' : 'Bar / servis', area: area * profile.service, className: 'service'},
    {key: 'guest', name: model === 'retail' ? 'Satış alanı' : model === 'studio' ? 'Aktivite alanı' : 'Konuk alanı', area: guestArea, className: 'guest'},
    {key: 'back', name: 'Depo / arka alan', area: area * profile.back, className: 'back'},
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
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
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
  document.querySelector('#peak-guests').textContent = `${peak} kişi`;
  document.querySelector('#daily-guests').textContent = `${daily} kişi`;
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
  const sync = () => { item.shape = document.querySelector('#item-shape').value; item.w = Number(document.querySelector('#item-width').value); item.h = Number(document.querySelector('#item-height').value); item.rotate = Number(document.querySelector('#item-rotation').value); renderLayoutEditor(); setEditorStatus('Seçilen ögenin şekli ve boyutu güncellendi.'); };
  ['#item-shape', '#item-width', '#item-height', '#item-rotation'].forEach(selector => { const control = document.querySelector(selector); control.oninput = sync; control.onchange = sync; });
}
function renderLayoutEditor() {
  if (!layoutEditor) return;
  const floor = activeFloor();
  const tabs = document.querySelector('#floor-tabs');
  tabs.innerHTML = layoutEditor.floors.map((item, index) => `<button type="button" data-floor="${index}" class="${index === layoutEditor.activeFloor ? 'is-active' : ''}">${text(item.name)}</button>`).join('');
  tabs.querySelectorAll('button').forEach(button => button.onclick = () => { layoutEditor.activeFloor = Number(button.dataset.floor); layoutEditor.selected = null; renderLayoutEditor(); setEditorStatus(`${activeFloor().name} düzenleniyor.`); });
  document.querySelectorAll('[data-tool]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.tool === layoutEditor.tool);
    button.onclick = () => { layoutEditor.tool = button.dataset.tool; layoutEditor.selected = null; renderLayoutEditor(); setEditorStatus(layoutEditor.tool === 'select' ? 'Taşı: bir alanı, duvarı veya engeli sürükleyin.' : `${layoutEditor.tool === 'wall' ? 'Duvar' : 'Engel'} eklemek için planın boş alanına tıklayın.`); };
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
      item.kind = kind; floor[`${kind}s`].push(item); layoutEditor.selected = item; renderLayoutEditor(); setEditorStatus(`${kind === 'wall' ? 'Duvar' : kind === 'door' ? 'Kapı' : kind === 'sink' ? 'Lavabo' : 'Engel'} eklendi; Taşı aracına geçerek konumunu değiştirebilirsiniz.`); return;
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
  canvas.onpointerup = event => { if (drag) { canvas.releasePointerCapture(event.pointerId); drag = null; setEditorStatus('Konum güncellendi. Başka bir kat seçebilir veya engel ekleyebilirsiniz.'); } };
  document.querySelector('#delete-layout-item').onclick = () => {
    const selected = layoutEditor.selected; if (!selected || selected.kind === 'zone') { setEditorStatus('Silmek için önce eklediğiniz bir duvar veya engeli seçin.'); return; }
    floor[`${selected.kind}s`] = floor[`${selected.kind}s`].filter(item => item.id !== selected.id); layoutEditor.selected = null; renderLayoutEditor(); setEditorStatus('Seçilen öge silindi.');
  };
  document.querySelector('#add-floor').onclick = () => {
    const next = layoutEditor.floors.length + 1;
    layoutEditor.floors.push({name: `Kat ${next}`, zones: initialEditorZones(layoutEditor.plan), walls: [], obstacles: [], doors: [], sinks: []});
    layoutEditor.activeFloor = next - 1; layoutEditor.selected = null; renderLayoutEditor(); setEditorStatus(`Kat ${next} eklendi. Her kat bağımsız düzenlenebilir.`);
  };
  document.querySelector('#optimize-layout').onclick = () => {
    const barriers = [...floor.walls, ...floor.obstacles, ...floor.sinks];
    floor.zones.forEach(zone => barriers.forEach(item => {
      const overlap = zone.x < item.x + item.w && zone.x + zone.w > item.x && zone.y < item.y + item.h && zone.y + zone.h > item.y;
      if (overlap) zone.y = clamp(item.y + item.h + 3, 0, 100 - zone.h);
    }));
    const capacity = applyCapacityPenalty(); renderLayoutEditor(); setEditorStatus(`Engeller dikkate alınarak yerleşim güncellendi. Aktif kat için tahmini kapasite ${capacity.peak} kişi.`);
  };
  document.querySelector('#approve-layout').onclick = () => {
    const capacity = applyCapacityPenalty(), vision = document.querySelector('#concept-vision');
    vision.hidden = false;
    const materialSet = layoutEditor.plan.profile === modelProfiles.retail ? ['Modüler raf sistemi', 'Dayanıklı vinil zemin', 'Vitrin aydınlatması'] : layoutEditor.plan.profile === modelProfiles.studio ? ['Akustik yüzeyler', 'Hijyenik ıslak hacim', 'Esnek bölme sistemi'] : ['Sıcak ahşap', 'Mat mineral sıva', 'Katmanlı atmosfer aydınlatması'];
    document.querySelector('#vision-title').textContent = `${layoutEditor.plan.concept} · iç mimari yönü`;
    document.querySelector('#vision-summary').textContent = `${activeFloor().name} için plan onaylandı. ${activeFloor().doors.length} kapı, ${activeFloor().sinks.length} lavabo ve ${activeFloor().walls.length + activeFloor().obstacles.length} fiziksel engel dikkate alınarak tahmini ${capacity.peak} eş zamanlı kişi kapasitesiyle tasarım yönü oluşturuldu.`;
    document.querySelector('#vision-materials').innerHTML = materialSet.map(item => `<span>${text(item)}</span>`).join('');
    vision.scrollIntoView({behavior: 'smooth', block: 'start'}); setEditorStatus('Plan onaylandı; konsept görseli ve iç mimari yönü aşağıda hazır.');
  };
}
function initializeLayoutEditor(plan) {
  layoutEditor = {plan, activeFloor: 0, tool: 'select', selected: null, floors: [{name: 'Kat 1', zones: initialEditorZones(plan), walls: [], obstacles: [], doors: [], sinks: []}]};
  renderLayoutEditor();
}

function renderPlan(plan) {
  document.querySelector('.studio-empty').hidden = true;
  document.querySelector('#studio-result').hidden = false;
  document.querySelector('#layout-title').textContent = `${plan.concept} · ${plan.profile.label}`;
  document.querySelector('#layout-badge').textContent = `${integer(plan.area)} m² · ${plan.frontage.toFixed(1)} m cephe`;
  document.querySelector('#layout-plan').innerHTML = `<div class="floor-shell" style="aspect-ratio:${Math.max(.7, Math.min(2.5, plan.frontage / plan.depth))}">${plan.zones.map(zone => `<div class="zone ${zone.className}" style="${zoneStyle(zone, plan)}"><span><b>${text(zone.name)}</b>${integer(zone.area)} m²</span></div>`).join('')}</div>`;
  initializeLayoutEditor(plan);
  document.querySelector('#peak-guests').textContent = `${plan.peakGuests} kişi`;
  document.querySelector('#daily-guests').textContent = `${plan.dailyGuests} kişi`;
  const capacityCopy = plan.conceptId === 'accommodation' ? ['Günlük konaklayan', 'doluluk varsayımıyla']
    : plan.conceptId === 'beauty' ? ['Günlük randevu kapasitesi', 'oda ve süre ile']
      : plan.conceptId === 'repair' ? ['Günlük iş emri', 'istasyon kapasitesiyle']
        : plan.conceptId === 'consulting' ? ['Günlük müşteri / ziyaret', 'ofis kullanımıyla']
          : plan.profile === modelProfiles.retail ? ['Günlük ziyaret potansiyeli', 'alan akışı tahmini']
            : ['Günlük ağırlama', 'servis turu ile'];
  document.querySelector('#daily-capacity-label').textContent = capacityCopy[0];
  document.querySelector('#daily-capacity-note').textContent = capacityCopy[1];
  document.querySelector('#guest-area').textContent = `${integer(plan.guestArea)} m²`;
  document.querySelector('#layout-efficiency').textContent = `%${plan.efficiency}`;
  const circulationNote = plan.accessible ? 'Erişilebilir dolaşım için ek alan ayrıldı.' : 'Dolaşım alanı yalnızca operasyon akışına göre ayrıldı.';
  document.querySelector('#layout-summary').textContent = `${integer(plan.area)} m² mekânda yaklaşık ${integer(plan.depth)} m derinlik varsayıldı. Konuk/satış alanı ${integer(plan.guestArea)} m²; ${plan.peakGuests} eş zamanlı kişi ve günde yaklaşık ${plan.dailyGuests} kişilik operasyon senaryosu üretir. ${circulationNote}`;
  const volumeAction = plan.profile === modelProfiles.retail
    ? `Günlük ${plan.dailyGuests} ziyaret potansiyelini kasa geçişi ve gerçek mağaza trafiğiyle haftalık doğrulayın.`
    : plan.profile === modelProfiles.studio
      ? `Günlük ${plan.dailyGuests} kişilik kullanım/randevu hedefini takvim doluluğu ve ekip kapasitesiyle haftalık doğrulayın.`
      : `Günlük ${plan.dailyGuests} kişilik senaryoyu, seçilen ${plan.serviceTurns.toLocaleString('tr-TR')} servis turu ile takip edin; gerçek yaya trafiği ve satış verisiyle haftalık güncelleyin.`;
  const actions = [
    `Cephede karşılama ve servis akışını ayırın; ${plan.frontage.toFixed(1)} m cephe için girişte kuyruk oluşumunu sahada test edin.`,
    plan.efficiency < 35 ? 'Arka alan oranı yüksek. Depo ve hazırlık alanlarını modüler ekipmanla gözden geçirerek konuk alanını artırmayı değerlendirin.' : 'Konuk/satış alanı dengeli görünüyor. Masaları veya sergileri ana dolaşım hattını kesmeyecek şekilde yerleştirin.',
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
