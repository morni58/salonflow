-- Migration 006: Add description column to services table
-- Run in Supabase SQL Editor

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN services.description IS 'Detailed description shown on the website service card';
