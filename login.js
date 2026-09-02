const authForm = document.querySelector('#login-form');
const authStatus = document.querySelector('#auth-status');

async function authenticate(mode) {
  const email = document.querySelector('#auth-email').value.trim();
  const password = document.querySelector('#auth-password').value;
  if (!email || password.length < 6) { authStatus.textContent = 'Enter a valid email address and a password with at least 6 characters.'; return; }
  try {
    authStatus.textContent = 'Please wait…';
    // A direct file preview has a null origin, so confirmation must return to the live site.
    const appOrigin = window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://serpme.online';
    const path = mode === 'signup' ? `/auth/v1/signup?redirect_to=${encodeURIComponent(`${appOrigin}/`)}` : '/auth/v1/token?grant_type=password';
    const payload = mode === 'signup' ? { email, password, data: { display_name: email.split('@')[0] } } : { email, password };
    const result = await SerpMeAuth.supabaseFetch(path, { method: 'POST', body: JSON.stringify(payload) });
    const session = result.session || result;
    if (!session.access_token) { authStatus.textContent = 'Account created. Check your inbox and spam folder, then log in after confirming your email.'; return; }
    SerpMeAuth.setSession(session);
    window.location.href = new URL('portfolio.html', window.location.href).href;
  } catch (error) {
    authStatus.textContent = error.message || 'Connection failed. Check your internet connection and try again.';
  }
}

authForm.addEventListener('submit', event => { event.preventDefault(); authenticate('signin'); });
document.querySelector('#signup-button').addEventListener('click', () => authenticate('signup'));
