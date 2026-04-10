import { getUser, signIn, signUp, signOut, onAuthChange } from '../auth.js';
import { supabase } from '../supabase.js';
import { showModal } from './modal.js';

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
    document.getElementById('authSignIn')?.addEventListener('click', showAuthModal);
  } else {
    const name = user.user_metadata?.full_name || user.email || '';
    slot.innerHTML = `
      <div class="auth-user">
        <span class="auth-name">${name.split('@')[0]}</span>
        <button class="btn auth-login" id="authSignOut">Out</button>
      </div>
    `;
    document.getElementById('authSignOut')?.addEventListener('click', signOut);
  }
}

function showAuthModal() {
  showModal({
    title: 'Sign In',
    fields: [
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'text', required: true },
    ],
    onSave: async (v) => {
      // Try sign in first, then sign up if user doesn't exist
      let result = await signIn(v.email, v.password);
      if (result.error && result.error.includes('Invalid login')) {
        if (confirm('Account not found. Create a new account?')) {
          result = await signUp(v.email, v.password);
          if (result.error) alert(result.error);
        }
      } else if (result.error) {
        alert(result.error);
      }
    },
  });
}
