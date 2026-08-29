let portfolioUser;
const q = (path, options) => SerpMeAuth.supabaseFetch(`/rest/v1/${path}`, options);
const escapeHtml = value => { const element = document.createElement('div'); element.textContent = String(value ?? ''); return element.innerHTML; };
function empty(el, message) { const paragraph = document.createElement('p'); paragraph.className = 'portfolio-empty'; paragraph.textContent = message; el.replaceChildren(paragraph); }
async function loadPortfolio() {
  try {
    const [ideas, reports] = await Promise.all([q('ideas?select=*&order=updated_at.desc'), q('reports?select=*&order=created_at.desc')]);
    const ideaList = document.querySelector('#ideas-list'), reportList = document.querySelector('#reports-list');
    if (!ideas.length) empty(ideaList, 'Henüz fikir eklemediniz. İlk fikrinizi oluşturun.'); else ideaList.innerHTML = ideas.map(idea => `<article class="portfolio-item"><p>${escapeHtml(idea.stage)}</p><h3>${escapeHtml(idea.title)}</h3><span>${escapeHtml(idea.concept)} · ${escapeHtml(idea.location)}</span><small>${escapeHtml(idea.notes || 'Not eklenmedi')}</small></article>`).join('');
    if (!reports.length) empty(reportList, 'Henüz kayıtlı analiz yok. Bir pazar analizi tamamlayıp fizibilite adımından kaydedin.'); else reportList.innerHTML = reports.map(report => `<article class="portfolio-item report-item"><p>${escapeHtml(new Date(report.created_at).toLocaleDateString('tr-TR'))}</p><h3>${escapeHtml(report.business)}</h3><span>${escapeHtml(report.location)}</span><div><b>${Number(report.opportunity_score) || '—'}</b><small>fırsat skoru · yoğunluk %${Number(report.density) || '—'}</small></div></article>`).join('');
  } catch (error) { empty(document.querySelector('#ideas-list'), error.message); }
}
const dialog = document.querySelector('#idea-dialog');
document.querySelector('#new-idea-button').onclick = () => dialog.showModal(); document.querySelector('#dialog-close').onclick = () => dialog.close();
document.querySelector('#idea-form').addEventListener('submit', async event => { event.preventDefault(); const button = event.currentTarget.querySelector('button[type="submit"]'); button.disabled = true; try { const fields = Object.fromEntries(new FormData(event.currentTarget)); const limits = {title: 120, concept: 120, location: 200, notes: 4000}; if (Object.entries(limits).some(([key, limit]) => String(fields[key] || '').trim().length > limit)) throw new Error('Girdi uzunluğu izin verilen sınırı aşıyor.'); await q('ideas', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ ...fields, owner_id: portfolioUser.id }) }); dialog.close(); event.currentTarget.reset(); loadPortfolio(); } catch (error) { document.querySelector('#idea-status').textContent = error.message; } finally { button.disabled = false; } });
async function initializePortfolio() {
  portfolioUser = await SerpMeAuth.currentUser();
  if (!portfolioUser) { window.location.href = '/login.html'; return; }
  document.querySelector('#portfolio-user').textContent = `${portfolioUser.email} · kayıtlarınız yalnızca hesabınızdan görüntülenir.`;
  loadPortfolio();
}
initializePortfolio();
