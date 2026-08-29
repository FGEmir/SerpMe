const sb = window.SERPME_SUPABASE;
const authStoreKey = 'serpme_auth_session';

function getSession() { try { return JSON.parse(localStorage.getItem(authStoreKey) || 'null'); } catch { return null; } }
function setSession(session) { session ? localStorage.setItem(authStoreKey, JSON.stringify(session)) : localStorage.removeItem(authStoreKey); }
async function supabaseFetch(path, options = {}) {
  const session = getSession();
  const headers = { apikey: sb.publishableKey, 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  const response = await fetch(`${sb.url}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || body?.error_description || 'İşlem tamamlanamadı.');
  return body;
}
async function refreshSession() {
  const session = getSession(); if (!session?.refresh_token) return null;
  try { const next = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) }); setSession(next); return next; } catch { setSession(null); return null; }
}
async function currentUser() {
  let session = getSession() || await refreshSession();
  if (!session?.access_token) return null;
  if (!session.user) {
    try { session.user = await supabaseFetch('/auth/v1/user'); setSession(session); } catch { setSession(null); return null; }
  }
  return session.user;
}
async function captureAuthRedirect() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (!hash.get('access_token')) return null;
  const session = { access_token: hash.get('access_token'), refresh_token: hash.get('refresh_token'), token_type: hash.get('token_type'), expires_in: Number(hash.get('expires_in') || 0) };
  setSession(session);
  history.replaceState({}, document.title, window.location.pathname);
  return currentUser();
}
function updateNav(user) {
  document.querySelectorAll('[data-auth-link]').forEach(link => { link.textContent = user ? 'Portföyüm' : 'Giriş'; link.href = user ? '/portfolio.html' : '/login.html'; });
  document.querySelectorAll('[data-logout]').forEach(button => { button.hidden = !user; button.onclick = () => { setSession(null); window.location.href = '/'; }; });
}
window.SerpMeAuth = { getSession, setSession, supabaseFetch, currentUser, captureAuthRedirect, updateNav };
document.addEventListener('DOMContentLoaded', async () => updateNav(await captureAuthRedirect() || await currentUser()));
