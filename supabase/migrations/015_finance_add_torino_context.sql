-- ============================================================
-- Migration 015: Add Torino finance context
-- ============================================================

ALTER TYPE finance_work_context
  ADD VALUE IF NOT EXISTS 'torino_studio';
