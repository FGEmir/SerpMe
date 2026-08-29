const authForm = document.querySelector('#login-form');
const authStatus = document.querySelector('#auth-status');

async function authenticate(mode) {
  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  if (!email || password.length < 6) { authStatus.textContent = 'Geçerli e-posta ve en az 6 karakterlik şifre girin.'; return; }
  try {
    authStatus.textContent = 'İşlem sürüyor…';
    const path = mode === 'signup' ? `/auth/v1/signup?redirect_to=${encodeURIComponent(`${window.location.origin}/`)}` : '/auth/v1/token?grant_type=password';
    const payload = mode === 'signup' ? { email, password, data: { display_name: email.split('@')[0] } } : { email, password };
    const result = await SerpMeAuth.supabaseFetch(path, { method: 'POST', body: JSON.stringify(payload) });
    const session = result.session || result;
    if (!session.access_token) { authStatus.textContent = 'Hesap oluşturuldu. Gelen kutunuzu ve gereksiz klasörünü kontrol edin; e-posta onayından sonra giriş yapabilirsiniz.'; return; }
    SerpMeAuth.setSession(session);
    window.location.href = '/portfolio.html';
  } catch (error) { authStatus.textContent = error.message; }
}

authForm.addEventListener('submit', event => { event.preventDefault(); authenticate('signin'); });
document.querySelector('#signup-button').addEventListener('click', () => authenticate('signup'));
