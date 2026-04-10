import { getUser, signIn, signOut, onAuthChange } from '../auth.js';
import { supabase } from '../supabase.js';

export function initAuthUI() {
  renderAuthSlot();
  onAuthChange(() => renderAuthSlot());
}

function renderAuthSlot() {
  const slot = document.getElementById('authSlot');
  if (!slot) return;

  // No Supabase configured — hide auth entirely
  if (!supabase) { slot.innerHTML = ''; return; }

  const user = getUser();

  if (!user) {
    slot.innerHTML = `<button class="btn auth-login" id="authSignIn">Sign In</button>`;
    document.getElementById('authSignIn')?.addEventListener('click', signIn);
  } else {
    const avatar = user.user_metadata?.avatar_url || '';
    const name = user.user_metadata?.full_name || user.email || '';
    slot.innerHTML = `
      <div class="auth-user">
        ${avatar ? `<img src="${avatar}" class="auth-avatar" alt="">` : ''}
        <span class="auth-name">${name.split(' ')[0]}</span>
        <button class="btn auth-login" id="authSignOut">Out</button>
      </div>
    `;
    document.getElementById('authSignOut')?.addEventListener('click', signOut);
  }
}
