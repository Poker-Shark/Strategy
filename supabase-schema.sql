-- Poker Shark Strategy War Room — Supabase Schema
-- Run this in the Supabase SQL editor

-- ═══════════════════════════════════════════════════
-- STEP 1: Create the war_rooms table
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS war_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default',
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE war_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own rooms"
  ON war_rooms FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_war_rooms_user ON war_rooms(user_id);

-- ═══════════════════════════════════════════════════
-- STEP 2: Login tracking
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS login_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  email TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT now(),
  ip TEXT
);

ALTER TABLE login_log ENABLE ROW LEVEL SECURITY;

-- Only the service role can read login logs (not the anon key)
CREATE POLICY "Service role only" ON login_log FOR ALL USING (false);

-- Auto-log on every sign-in via a trigger on auth.sessions
CREATE OR REPLACE FUNCTION log_user_login()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO login_log (user_id, email)
  SELECT NEW.user_id, u.email
  FROM auth.users u WHERE u.id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_session_created ON auth.sessions;
CREATE TRIGGER on_auth_session_created
  AFTER INSERT ON auth.sessions
  FOR EACH ROW EXECUTE FUNCTION log_user_login();

-- ═══════════════════════════════════════════════════
-- STEP 3: Create the 4 authorized users
-- Run these one at a time if batch fails
-- ═══════════════════════════════════════════════════

-- NOTE: After running this SQL, go to Supabase Dashboard:
-- Authentication → Settings → Turn OFF "Enable Sign Up"
-- This prevents anyone else from creating accounts.

SELECT supabase_admin.create_user(
  '{"email": "jack@pokrshark.com", "password": "PStrategyRoom123", "email_confirm": true}'
);

SELECT supabase_admin.create_user(
  '{"email": "yihchun@pokrshark.com", "password": "PStrategyRoom123", "email_confirm": true}'
);

SELECT supabase_admin.create_user(
  '{"email": "clarence@pokrshark.com", "password": "PStrategyRoom123", "email_confirm": true}'
);

SELECT supabase_admin.create_user(
  '{"email": "danielyoo220@gmail.com", "password": "PStrategyRoom123", "email_confirm": true}'
);
