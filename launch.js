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
const integer = value => Math.max(0, Math.round(Number(value) || 0));
const text = value => { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; };

function fillStudioConcepts() {
  const category = studioCatalog.getCategory(studioCategory.value);
  studioConcept.innerHTML = category.concepts.map(concept => `<option value="${concept.id}">${text(concept.label)}</option>`).join('');
  renderStudioParameters();
}
function renderStudioParameters() {
  const concept = studioCatalog.getConcept(studioConcept.value);
  document.querySelector('#studio-parameters').innerHTML = `<p class="eyebrow">KONSEPTE ÖZGÜ PARAMETRELER</p><div>${concept.params.map(([key, label, value, min, max, step]) => `<label>${text(label)}<input name="param-${key}" type="number" value="${value}" min="${min}" max="${max}" step="${step || 1}" /></label>`).join('')}</div>`;
  studioForm.elements.model.value = concept.model;
}
function initializeStudioCatalog() {
  studioCategory.innerHTML = studioCatalog.categories.map(category => `<option value="${category.id}">${text(category.label)}</option>`).join('');
  fillStudioConcepts();
  studioCategory.addEventListener('change', fillStudioConcepts);
  studioConcept.addEventListener('change', renderStudioParameters);
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
  return {concept, profile, area, frontage, depth, guestArea, peakGuests, dailyGuests, serviceTurns, efficiency, accessible, zones};
}

function zoneStyle(zone, plan) {
  const percent = Math.max(10, Math.round(zone.area / plan.area * 100));
  if (zone.key === 'front') return `left:3%;bottom:3%;width:${Math.min(28, percent)}%;height:28%`;
  if (zone.key === 'service') return `left:${Math.min(34, percent + 5)}%;bottom:3%;width:${Math.min(30, percent)}%;height:28%`;
  if (zone.key === 'back') return `right:3%;top:3%;width:${Math.min(28, percent + 2)}%;height:31%`;
  return `left:3%;top:3%;width:${Math.max(42, Math.min(63, percent + 9))}%;height:57%`;
}

function renderPlan(plan) {
  document.querySelector('.studio-empty').hidden = true;
  document.querySelector('#studio-result').hidden = false;
  document.querySelector('#layout-title').textContent = `${plan.concept} · ${plan.profile.label}`;
  document.querySelector('#layout-badge').textContent = `${integer(plan.area)} m² · ${plan.frontage.toFixed(1)} m cephe`;
  document.querySelector('#layout-plan').innerHTML = `<div class="floor-shell" style="aspect-ratio:${Math.max(.7, Math.min(2.5, plan.frontage / plan.depth))}">${plan.zones.map(zone => `<div class="zone ${zone.className}" style="${zoneStyle(zone, plan)}"><span><b>${text(zone.name)}</b>${integer(zone.area)} m²</span></div>`).join('')}</div>`;
  document.querySelector('#peak-guests').textContent = `${plan.peakGuests} kişi`;
  document.querySelector('#daily-guests').textContent = `${plan.dailyGuests} kişi`;
  document.querySelector('#guest-area').textContent = `${integer(plan.guestArea)} m²`;
  document.querySelector('#layout-efficiency').textContent = `%${plan.efficiency}`;
  const circulationNote = plan.accessible ? 'Erişilebilir dolaşım için ek alan ayrıldı.' : 'Dolaşım alanı yalnızca operasyon akışına göre ayrıldı.';
  document.querySelector('#layout-summary').textContent = `${integer(plan.area)} m² mekânda yaklaşık ${integer(plan.depth)} m derinlik varsayıldı. Konuk/satış alanı ${integer(plan.guestArea)} m²; ${plan.peakGuests} eş zamanlı kişi ve günde yaklaşık ${plan.dailyGuests} kişilik operasyon senaryosu üretir. ${circulationNote}`;
  const actions = [
    `Cephede karşılama ve servis akışını ayırın; ${plan.frontage.toFixed(1)} m cephe için girişte kuyruk oluşumunu sahada test edin.`,
    plan.efficiency < 35 ? 'Arka alan oranı yüksek. Depo ve hazırlık alanlarını modüler ekipmanla gözden geçirerek konuk alanını artırmayı değerlendirin.' : 'Konuk/satış alanı dengeli görünüyor. Masaları veya sergileri ana dolaşım hattını kesmeyecek şekilde yerleştirin.',
    `Günlük ${plan.dailyGuests} kişilik senaryoyu, seçilen ${plan.serviceTurns.toLocaleString('tr-TR')} servis turu ile takip edin; gerçek yaya trafiği ve satış verisiyle haftalık güncelleyin.`,
  ];
  document.querySelector('#layout-actions').innerHTML = actions.map(action => `<li>${text(action)}</li>`).join('');
}

studioForm.addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(studioForm);
  const selected = studioCatalog.getConcept(form.get('concept'));
  const parameters = Object.fromEntries(selected.params.map(([key]) => [key, Number(form.get(`param-${key}`))]));
  renderPlan(planLayout({
    concept: selected.label, conceptId: selected.id, model: selected.model, area: Number(form.get('area')),
    frontage: Number(form.get('frontage')), seating: form.get('seating'), turns: form.get('turns'), accessible: form.get('accessible') === 'on', parameters
  }));
});
