-- Migration: Add Discord columns to leaderboard_entries
-- Run this on your Supabase database before deploying the Discord Activity

-- Add Discord-specific columns
ALTER TABLE leaderboard_entries
ADD COLUMN IF NOT EXISTS discord_user_id TEXT,
ADD COLUMN IF NOT EXISTS discord_username TEXT,
ADD COLUMN IF NOT EXISTS discord_avatar TEXT,
ADD COLUMN IF NOT EXISTS guild_id TEXT;

-- Create index for Discord user lookups
CREATE INDEX IF NOT EXISTS idx_leaderboard_discord_user
ON leaderboard_entries(discord_user_id, puzzle_date);

-- Create index for guild-specific leaderboards
CREATE INDEX IF NOT EXISTS idx_leaderboard_guild
ON leaderboard_entries(guild_id, puzzle_date, won, guesses_used, created_at);

-- Create unique constraint to prevent duplicate submissions per Discord user per puzzle
-- This allows the same Discord user to submit once per puzzle
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_discord_unique
ON leaderboard_entries(discord_user_id, puzzle_date)
WHERE discord_user_id IS NOT NULL;

-- Note: Keep device_id column for backwards compatibility
-- Discord Activity users will have discord_user_id set
-- Legacy web users will continue using device_id
