import { supabase } from './supabase.js';
import { getUser, isEditor } from './auth.js';

let _debounceTimer = null;
const DEBOUNCE_MS = 2000;
let _suppressSync = false;

// Shared room ID — everyone reads/writes the same board
const SHARED_ROOM = 'shared';

export function suppressSync(val) { _suppressSync = val; }

export function syncToCloud(state) {
  if (!supabase || !getUser() || !isEditor() || _suppressSync) return;
  clearTimeout(_debounceTimer);
  const snapshot = JSON.stringify(state);
  _debounceTimer = setTimeout(() => _doSync(snapshot), DEBOUNCE_MS);
}

async function _doSync(stateJson) {
  const user = getUser();
  if (!user || !supabase || !isEditor()) return;
  try {
    const { error } = await supabase.from('war_rooms').upsert({
      user_id: user.id,
      name: SHARED_ROOM,
      state: JSON.parse(stateJson),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,name' });
    if (error) console.warn('Cloud sync error:', error.message);
  } catch (e) {
    console.warn('Cloud sync failed:', e);
  }
}

export async function loadFromCloud() {
  if (!supabase || !getUser()) return null;
  try {
    // Load from any editor's shared room (get the latest)
    const { data, error } = await supabase
      .from('war_rooms')
      .select('state, updated_at')
      .eq('name', SHARED_ROOM)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') console.warn('Cloud load error:', error.message);
    return data;
  } catch (e) {
    return null;
  }
}

export async function forceSyncToCloud(state) {
  const user = getUser();
  if (!user || !supabase || !isEditor()) return;
  clearTimeout(_debounceTimer);
  await _doSync(JSON.stringify(state));
}
