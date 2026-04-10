import { supabase } from './supabase.js';
import { getUser } from './auth.js';

let _debounceTimer = null;
const DEBOUNCE_MS = 2000;
let _suppressSync = false;

// Temporarily suppress cloud sync (used during cloud load to avoid write-back)
export function suppressSync(val) { _suppressSync = val; }

export function syncToCloud(state) {
  if (!supabase || !getUser() || _suppressSync) return;
  clearTimeout(_debounceTimer);
  // Snapshot state NOW, not when debounce fires
  const snapshot = JSON.stringify(state);
  _debounceTimer = setTimeout(() => _doSync(snapshot), DEBOUNCE_MS);
}

async function _doSync(stateJson) {
  const user = getUser();
  if (!user || !supabase) return;
  try {
    const { error } = await supabase.from('war_rooms').upsert({
      user_id: user.id,
      name: 'Default',
      state: JSON.parse(stateJson),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,name' });
    if (error) console.warn('Cloud sync error:', error.message);
  } catch (e) {
    console.warn('Cloud sync failed:', e);
  }
}

export async function loadFromCloud() {
  const user = getUser();
  if (!user || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('war_rooms')
      .select('state, updated_at')
      .eq('user_id', user.id)
      .eq('name', 'Default')
      .single();
    if (error && error.code !== 'PGRST116') console.warn('Cloud load error:', error.message);
    return data;
  } catch (e) {
    return null;
  }
}

// Force an immediate save (no debounce) — used on critical actions
export async function forceSyncToCloud(state) {
  const user = getUser();
  if (!user || !supabase) return;
  clearTimeout(_debounceTimer);
  await _doSync(JSON.stringify(state));
}
