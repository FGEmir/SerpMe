const authForm = document.querySelector('#login-form');
const authStatus = document.querySelector('#auth-status');

async function authenticate(mode) {
  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  if (!email || password.length < 6) { authStatus.textContent = 'Geçerli e-posta ve en az 6 karakterlik şifre girin.'; return; }
  try {
    authStatus.textContent = 'İşlem sürüyor…';
    const path = mode === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
    const payload = mode === 'signup' ? { email, password, data: { display_name: email.split('@')[0] }, options: { emailRedirectTo: `${window.location.origin}/portfolio.html` } } : { email, password };
    const result = await SerpMeAuth.supabaseFetch(path, { method: 'POST', body: JSON.stringify(payload) });
    const session = result.session || result;
    if (!session.access_token) { authStatus.textContent = 'Hesap oluşturuldu. E-postanızdaki onay bağlantısını açın; ardından giriş yapabilirsiniz.'; return; }
    SerpMeAuth.setSession(session);
    window.location.href = '/portfolio.html';
  } catch (error) { authStatus.textContent = error.message; }
}

authForm.addEventListener('submit', event => { event.preventDefault(); authenticate('signin'); });
document.querySelector('#signup-button').addEventListener('click', () => authenticate('signup'));
