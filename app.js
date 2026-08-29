const form = document.querySelector('#search-form');
const report = document.querySelector('#report');
const empty = document.querySelector('#empty-state');
const status = document.querySelector('#form-status');
let activeReport = null;
const num = (value) => Number(String(value || 0).replace(/[^\d.]/g, '')) || 0;
const plural = (n, single, many) => `${n.toLocaleString('tr-TR')} ${n === 1 ? single : many}`;
if (window.location.protocol === 'file:') {
  status.textContent = 'Open the app through http://localhost:8000 for a live report.';
}

function summarize(places) {
  const ratings = places.map(x => Number(x.rating)).filter(Boolean);
  const reviews = places.map(x => num(x.reviews));
  const openCount = places.filter(x => /açık|open/i.test(x.open_state || x.hours || '')).length;
  const averageRating = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0;
  const reviewTotal = reviews.reduce((a,b)=>a+b,0);
  const reviewAverage = places.length ? reviewTotal / places.length : 0;
  const saturation = Math.min(100, places.length * 5);
  const qualityGap = Math.max(0, Math.min(100, (5 - averageRating) * 45));
  const demand = Math.min(100, Math.log10(reviewAverage + 1) * 38);
  const score = Math.round(Math.max(18, Math.min(94, 45 + qualityGap * .45 + demand * .22 - saturation * .22)));
  const density = Math.round(Math.min(100, (places.length / 20) * 48 + Math.log10(reviewAverage + 1) * 11 + (places.length ? openCount / places.length : 0) * 15));
  return { ratings, reviews, openCount, averageRating, reviewTotal, reviewAverage, score, density };
}
function densityLabel(density) { return density >= 65 ? 'high' : density >= 38 ? 'moderate' : 'low'; }
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
  if (!ranked.length) { list.textContent = 'Add candidate concepts to receive a comparison-based recommendation.'; return; }
  ranked.forEach((item, index) => {
    const el = document.createElement('div'); el.className = 'concept';
    const verdict = index === 0 ? 'Recommended concept' : item.density >= 65 ? 'High competition' : 'Alternative option';
    const examples = item.matches.slice(0, 2).map(place => place.title).join(' · ');
    el.innerHTML = `<span class="concept-rank">${index + 1}</span><span><strong>${escapeHtml(item.name)}</strong><small>${verdict} · ${item.matches.length} uyumlu işletme · ${item.density}% yoğunluk</small></span><span><small>${item.reviewTotal.toLocaleString('tr-TR')} yorum · ${item.averageRating ? item.averageRating.toFixed(1) : '—'} puan<br>${escapeHtml(examples)}</small></span><span class="concept-score">${item.score}<small>/100</small></span>`;
    list.append(el);
  });
}
function financeProfile(business) {
  const term = normalize(business);
  if (/restoran|lokanta|burger|pizza|kebap|doner/.test(term)) return {ticket: 520, margin: 58, dailyBase: 72, label: 'servis restoranı'};
  if (/kahve|kafe|cafe|brunch|pastane|tatli|bakery/.test(term)) return {ticket: 280, margin: 64, dailyBase: 58, label: 'kafe / hızlı servis'};
  if (/market|magaza|perakende|butik/.test(term)) return {ticket: 650, margin: 43, dailyBase: 42, label: 'perakende'};
  if (/spor|fitness|gym/.test(term)) return {ticket: 850, margin: 60, dailyBase: 28, label: 'üyelik / spor'};
  return {ticket: 350, margin: 55, dailyBase: 48, label: 'genel hizmet / perakende'};
}

function resolveFinance(business, finance, analysis) {
  const mode = document.querySelector('input[name="financeMode"]:checked')?.value || 'manual';
  if (mode === 'manual') return {...finance, source: 'User assumptions', confidence: 'more reliable once rent and operating-cost quotes are entered'};
  const profile = financeProfile(business);
  const marketFactor = .62 + (analysis.components.demand / 100) * .42 + (analysis.components.accessibility / 100) * .14;
  const dailyTransactions = Math.max(20, Math.round(profile.dailyBase * marketFactor));
  const monthlyRevenue = dailyTransactions * profile.ticket * 30;
  // Bunlar konuma ait kira verisi değildir; yalnızca ilk senaryo için işletme oranlarıdır.
  const suggested = {
    ticket: profile.ticket,
    margin: profile.margin,
    rent: Math.round(monthlyRevenue * .10 / 1000) * 1000,
    fixedCosts: Math.round((monthlyRevenue * .20 + 25000) / 1000) * 1000,
    source: `Automatic starting scenario · ${profile.label}`,
    confidence: 'estimated — replace with local rent and payroll quotes',
    estimatedDailyTransactions: dailyTransactions,
  };
  document.querySelector('[name="rent"]').value = suggested.rent;
  document.querySelector('[name="fixedCosts"]').value = suggested.fixedCosts;
  document.querySelector('[name="ticket"]').value = suggested.ticket;
  document.querySelector('[name="margin"]').value = suggested.margin;
  return suggested;
}

function renderBusinessPlan(stats, business, finance) {
  const contribution = finance.ticket * (finance.margin / 100);
  const fixed = finance.rent + finance.fixedCosts;
  const monthlyTransactions = Math.ceil(fixed / contribution);
  const dailyTransactions = Math.ceil(monthlyTransactions / 30);
  const turnover = monthlyTransactions * finance.ticket;
  const workingCapital = fixed * 3;
  const densityRisk = stats.density >= 65 ? 'yüksek rekabet' : stats.density >= 38 ? 'kontrollü rekabet' : 'düşük rekabet';
  document.querySelector('#plan-summary').textContent = `${business} için pazar ${densityRisk} gösteriyor. ${finance.source} ile ₺${finance.ticket.toLocaleString('tr-TR')} ortalama sepet ve %${finance.margin} brüt marj kullanıldı; güven düzeyi: ${finance.confidence}.`;
  const values = [
    ['Günlük başa baş', `${dailyTransactions} işlem`, '30 gün varsayımı'],
    ['Aylık başa baş ciro', `₺${Math.round(turnover).toLocaleString('tr-TR')}`, 'KDV/vergi hariç'],
    ['Aylık sabit yük', `₺${fixed.toLocaleString('tr-TR')}`, finance.source.startsWith('Otomatik') ? 'senaryo tahmini' : 'kira + sabit gider'],
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

const COMPONENT_LABELS = {
  demand: 'Demand', commercial_activity: 'Commercial activity', target_customer_presence: 'Target customer presence',
  accessibility: 'Accessibility', competition_gap: 'Competition gap', neighbor_market_signal: 'Neighbour market signal',
  location_compatibility: 'Location compatibility'
};
const MODE_LABELS = { demand_validation: 'Demand Validation Mode', early_market: 'Early Market Analysis', competition: 'Competition Analysis' };
const PROXY_LABELS = { commercial_activity: 'Restaurants · retail · grocery', target_customer_presence: 'Schools · offices · hotels · fitness', accessibility: 'Public transport', indirect_demand: 'Indirect demand businesses' };

function renderViability(analysis) {
  document.querySelector('#analysis-mode').textContent = MODE_LABELS[analysis.mode] || analysis.mode;
  document.querySelector('#data-confidence').textContent = `Data confidence: ${analysis.confidence.level} · ${analysis.confidence.score}%`;
  document.querySelector('#viability-components').innerHTML = Object.entries(analysis.components).map(([key, value]) => {
    const weight = Math.round((analysis.weights[key] || 0) * 100);
    return `<article><div><span>${escapeHtml(COMPONENT_LABELS[key] || key)}</span><b>%${weight}</b></div><strong>${value}<small>/100</small></strong><i><em style="width:${value}%"></em></i></article>`;
  }).join('');
  document.querySelector('#neighbor-signal').textContent = `${analysis.components.neighbor_market_signal}/100`;
  document.querySelector('#radius-ladder').innerHTML = Object.entries(analysis.neighbor_market.radius_counts).map(([radius, count]) => `<span><b>${Number(radius) / 1000 < 1 ? radius + ' m' : Number(radius) / 1000 + ' km'}</b>${count} işletme</span>`).join('');
  const proxyEntries = Object.entries(analysis.proxy_counts || {});
  document.querySelector('#proxy-summary').textContent = `${proxyEntries.reduce((sum, [, count]) => sum + count, 0)} visible signals`;
  document.querySelector('#proxy-list').innerHTML = proxyEntries.map(([key, count]) => `<span><b>${escapeHtml(PROXY_LABELS[key] || key)}</b>${count} sonuç</span>`).join('');
  document.querySelector('#viability-reasons').innerHTML = analysis.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('');
  document.querySelector('#viability-limitations').textContent = `Limits: ${analysis.limitations.join(' ')}`;
  const method = analysis.evaluation_method;
  const methodPanel = document.querySelector('#evaluation-method');
  if (method) {
    methodPanel.hidden = false;
    document.querySelector('#evaluation-method-title').textContent = method.title;
    document.querySelector('#evaluation-method-summary').textContent = method.summary;
    document.querySelector('#evaluation-method-steps').innerHTML = (method.steps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('');
  } else methodPanel.hidden = true;
}

function renderLocationMap(business, location, places, stats) {
  const frame = document.querySelector('#location-map');
  frame.src = `https://www.google.com/maps?q=${encodeURIComponent(`${business} ${location}`)}&output=embed`;
  document.querySelector('#map-location').textContent = `Live view for ${business} around ${location}`;
  document.querySelector('#map-density').textContent = `%${stats.density}`;
  document.querySelector('#map-rating').textContent = stats.averageRating ? `${stats.averageRating.toFixed(1)} / 5` : '—';
  document.querySelector('#map-business-count').textContent = places.length.toLocaleString('tr-TR');
  const list = document.querySelector('#map-businesses');
  list.innerHTML = '';
  places.slice(0, 5).forEach((place, index) => {
    const item = document.createElement('article');
    item.className = 'map-business';
    const rating = Number(place.rating);
    item.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><div><strong>${escapeHtml(place.title || place.name || 'Unnamed business')}</strong><small>${escapeHtml(place.address || place.type || 'Nearby area')}</small></div><b>${Number.isFinite(rating) && rating >= 0 && rating <= 5 ? rating.toFixed(1) : '—'}<small>/5</small></b>`;
    list.append(item);
  });
}

function makeReport(payload, business, location, finance) {
  const places = payload.local_results || payload.place_results || [];
  const {ratings, openCount, averageRating, reviewTotal, reviewAverage, density} = summarize(places);
  const analysis = payload.market_analysis;
  if (!analysis) throw new Error('Pazar uygulanabilirlik verisi oluşturulamadı.');
  finance = resolveFinance(business, finance, analysis);
  const score = analysis.score;
  const label = analysis.classification;
  document.querySelector('#report-title').textContent = `${business} · ${location}`;
  document.querySelector('#data-source').textContent = payload.demo ? '· DEMO VERİSİ' : '· CANLI SERPAPI VERİSİ';
  document.querySelector('#report-date').textContent = new Date().toLocaleDateString('tr-TR', {day:'numeric', month:'long', year:'numeric'}) + ' tarihinde oluşturuldu';
  document.querySelector('#opportunity-score').textContent = score;
  document.querySelector('#opportunity-label').textContent = label;
  document.querySelector('#opportunity-text').textContent = analysis.evaluation_method?.id === 'catchment_proxy_validation'
    ? 'Doğrudan emsal yetersiz olduğu için değerlendirme, çevresel talep sinyalleri ve doğrulama adımlarıyla yapıldı.'
    : `${places.length} doğrudan sonuç ile çevresel talep proxy'leri birlikte değerlendirildi.`;
  renderViability(analysis);
  const metrics = [
    ['Görünen rakip', places.length, 'Google Maps listesi'],
    ['Harita yoğunluğu', `%${density}`, `${densityLabel(density)} yoğunluk`],
    ['Ort. puan', averageRating ? averageRating.toFixed(1) + ' / 5' : '—', plural(ratings.length, 'puanlı sonuç', 'puanlı sonuç')],
    ['Toplam yorum', reviewTotal.toLocaleString('tr-TR'), 'talep göstergesi'],
    ['Açık görünen', places.length ? `%${Math.round(openCount / places.length * 100)}` : '—', 'anlık durum verisi']
  ];
  const metricGrid = document.querySelector('#metrics'); metricGrid.innerHTML = '';
  metrics.forEach(([name, value, note]) => { const el=document.querySelector('#metric-template').content.cloneNode(true); el.querySelector('p').textContent=name;el.querySelector('strong').textContent=value;el.querySelector('small').textContent=note;metricGrid.append(el); });
  document.querySelector('#competition-insight').textContent = `Google Maps yoğunluk endeksi %${density} (${densityLabel(density)}). ${places.length} işletme görünür durumda. ${places.length <= 2 ? 'Rakip azlığı fırsat sayılmadı; talep doğrulama sinyalleri öne alındı.' : density >= 65 ? 'Pazar kalabalık; net bir farklılaşma gerekli.' : 'Pazar erken aşamada; saha doğrulaması gerekli.'}`;
  document.querySelector('#customer-insight').textContent = `Ortalama puan ${averageRating ? averageRating.toFixed(1) : 'mevcut değil'} ve işletme başına yaklaşık ${Math.round(reviewAverage).toLocaleString('tr-TR')} yorum var. ${averageRating && averageRating < 4.3 ? 'Hizmet kalitesinde iyileştirme için açık alan görünüyor.' : 'Müşteri beklentisi yüksek; deneyim kalitesi kritik.'}`;
  document.querySelector('#recommendation').textContent = analysis.mode === 'demand_validation' ? 'En az iki farklı zaman diliminde yaya sayımı, kısa müşteri görüşmeleri ve düşük maliyetli talep testi yapmadan yatırım kararı vermeyin.' : score >= 60 ? 'Konumun yaya trafiğini ve kira düzeyini doğrulayın; zayıf yorumlarda tekrar eden sorunları teklifinizle çözün.' : 'Mikro-konum, özgün teklif ve fiyat avantajını doğrulayacak kısa saha çalışması yapın.';
  const list = document.querySelector('#result-list'); list.innerHTML = '';
  const featured = selectFeatured(places, business, location);
  if (!featured.length) featured.push(...places.slice(0, 8));
  activeReport = { business, location, score, density, averageRating, reviewTotal, places: featured, finance, analysis, proxyResults: payload.proxy_results || {}, directByRadius: payload.direct_by_radius || {} };
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
    await SerpMeAuth.supabaseFetch('/rest/v1/reports', { method: 'POST', body: JSON.stringify({ owner_id: user.id, idea_id: idea[0].id, business: activeReport.business, location: activeReport.location, opportunity_score: activeReport.score, market_viability_score: activeReport.score, analysis_mode: activeReport.analysis.mode, viability_classification: activeReport.analysis.classification, data_confidence: activeReport.analysis.confidence, viability_components: activeReport.analysis.components, density: activeReport.density, average_rating: activeReport.averageRating || null, total_reviews: activeReport.reviewTotal, feasibility: { title, stage, notes }, report_payload: { places: activeReport.places, finance: activeReport.finance, market_analysis: activeReport.analysis, proxy_results: activeReport.proxyResults, direct_by_radius: activeReport.directByRadius } }) });
    saveStatus.textContent = 'Analiz ve fizibilite notu portföyünüze kaydedildi.'; saveStatus.classList.add('success');
  } catch (error) { saveStatus.textContent = error.message; saveStatus.classList.remove('success'); }
});
