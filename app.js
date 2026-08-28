const form = document.querySelector('#search-form');
const report = document.querySelector('#report');
const empty = document.querySelector('#empty-state');
const status = document.querySelector('#form-status');
let activeReport = null;
const num = (value) => Number(String(value || 0).replace(/[^\d.]/g, '')) || 0;
const plural = (n, single, many) => `${n.toLocaleString('tr-TR')} ${n === 1 ? single : many}`;
if (window.location.protocol === 'file:') {
  status.textContent = 'Canlı rapor için uygulamayı http://localhost:8000 üzerinden açın.';
}

function summarize(places) {
  const ratings = places.map(x => Number(x.rating)).filter(Boolean);
  const reviews = places.map(x => num(x.reviews));
  const openCount = places.filter(x => /açık|open/i.test(x.open_state || x.hours || '')).length;
  const averageRating = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;
  const reviewTotal = reviews.reduce((a,b)=>a+b,0);
  const reviewAverage = reviewTotal / places.length;
  const saturation = Math.min(100, places.length * 5);
  const qualityGap = Math.max(0, Math.min(100, (5 - averageRating) * 45));
  const demand = Math.min(100, Math.log10(reviewAverage + 1) * 38);
  const score = Math.round(Math.max(18, Math.min(94, 45 + qualityGap * .45 + demand * .22 - saturation * .22)));
  const density = Math.round(Math.min(100, (places.length / 20) * 48 + Math.log10(reviewAverage + 1) * 11 + (openCount / places.length) * 15));
  return { ratings, reviews, openCount, averageRating, reviewTotal, reviewAverage, score, density };
}
function densityLabel(density) { return density >= 65 ? 'yüksek' : density >= 38 ? 'orta' : 'düşük'; }
function normalize(value) { return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ç/g,'c').replace(/ö/g,'o').replace(/ü/g,'u'); }
function selectFeatured(places, business, location) {
  const locationTerms = normalize(location).split(/[,\s/]+/).filter(term => term.length > 3 && !['istanbul', 'turkiye', 'turkey'].includes(term));
  const businessTerms = normalize(business).split(/\s+/).filter(term => term.length > 3 && !['dukkani', 'isletme', 'shop'].includes(term));
  const synonyms = businessTerms.flatMap(term => ({
    kahve:['coffee','cafe','kafe','espresso','roastery'],
    kafe:['coffee','cafe','kafe'],
    brunch:['brunch','breakfast','kahvalti'],
    tatlici:['dessert','pastry','pastane','bakery','tatli'],
    restoran:['restaurant','lokanta'],
    calisma:['coworking','study','books','work'],
    spor:['gym','fitness']
  }[term] || [term]));
  const seen = new Set();
  return places.map((place, index) => {
    const id = place.data_id || place.place_id || `${place.title}|${place.address}`;
    const text = normalize(`${place.title} ${place.type} ${place.address}`);
    const locality = locationTerms.length ? locationTerms.some(term => text.includes(term)) : true;
    const relevance = synonyms.length ? synonyms.some(term => text.includes(term)) : true;
    const rating = Number(place.rating) || 0;
    const reviewScore = Math.min(1, Math.log10(num(place.reviews) + 1) / 4);
    const rankScore = Math.max(0, 1 - index / Math.max(places.length, 1));
    const comparisonScore = Math.round((locality ? 32 : 0) + (relevance ? 27 : 8) + (rating / 5) * 22 + reviewScore * 12 + rankScore * 7);
    return {...place, comparisonScore, locality, relevance, id};
  }).filter(place => {
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return place.locality && place.relevance;
  }).sort((a,b) => b.comparisonScore - a.comparisonScore || (Number(b.rating) || 0) - (Number(a.rating) || 0)).slice(0, 8);
}
function renderConcepts(concepts, location) {
  const list = document.querySelector('#concept-list'); list.innerHTML = '';
  const ranked = Object.entries(concepts || {}).map(([name, places]) => {
    const matches = selectFeatured(places, name, location);
    return {name, matches, ...summarize(matches)};
  }).filter(item => item.matches.length).sort((a,b) => b.score - a.score);
  if (!ranked.length) { list.textContent = 'Aday konsept ekleyerek karşılaştırmalı öneri alabilirsiniz.'; return; }
  ranked.forEach((item, index) => {
    const el = document.createElement('div'); el.className = 'concept';
    const verdict = index === 0 ? 'Önerilen konsept' : item.density >= 65 ? 'Yoğun rekabet' : 'Alternatif seçenek';
    const examples = item.matches.slice(0, 2).map(place => place.title).join(' · ');
    el.innerHTML = `<span class="concept-rank">${index + 1}</span><span><strong>${escapeHtml(item.name)}</strong><small>${verdict} · ${item.matches.length} uyumlu işletme · ${item.density}% yoğunluk</small></span><span><small>${item.reviewTotal.toLocaleString('tr-TR')} yorum · ${item.averageRating ? item.averageRating.toFixed(1) : '—'} puan<br>${escapeHtml(examples)}</small></span><span class="concept-score">${item.score}<small>/100</small></span>`;
    list.append(el);
  });
}
function renderBusinessPlan(stats, business, finance) {
  const contribution = finance.ticket * (finance.margin / 100);
  const fixed = finance.rent + finance.fixedCosts;
  const monthlyTransactions = Math.ceil(fixed / contribution);
  const dailyTransactions = Math.ceil(monthlyTransactions / 30);
  const turnover = monthlyTransactions * finance.ticket;
  const workingCapital = fixed * 3;
  const densityRisk = stats.density >= 65 ? 'yüksek rekabet' : stats.density >= 38 ? 'kontrollü rekabet' : 'düşük rekabet';
  document.querySelector('#plan-summary').textContent = `${business} için pazar ${densityRisk} gösteriyor. Model, girilen ₺${finance.ticket.toLocaleString('tr-TR')} ortalama sepet ve %${finance.margin} brüt marj varsayımıyla hesaplandı.`;
  const values = [
    ['Günlük başa baş', `${dailyTransactions} işlem`, '30 gün varsayımı'],
    ['Aylık başa baş ciro', `₺${Math.round(turnover).toLocaleString('tr-TR')}`, 'KDV/vergi hariç'],
    ['Aylık sabit yük', `₺${fixed.toLocaleString('tr-TR')}`, 'kira + sabit gider'],
    ['3 aylık işletme sermayesi', `₺${workingCapital.toLocaleString('tr-TR')}`, 'nakit tamponu']
  ];
  const grid = document.querySelector('#plan-metrics'); grid.innerHTML = values.map(([label,value,note]) => `<article><p>${label}</p><strong>${value}</strong><p>${note}</p></article>`).join('');
  const actions = [
    `Açılıştan önce günlük en az ${dailyTransactions} işlem hedefini; yaya trafiği sayımı, teslimat kapsaması ve oturma kapasitesiyle doğrulayın.`,
    stats.density >= 65 ? 'Fiyat rekabeti yerine net bir niş belirleyin: günün belirli saatinde hızlı servis, ürün uzmanlığı veya çalışma deneyimi gibi ölçülebilir bir fark yaratın.' : 'Düşük/orta yoğunluğu ilk müşteri kazanımı için kullanın; açılış teklifini tekrar ziyaret ve sadakat programıyla bağlayın.',
    `İlk 90 gün için en az ₺${workingCapital.toLocaleString('tr-TR')} likit tampon ayırın; haftalık olarak sepet ortalaması, brüt marj ve günlük işlem sayısını planla karşılaştırın.`
  ];
  document.querySelector('#plan-actions').innerHTML = actions.map(action => `<li>${escapeHtml(action)}</li>`).join('');
}

function renderLocationMap(business, location, places, stats) {
  const frame = document.querySelector('#location-map');
  frame.src = `https://www.google.com/maps?q=${encodeURIComponent(`${business} ${location}`)}&output=embed`;
  document.querySelector('#map-location').textContent = `${location} çevresinde ${business} için canlı görünüm`;
  document.querySelector('#map-density').textContent = `%${stats.density}`;
  document.querySelector('#map-rating').textContent = stats.averageRating ? `${stats.averageRating.toFixed(1)} / 5` : '—';
  document.querySelector('#map-business-count').textContent = places.length.toLocaleString('tr-TR');
  const list = document.querySelector('#map-businesses');
  list.innerHTML = '';
  places.slice(0, 5).forEach((place, index) => {
    const item = document.createElement('article');
    item.className = 'map-business';
    item.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(place.title || place.name || 'İsimsiz işletme')}</strong><small>${escapeHtml(place.address || place.type || 'Yakın çevre')}</small></div><b>${place.rating || '—'}<small>/5</small></b>`;
    list.append(item);
  });
}

function makeReport(payload, business, location, finance) {
  const places = payload.local_results || payload.place_results || [];
  if (!places.length) throw new Error('Bu arama için Google Maps sonucu bulunamadı. Daha geniş bir konum veya farklı bir işletme tipi deneyin.');
  const {ratings, openCount, averageRating, reviewTotal, reviewAverage, score, density} = summarize(places);
  const label = score >= 70 ? 'Güçlü fırsat' : score >= 48 ? 'Seçici fırsat' : 'Yoğun rekabet';
  document.querySelector('#report-title').textContent = `${business} · ${location}`;
  document.querySelector('#data-source').textContent = payload.demo ? '· DEMO VERİSİ' : '· CANLI SERPAPI VERİSİ';
  document.querySelector('#report-date').textContent = new Date().toLocaleDateString('tr-TR', {day:'numeric', month:'long', year:'numeric'}) + ' tarihinde oluşturuldu';
  document.querySelector('#opportunity-score').textContent = score;
  document.querySelector('#opportunity-label').textContent = label;
  document.querySelector('#opportunity-text').textContent = `${places.length} yerel sonuç içinden; rekabet yoğunluğu, hizmet kalitesi boşluğu ve yorum sinyalleri birlikte değerlendirildi.`;
  const metrics = [
    ['Görünen rakip', places.length, 'Google Maps listesi'],
    ['Harita yoğunluğu', `%${density}`, `${densityLabel(density)} yoğunluk`],
    ['Ort. puan', averageRating ? averageRating.toFixed(1) + ' / 5' : '—', plural(ratings.length, 'puanlı sonuç', 'puanlı sonuç')],
    ['Toplam yorum', reviewTotal.toLocaleString('tr-TR'), 'talep göstergesi'],
    ['Açık görünen', `%${Math.round(openCount / places.length * 100)}`, 'anlık durum verisi']
  ];
  const metricGrid = document.querySelector('#metrics'); metricGrid.innerHTML = '';
  metrics.forEach(([name, value, note]) => { const el=document.querySelector('#metric-template').content.cloneNode(true); el.querySelector('p').textContent=name;el.querySelector('strong').textContent=value;el.querySelector('small').textContent=note;metricGrid.append(el); });
  document.querySelector('#competition-insight').textContent = `Google Maps yoğunluk endeksi %${density} (${densityLabel(density)}). ${places.length} işletme görünür durumda. ${density >= 65 ? 'Pazar kalabalık; net bir farklılaşma gerekli.' : 'Liste yoğunluğu sınırlı; konum araştırması için olumlu bir başlangıç.'}`;
  document.querySelector('#customer-insight').textContent = `Ortalama puan ${averageRating ? averageRating.toFixed(1) : 'mevcut değil'} ve işletme başına yaklaşık ${Math.round(reviewAverage).toLocaleString('tr-TR')} yorum var. ${averageRating && averageRating < 4.3 ? 'Hizmet kalitesinde iyileştirme için açık alan görünüyor.' : 'Müşteri beklentisi yüksek; deneyim kalitesi kritik.'}`;
  document.querySelector('#recommendation').textContent = score >= 60 ? 'Konumun yaya trafiğini ve kira düzeyini doğrulayın; zayıf yorumlarda tekrar eden sorunları teklifinizle çözün.' : 'Girmeden önce mikro-konum, özgün menü/hizmet ve fiyat avantajını doğrulayacak kısa saha çalışması yapın.';
  const list = document.querySelector('#result-list'); list.innerHTML = '';
  const featured = selectFeatured(places, business, location);
  if (!featured.length) featured.push(...places.slice(0, 8));
  activeReport = { business, location, score, density, averageRating, reviewTotal, places: featured, finance };
  const titleInput = document.querySelector('#feasibility-title');
  if (titleInput && !titleInput.value) titleInput.value = `${location.split(',')[0]} ${business}`;
  renderLocationMap(business, location, featured, {density, averageRating});
  featured.forEach(place => { const row=document.createElement('div');row.className='result'; const state=place.open_state || 'Durum bilinmiyor'; const score = place.comparisonScore ? `<small class="match">Uyum ${place.comparisonScore}/100</small>` : ''; row.innerHTML=`<strong>${escapeHtml(place.title || place.name || 'İsimsiz işletme')} ${score}</strong><span class="rating">★ ${place.rating || '—'} <small>(${num(place.reviews).toLocaleString('tr-TR')})</small></span><span>${escapeHtml(place.address || place.type || '')}</span><span class="${/açık|open/i.test(state)?'open':'closed'}">${escapeHtml(state)}</span>`;list.append(row); });
  renderConcepts(payload.concept_analysis, location);
  renderBusinessPlan({density}, business, finance);
}
function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
form.addEventListener('submit', async (event) => {
  event.preventDefault(); const button=form.querySelector('button'); const business=form.business.value.trim(), location=form.location.value.trim(), concepts=form.concepts.value.trim(), radius=form.radius.value; const finance={rent:num(form.rent.value),fixedCosts:num(form.fixedCosts.value),ticket:num(form.ticket.value),margin:num(form.margin.value)};
  button.disabled=true;button.textContent='Analiz hazırlanıyor…';
  status.textContent=''; status.className='form-status';
  try { if (!finance.ticket || !finance.margin) throw new Error('Finansal varsayımlarda sepet tutarı ve brüt marj sıfır olamaz.'); const res=await fetch(`/api/search?${new URLSearchParams({business,location,concepts,radius})}`); const payload=await res.json(); if(!res.ok) throw new Error(payload.error || 'Arama başarısız oldu.'); makeReport(payload,business,location,finance); status.textContent=payload.demo ? 'Demo raporu hazır. Canlı veriler için SERPAPI_KEY ekleyin.' : 'Canlı SerpAPI raporu adres metni ile hazır.'; status.classList.add('success'); empty.hidden=true;report.hidden=false;report.scrollIntoView({behavior:'smooth',block:'start'}); }
  catch(err){status.textContent=err.message;status.classList.remove('success')} finally {button.disabled=false;button.innerHTML='Pazarı analiz et <span>→</span>'}
});
document.querySelector('#export-button').addEventListener('click',()=>window.print());
document.querySelector('#save-report-button').addEventListener('click', async () => {
  const saveStatus = document.querySelector('#save-status');
  const user = await SerpMeAuth.currentUser();
  if (!user) { window.location.href = '/login.html'; return; }
  if (!activeReport) { saveStatus.textContent = 'Önce bir pazar analizi oluşturun.'; return; }
  const title = document.querySelector('#feasibility-title').value.trim() || `${activeReport.location} ${activeReport.business}`;
  const stage = document.querySelector('#feasibility-stage').value;
  const notes = document.querySelector('#feasibility-notes').value.trim();
  try {
    saveStatus.textContent = 'Portföye kaydediliyor…';
    const idea = await SerpMeAuth.supabaseFetch('/rest/v1/ideas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ owner_id: user.id, title, concept: activeReport.business, location: activeReport.location, stage, notes }) });
    await SerpMeAuth.supabaseFetch('/rest/v1/reports', { method: 'POST', body: JSON.stringify({ owner_id: user.id, idea_id: idea[0].id, business: activeReport.business, location: activeReport.location, opportunity_score: activeReport.score, density: activeReport.density, average_rating: activeReport.averageRating || null, total_reviews: activeReport.reviewTotal, feasibility: { title, stage, notes }, report_payload: { places: activeReport.places, finance: activeReport.finance } }) });
    saveStatus.textContent = 'Analiz ve fizibilite notu portföyünüze kaydedildi.'; saveStatus.classList.add('success');
  } catch (error) { saveStatus.textContent = error.message; saveStatus.classList.remove('success'); }
});
