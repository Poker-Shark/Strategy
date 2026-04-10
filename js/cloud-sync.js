import { supabase } from './supabase.js';
import { getUser } from './auth.js';

let _debounceTimer = null;
const DEBOUNCE_MS = 2000;

export function syncToCloud(state) {
  if (!supabase || !getUser()) return;
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => _doSync(state), DEBOUNCE_MS);
}

async function _doSync(state) {
  const user = getUser();
  if (!user || !supabase) return;
  try {
    await supabase.from('war_rooms').upsert({
      user_id: user.id,
      name: 'Default',
      state: state,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,name' });
  } catch (e) {
    console.warn('Cloud sync failed:', e);
  }
}

export async function loadFromCloud() {
  const user = getUser();
  if (!user || !supabase) return null;
  try {
    const { data } = await supabase
      .from('war_rooms')
      .select('state, updated_at')
      .eq('user_id', user.id)
      .eq('name', 'Default')
      .single();
    return data;
  } catch (e) {
    return null;
  }
}
