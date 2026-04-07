// ── Shared frontend auth helper ──────────────────────────────────────────────
// Included on every page. Checks session via /api/auth/me, updates nav,
// and provides signOut().

(async function initAuth() {
  try {
    const res  = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
      clearLocalUser();
      return;
    }
    const { user } = await res.json();
    // Keep localStorage in sync for pages that still read it for UI
    localStorage.setItem('aiq_user', JSON.stringify(user));
    updateNav(user);
  } catch (e) {
    // Server unreachable — fall back to localStorage for nav UI only
    const stored = getLocalUser();
    if (stored) updateNav(stored);
  }
})();

function getLocalUser() {
  try { return JSON.parse(localStorage.getItem('aiq_user')); } catch { return null; }
}
function clearLocalUser() {
  localStorage.removeItem('aiq_user');
}

function updateNav(user) {
  // Hide "Start here" / CTA buttons
  const startBtn = document.getElementById('nav-start-btn');
  if (startBtn) startBtn.style.display = 'none';

  const mobCta = document.getElementById('mob-nav-cta');
  if (mobCta) mobCta.style.display = 'none';

  // Show avatar
  const avatar = document.getElementById('nav-avatar');
  if (avatar) {
    avatar.style.display = 'flex';
    avatar.href = '/account';
    if (user.picture) {
      avatar.innerHTML = `<img src="${user.picture}" alt="${user.name || 'Account'}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">`;
    } else {
      const initials = (user.name || user.email || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
      avatar.textContent = initials;
    }
  }
}

async function signOut() {
  try {
    await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
  } catch (e) { /* continue even if request fails */ }
  clearLocalUser();
  window.location.href = '/';
}
