import { supabase } from './supabase.js';

let _user = null;
const _listeners = [];

export function getUser() { return _user; }

export async function signIn() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  _user = null;
  _notify();
}

export function onAuthChange(cb) {
  _listeners.push(cb);
}

function _notify() {
  _listeners.forEach(cb => cb(_user));
}

export async function initAuth() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  _user = data.session?.user || null;
  _notify();

  supabase.auth.onAuthStateChange((_event, session) => {
    _user = session?.user || null;
    _notify();
  });
}
