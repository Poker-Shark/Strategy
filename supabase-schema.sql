-- Poker Shark Strategy War Room — Supabase Schema
-- Run this in the Supabase SQL editor after creating your project

CREATE TABLE war_rooms (
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

-- Index for fast lookups
CREATE INDEX idx_war_rooms_user ON war_rooms(user_id);
