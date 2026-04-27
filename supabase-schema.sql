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

-- Drop old policies so this script is idempotent
DROP POLICY IF EXISTS "Users manage own rooms" ON war_rooms;
DROP POLICY IF EXISTS "Anyone can read shared rooms" ON war_rooms;
DROP POLICY IF EXISTS "Editors can write own rooms" ON war_rooms;
DROP POLICY IF EXISTS "Editors can update own rooms" ON war_rooms;

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

-- ═══════════════════════════════════════════════════
-- STEP 2: Treasury — transactions, revenue, vendor rules
-- Poker Shark LLC bookkeeping. Editor-only writes.
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  vendor TEXT NOT NULL,
  raw_description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  card TEXT NOT NULL,                                 -- '8789' | '2757' | '7326'
  category TEXT NOT NULL DEFAULT 'other_expense',
  type TEXT NOT NULL DEFAULT 'purchase',              -- purchase|payment|credit|fee|interest
  business_pct INTEGER NOT NULL DEFAULT 100,
  notes TEXT DEFAULT '',
  reviewed BOOLEAN NOT NULL DEFAULT false,
  flagged BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'pdf',                 -- pdf|csv|manual|seed
  reimbursable BOOLEAN NOT NULL DEFAULT false,        -- set client-side: card != '8789'
  dedup_hash TEXT NOT NULL UNIQUE,                    -- set client-side: date|amount|desc[:30]|card
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_tx_date ON treasury_transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_category ON treasury_transactions(category);
CREATE INDEX IF NOT EXISTS idx_treasury_tx_card ON treasury_transactions(card);

CREATE TABLE IF NOT EXISTS treasury_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'app_revenue',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_treasury_rev_date ON treasury_revenue(date DESC);

CREATE TABLE IF NOT EXISTS treasury_vendor_rules (
  pattern TEXT PRIMARY KEY,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE treasury_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE treasury_vendor_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authed users read treasury tx" ON treasury_transactions;
DROP POLICY IF EXISTS "Authed users read treasury rev" ON treasury_revenue;
DROP POLICY IF EXISTS "Authed users read treasury rules" ON treasury_vendor_rules;
DROP POLICY IF EXISTS "Jack writes treasury tx" ON treasury_transactions;
DROP POLICY IF EXISTS "Jack writes treasury rev" ON treasury_revenue;
DROP POLICY IF EXISTS "Jack writes treasury rules" ON treasury_vendor_rules;

CREATE POLICY "Authed users read treasury tx"
  ON treasury_transactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authed users read treasury rev"
  ON treasury_revenue FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authed users read treasury rules"
  ON treasury_vendor_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Jack writes treasury tx"
  ON treasury_transactions FOR ALL
  USING ((auth.jwt() ->> 'email') = 'jack@pokrshark.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jack@pokrshark.com');

CREATE POLICY "Jack writes treasury rev"
  ON treasury_revenue FOR ALL
  USING ((auth.jwt() ->> 'email') = 'jack@pokrshark.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jack@pokrshark.com');

CREATE POLICY "Jack writes treasury rules"
  ON treasury_vendor_rules FOR ALL
  USING ((auth.jwt() ->> 'email') = 'jack@pokrshark.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'jack@pokrshark.com');
