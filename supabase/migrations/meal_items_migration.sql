-- ================================================================
-- Meal Items Refactor & DB Cleanup Migration
-- Run this in Supabase SQL Editor
-- ================================================================

-- ================================================================
-- PART 1: MEAL_LOGS - Add meal_items JSONB column
-- This replaces the old meal_name + single satisfaction approach
-- Each item: { name: string, ingredients: string[], satisfaction: number }
-- ================================================================
alter table public.meal_logs
  add column if not exists meal_items jsonb default '[]'::jsonb,
  add column if not exists meal_name text; -- Keep for legacy read (old records still have meal_name in note_text)

-- ================================================================
-- PART 2: MEAL_LOGS - Remove columns no longer needed
-- handwritten_image_url: was used for the canvas drawing feature (HybridEditor),
-- which is being removed in this refactor.
-- Safe to drop only if you have no data you want to keep.
-- Uncomment to actually drop:
-- ================================================================
-- alter table public.meal_logs drop column if exists handwritten_image_url;

-- ================================================================
-- PART 3: DAILY_SUMMARIES - Remove legacy growth_status column
-- growth_status (양호함/주의 etc.) is now calculated client-side
-- from the growth_charts table (percentile). No longer stored.
-- ================================================================
-- alter table public.daily_summaries drop column if exists growth_status;

-- ================================================================
-- PART 4: PROFILES - Remove legacy baby_* columns
-- These were moved to the new 'babies' table.
-- Only run this AFTER you have run multi_baby_migration.sql
-- and verified all baby data has migrated correctly.
-- ================================================================
-- alter table public.profiles drop column if exists baby_name;
-- alter table public.profiles drop column if exists baby_birthday;
-- alter table public.profiles drop column if exists baby_gender;

-- ================================================================
-- PART 5: PHOTO_LOGS table - Was never actually used in the UI.
-- Safe to drop if you never used it (check Supabase Table editor first).
-- ================================================================
-- drop table if exists public.photo_logs;
