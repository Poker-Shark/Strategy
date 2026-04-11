-- Poker Shark Strategy War Room — Supabase Schema
-- Run this in the Supabase SQL editor

-- ═══════════════════════════════════════════════════
-- STEP 1: War rooms table (skip if already exists)
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

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Users manage own rooms" ON war_rooms;

-- New policies: editors can write their own rows, everyone can read all shared rooms
CREATE POLICY "Anyone can read shared rooms"
  ON war_rooms FOR SELECT
  USING (name = 'shared');

CREATE POLICY "Editors can write own rooms"
  ON war_rooms FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Editors can update own rooms"
  ON war_rooms FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_war_rooms_user ON war_rooms(user_id);

-- ═══════════════════════════════════════════════════
-- NOTE: User creation is done manually in the
-- Supabase Dashboard → Authentication → Users
-- After creating users, turn OFF "Enable Sign Up"
-- ═══════════════════════════════════════════════════
