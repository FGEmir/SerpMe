const form = document.querySelector('#search-form');
const report = document.querySelector('#report');
const empty = document.querySelector('#empty-state');
const status = document.querySelector('#form-status');
let activeReport = null;
const num = (value) => Number(String(value || 0).replace(/[^\d.]/g, '')) || 0;
const plural = (n, single, many) => `${n.toLocaleString('en-GB')} ${n === 1 ? single : many}`;
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
    el.innerHTML = `<span class="concept-rank">${index + 1}</span><span><strong>${escapeHtml(item.name)}</strong><small>${verdict} · ${item.matches.length} matching businesses · ${item.density}% density</small></span><span><small>${item.reviewTotal.toLocaleString('en-GB')} reviews · ${item.averageRating ? item.averageRating.toFixed(1) : '—'} rating<br>${escapeHtml(examples)}</small></span><span class="concept-score">${item.score}<small>/100</small></span>`;
    list.append(el);
  });
}
function financeProfile(business) {
  const term = normalize(business);
  if (/restoran|lokanta|restaurant|burger|pizza|kebap|doner/.test(term)) return {ticket: 520, margin: 58, dailyBase: 72, label: 'service restaurant'};
  if (/kahve|kafe|coffee|cafe|brunch|pastane|tatli|bakery/.test(term)) return {ticket: 280, margin: 64, dailyBase: 58, label: 'cafe / quick service'};
  if (/market|magaza|retail|perakende|butik/.test(term)) return {ticket: 650, margin: 43, dailyBase: 42, label: 'retail'};
  if (/spor|fitness|gym/.test(term)) return {ticket: 850, margin: 60, dailyBase: 28, label: 'membership / fitness'};
  return {ticket: 350, margin: 55, dailyBase: 48, label: 'general service / retail'};
}

function resolveFinance(business, finance, analysis) {
  const mode = document.querySelector('input[name="financeMode"]:checked')?.value || 'manual';
  if (mode === 'manual') return {...finance, source: 'User assumptions', confidence: 'more reliable once rent and operating-cost quotes are entered'};
  const profile = financeProfile(business);
  const marketFactor = .62 + (analysis.components.demand / 100) * .42 + (analysis.components.accessibility / 100) * .14;
  const dailyTransactions = Math.max(20, Math.round(profile.dailyBase * marketFactor));
  const monthlyRevenue = dailyTransactions * profile.ticket * 30;
  // These are operating ratios for an initial scenario, not rent data for the location.
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
  const densityRisk = stats.density >= 65 ? 'high competition' : stats.density >= 38 ? 'controlled competition' : 'low competition';
  document.querySelector('#plan-summary').textContent = `The market for ${business} shows ${densityRisk}. ${finance.source} uses an average transaction of ₺${finance.ticket.toLocaleString('en-GB')} and a ${finance.margin}% gross margin; confidence: ${finance.confidence}.`;
  const values = [
    ['Daily break-even', `${dailyTransactions} transactions`, '30-day assumption'],
    ['Monthly break-even revenue', `₺${Math.round(turnover).toLocaleString('en-GB')}`, 'excluding VAT/tax'],
    ['Monthly fixed load', `₺${fixed.toLocaleString('en-GB')}`, finance.source.startsWith('Automatic') ? 'scenario estimate' : 'rent + fixed costs'],
    ['Three-month working capital', `₺${workingCapital.toLocaleString('en-GB')}`, 'cash buffer']
  ];
  const grid = document.querySelector('#plan-metrics'); grid.innerHTML = values.map(([label,value,note]) => `<article><p>${label}</p><strong>${value}</strong><p>${note}</p></article>`).join('');
  const actions = [
    `Before opening, validate a target of at least ${dailyTransactions} daily transactions through footfall counts, delivery coverage, and seating capacity.`,
    stats.density >= 65 ? 'Choose a clear niche instead of competing only on price: faster service at a specific time, product expertise, or a stronger work experience.' : 'Use low or moderate density for first customer acquisition, then connect the opening offer to repeat visits and a loyalty programme.',
    `Keep at least ₺${workingCapital.toLocaleString('en-GB')} as a liquid buffer for the first 90 days and compare average transaction, gross margin, and daily transactions with the plan every week.`
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
  document.querySelector('#radius-ladder').innerHTML = Object.entries(analysis.neighbor_market.radius_counts).map(([radius, count]) => `<span><b>${Number(radius) / 1000 < 1 ? radius + ' m' : Number(radius) / 1000 + ' km'}</b>${count} businesses</span>`).join('');
  const proxyEntries = Object.entries(analysis.proxy_counts || {});
  document.querySelector('#proxy-summary').textContent = `${proxyEntries.reduce((sum, [, count]) => sum + count, 0)} visible signals`;
  document.querySelector('#proxy-list').innerHTML = proxyEntries.map(([key, count]) => `<span><b>${escapeHtml(PROXY_LABELS[key] || key)}</b>${count} results</span>`).join('');
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
  document.querySelector('#map-business-count').textContent = places.length.toLocaleString('en-GB');
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
  if (!analysis) throw new Error('Market viability data could not be created.');
  finance = resolveFinance(business, finance, analysis);
  const score = analysis.score;
  const label = analysis.classification;
  document.querySelector('#report-title').textContent = `${business} · ${location}`;
  document.querySelector('#data-source').textContent = payload.demo ? '· DEMO DATA' : '· LIVE SERPAPI DATA';
  document.querySelector('#report-date').textContent = `Created on ${new Date().toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'})}`;
  document.querySelector('#opportunity-score').textContent = score;
  document.querySelector('#opportunity-label').textContent = label;
  document.querySelector('#opportunity-text').textContent = analysis.evaluation_method?.id === 'catchment_proxy_validation'
    ? 'Direct comparables are limited, so the result uses surrounding demand signals and validation steps.'
    : `${places.length} direct results were assessed together with surrounding demand proxies.`;
  renderViability(analysis);
  const metrics = [
    ['Visible competitors', places.length, 'Google Maps list'],
    ['Map density', `${density}%`, `${densityLabel(density)} density`],
    ['Average rating', averageRating ? averageRating.toFixed(1) + ' / 5' : '—', plural(ratings.length, 'rated result', 'rated results')],
    ['Total reviews', reviewTotal.toLocaleString('en-GB'), 'demand signal'],
    ['Shown as open', places.length ? `${Math.round(openCount / places.length * 100)}%` : '—', 'current status data']
  ];
  const metricGrid = document.querySelector('#metrics'); metricGrid.innerHTML = '';
  metrics.forEach(([name, value, note]) => { const el=document.querySelector('#metric-template').content.cloneNode(true); el.querySelector('p').textContent=name;el.querySelector('strong').textContent=value;el.querySelector('small').textContent=note;metricGrid.append(el); });
  document.querySelector('#competition-insight').textContent = `Google Maps density index: ${density}% (${densityLabel(density)}). ${places.length} businesses are visible. ${places.length <= 2 ? 'Few competitors were not treated as an opportunity; demand validation signals are prioritised.' : density >= 65 ? 'The market is crowded; clear differentiation is required.' : 'The market is at an early stage; field validation is required.'}`;
  document.querySelector('#customer-insight').textContent = `Average rating is ${averageRating ? averageRating.toFixed(1) : 'not available'} with around ${Math.round(reviewAverage).toLocaleString('en-GB')} reviews per business. ${averageRating && averageRating < 4.3 ? 'There may be room to improve service quality.' : 'Customer expectations are high; experience quality is critical.'}`;
  document.querySelector('#recommendation').textContent = analysis.mode === 'demand_validation' ? 'Do not make an investment decision before footfall counts at different times, short customer interviews, and a low-cost demand test.' : score >= 60 ? 'Validate local footfall and rent level, then solve recurring issues found in weak reviews with your offer.' : 'Run short field research to validate the micro-location, distinct offer, and price advantage.';
  const list = document.querySelector('#result-list'); list.innerHTML = '';
  const featured = selectFeatured(places, business, location);
  if (!featured.length) featured.push(...places.slice(0, 8));
  activeReport = { business, location, score, density, averageRating, reviewTotal, places: featured, finance, analysis, proxyResults: payload.proxy_results || {}, directByRadius: payload.direct_by_radius || {} };
  const titleInput = document.querySelector('#feasibility-title');
  if (titleInput && !titleInput.value) titleInput.value = `${location.split(',')[0]} ${business}`;
  renderLocationMap(business, location, featured, {density, averageRating});
  featured.forEach(place => { const row=document.createElement('div');row.className='result'; const rawState=place.open_state || 'Status unknown'; const state=/^açık$/i.test(rawState) ? 'Open' : /^kapalı$/i.test(rawState) ? 'Closed' : rawState; const score = place.comparisonScore ? `<small class="match">Match ${place.comparisonScore}/100</small>` : ''; row.innerHTML=`<strong>${escapeHtml(place.title || place.name || 'Unnamed business')} ${score}</strong><span class="rating">★ ${place.rating || '—'} <small>(${num(place.reviews).toLocaleString('en-GB')})</small></span><span>${escapeHtml(place.address || place.type || '')}</span><span class="${/açık|open/i.test(rawState)?'open':'closed'}">${escapeHtml(state)}</span>`;list.append(row); });
  renderConcepts(payload.concept_analysis, location);
  renderBusinessPlan({density}, business, finance);
}
function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
form.addEventListener('submit', async (event) => {
  event.preventDefault(); const button=form.querySelector('button'); const business=form.business.value.trim(), location=form.location.value.trim(), concepts=form.concepts.value.trim(), radius=form.radius.value; const finance={rent:num(form.rent.value),fixedCosts:num(form.fixedCosts.value),ticket:num(form.ticket.value),margin:num(form.margin.value)};
  button.disabled=true;button.textContent='Preparing analysis…';
  status.textContent=''; status.className='form-status';
  try { if (!finance.ticket || !finance.margin) throw new Error('Average transaction value and gross margin cannot be zero.'); const res=await fetch(`/api/search?${new URLSearchParams({business,location,concepts,radius})}`); const payload=await res.json(); if(!res.ok) throw new Error(payload.error || 'Search could not be completed.'); makeReport(payload,business,location,finance); status.textContent=payload.demo ? `Demo report ready. ${payload.provider_status || 'Live data is unavailable or not configured for this environment.'}` : 'Live SerpAPI report is ready.'; status.classList.add('success'); empty.hidden=true;report.hidden=false;report.scrollIntoView({behavior:'smooth',block:'start'}); }
  catch(err){status.textContent=err.message;status.classList.remove('success')} finally {button.disabled=false;button.innerHTML='Analyze market <span>→</span>'}
});
document.querySelector('#export-button').addEventListener('click',()=>window.print());
function demandNumber(id) {
  const raw = document.querySelector(id).value.trim();
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function collectDemandValidation() {
  const searchIndex = demandNumber('#demand-search-index');
  const commitments = demandNumber('#demand-commitments');
  const commitmentTarget = demandNumber('#demand-commitment-target');
  const morning = demandNumber('#demand-footfall-morning');
  const lunch = demandNumber('#demand-footfall-lunch');
  const evening = demandNumber('#demand-footfall-evening');
  const footfallTarget = demandNumber('#demand-footfall-target');
  const footfallTotal = [morning, lunch, evening].every(value => value !== null) ? morning + lunch + evening : null;
  const complete = searchIndex !== null && commitments !== null && commitmentTarget > 0 && footfallTotal !== null && footfallTarget > 0;
  const definition = {
    target_customer: document.querySelector('#demand-customer').value.trim(),
    need_to_solve: document.querySelector('#demand-need').value.trim(),
    price_range_try: demandNumber('#demand-price'),
    sales_model: document.querySelector('#demand-model').value,
  };
  const evidence = {
    search_intent: { relative_index: searchIndex, comparison_period: document.querySelector('#demand-period').value, source: 'user_entered_google_trends_comparison' },
    paid_commitment: { actual: commitments, target: commitmentTarget },
    observed_footfall: { morning_15_min: morning, lunch_15_min: lunch, evening_15_min: evening, total: footfallTotal, threshold: footfallTarget },
  };
  if (!complete) return { definition, evidence, completeness: 'incomplete', score: null, decision: 'Evidence incomplete', note: 'Collect all three evidence types before using a validation score.' };
  const score = Math.round(searchIndex * .25 + Math.min(1, commitments / commitmentTarget) * 45 + Math.min(1, footfallTotal / footfallTarget) * 30);
  const decision = score >= 70 ? 'Validate for a limited launch' : score >= 45 ? 'Iterate and re-test' : 'Stop or redefine';
  const note = score >= 70 ? 'Evidence meets the pre-set thresholds. Keep the launch limited and track repeat purchase.' : score >= 45 ? 'Some evidence is present, but one or more thresholds need another test cycle.' : 'Current measured evidence does not support moving to an investment decision.';
  return { definition, evidence, completeness: 'complete', score, decision, note };
}
function renderDemandValidation() {
  const validation = collectDemandValidation();
  const status = document.querySelector('#demand-status');
  const result = document.querySelector('#demand-result');
  if (activeReport) activeReport.demandValidation = validation;
  if (validation.completeness !== 'complete') {
    result.hidden = true;
    status.textContent = validation.note;
    status.classList.remove('success');
    return validation;
  }
  document.querySelector('#demand-score').textContent = validation.score;
  document.querySelector('#demand-decision').textContent = validation.decision;
  document.querySelector('#demand-decision-note').textContent = validation.note;
  document.querySelector('#demand-footfall-total').textContent = validation.evidence.observed_footfall.total;
  result.hidden = false;
  status.textContent = 'Validation evidence calculated from your measured inputs.';
  status.classList.add('success');
  return validation;
}
document.querySelector('#calculate-demand').addEventListener('click', renderDemandValidation);
document.querySelector('#save-report-button').addEventListener('click', async () => {
  const saveStatus = document.querySelector('#save-status');
  const user = await SerpMeAuth.currentUser();
  if (!user) { window.location.href = '/login.html'; return; }
  if (!activeReport) { saveStatus.textContent = 'Create a market analysis first.'; return; }
  const title = document.querySelector('#feasibility-title').value.trim() || `${activeReport.location} ${activeReport.business}`;
  const stage = document.querySelector('#feasibility-stage').value;
  const notes = document.querySelector('#feasibility-notes').value.trim();
  const demandValidation = activeReport.demandValidation || collectDemandValidation();
  try {
    saveStatus.textContent = 'Saving to portfolio…';
    const idea = await SerpMeAuth.supabaseFetch('/rest/v1/ideas', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ owner_id: user.id, title, concept: activeReport.business, location: activeReport.location, stage, notes }) });
    await SerpMeAuth.supabaseFetch('/rest/v1/reports', { method: 'POST', body: JSON.stringify({ owner_id: user.id, idea_id: idea[0].id, business: activeReport.business, location: activeReport.location, opportunity_score: activeReport.score, market_viability_score: activeReport.score, analysis_mode: activeReport.analysis.mode, viability_classification: activeReport.analysis.classification, data_confidence: activeReport.analysis.confidence, viability_components: activeReport.analysis.components, density: activeReport.density, average_rating: activeReport.averageRating || null, total_reviews: activeReport.reviewTotal, feasibility: { title, stage, notes, demand_validation: demandValidation }, report_payload: { places: activeReport.places, finance: activeReport.finance, market_analysis: activeReport.analysis, proxy_results: activeReport.proxyResults, direct_by_radius: activeReport.directByRadius, demand_validation: demandValidation } }) });
    saveStatus.textContent = 'Analysis and feasibility note saved to your portfolio.'; saveStatus.classList.add('success');
  } catch (error) { saveStatus.textContent = error.message; saveStatus.classList.remove('success'); }
});
