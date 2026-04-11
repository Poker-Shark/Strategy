import { getUser, signIn, signOut, onAuthChange, isEditor } from '../auth.js';
import { supabase } from '../supabase.js';

export function initAuthUI() {
  renderAuthSlot();
  onAuthChange(() => renderAuthSlot());
}

function renderAuthSlot() {
  const slot = document.getElementById('authSlot');
  if (!slot) return;
  if (!supabase) { slot.innerHTML = ''; return; }

  const user = getUser();

  if (!user) {
    slot.innerHTML = `<button class="btn auth-login" id="authSignIn">Sign In</button>`;
    document.getElementById('authSignIn')?.addEventListener('click', () => {});
  } else {
    const name = user.email || '';
    const role = isEditor() ? 'Editor' : 'Viewer';
    slot.innerHTML = `
      <div class="auth-user">
        <span class="auth-name">${name.split('@')[0]}</span>
        <span style="font-size:8px;color:${isEditor() ? 'var(--radiant)' : 'var(--text3)'};text-transform:uppercase;letter-spacing:1px">${role}</span>
        <button class="btn auth-login" id="authSignOut">Out</button>
      </div>
    `;
    document.getElementById('authSignOut')?.addEventListener('click', signOut);
  }
}
