const studioForm = document.querySelector('#studio-form');
const modelProfiles = {
  cafe: {label: 'Kafe / hızlı servis', front: .14, service: .19, back: .18, circulation: .20, sqmPerGuest: 1.65, defaultTurns: 3.2},
  restaurant: {label: 'Restoran', front: .10, service: .28, back: .17, circulation: .22, sqmPerGuest: 1.95, defaultTurns: 2.2},
  retail: {label: 'Perakende', front: .10, service: .09, back: .20, circulation: .25, sqmPerGuest: 2.3, defaultTurns: 4.2},
  studio: {label: 'Stüdyo / spor', front: .10, service: .12, back: .16, circulation: .22, sqmPerGuest: 3.1, defaultTurns: 2.2}
};
const integer = value => Math.max(0, Math.round(Number(value) || 0));
const text = value => { const el = document.createElement('div'); el.textContent = value; return el.innerHTML; };

function planLayout({concept, model, area, frontage, seating, turns, accessible}) {
  const profile = modelProfiles[model];
  const comfort = seating === 'spacious' ? 1.17 : seating === 'dense' ? .86 : 1;
  const circulation = profile.circulation + (accessible ? .05 : 0);
  const fixedArea = area * (profile.front + profile.service + profile.back + circulation);
  const guestArea = Math.max(0, area - fixedArea);
  const sqmPerGuest = profile.sqmPerGuest * comfort;
  const peakGuests = Math.max(1, Math.floor(guestArea / sqmPerGuest));
  const serviceTurns = Number(turns || profile.defaultTurns);
  const dailyGuests = Math.round(peakGuests * serviceTurns);
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
  renderPlan(planLayout({
    concept: form.get('concept').trim(), model: form.get('model'), area: Number(form.get('area')),
    frontage: Number(form.get('frontage')), seating: form.get('seating'), turns: form.get('turns'), accessible: form.get('accessible') === 'on'
  }));
});
