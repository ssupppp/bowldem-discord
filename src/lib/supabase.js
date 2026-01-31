import { createClient } from '@supabase/supabase-js';

// Detect if running as Discord Activity (proxied environment)
const isDiscordActivity = typeof window !== 'undefined' &&
  (window.location.hostname.includes('discordsays.com') ||
   window.location.search.includes('frame_id='));

// Use proxied URL in Discord Activity, direct URL otherwise
const supabaseUrl = isDiscordActivity
  ? '/.proxy/supabase'
  : import.meta.env.VITE_SUPABASE_URL;

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Conditionally create client
let supabase = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase disabled - missing environment variables');
}

export { supabase };

/**
 * Get today's puzzle (safe - doesn't expose answer)
 */
export async function getTodaysPuzzle() {
  if (!supabase) return null;

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('public_puzzles')
    .select('*')
    .eq('puzzle_date', today)
    .single();

  if (error) {
    console.error('Error fetching puzzle:', error);
    return null;
  }

  return data;
}

/**
 * Get puzzle by date (safe - doesn't expose answer)
 */
export async function getPuzzleByDate(date) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('public_puzzles')
    .select('*')
    .eq('puzzle_date', date)
    .single();

  if (error) {
    console.error('Error fetching puzzle:', error);
    return null;
  }

  return data;
}

/**
 * Get all players (for autocomplete)
 */
export async function getAllPlayers() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('players')
    .select('id, full_name, country, role')
    .order('full_name');

  if (error) {
    console.error('Error fetching players:', error);
    return [];
  }

  return data;
}

/**
 * Validate a guess (server-side validation via RPC)
 * Returns feedback without exposing the answer
 */
export async function validateGuess(puzzleId, guessedPlayerId) {
  if (!supabase) return null;

  const { data, error } = await supabase.rpc('validate_guess', {
    p_puzzle_id: puzzleId,
    p_guessed_player_id: guessedPlayerId
  });

  if (error) {
    console.error('Error validating guess:', error);
    return null;
  }

  return data;
}

/**
 * Get archive puzzles (past puzzles only)
 */
export async function getArchivePuzzles() {
  if (!supabase) return [];

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('public_puzzles')
    .select('id, puzzle_date, puzzle_number')
    .lt('puzzle_date', today)
    .order('puzzle_date', { ascending: false });

  if (error) {
    console.error('Error fetching archive puzzles:', error);
    return [];
  }

  return data;
}

// ============================================================================
// LEADERBOARD FUNCTIONS (Discord-specific)
// ============================================================================

/**
 * Get leaderboard entries for a specific puzzle date
 * @param {string} puzzleDate - Date in YYYY-MM-DD format
 * @param {string|null} guildId - Discord guild ID for filtering (null for global)
 * @returns {Array} - Leaderboard entries sorted by performance
 */
export async function getLeaderboardForPuzzle(puzzleDate, guildId = null) {
  if (!supabase) return [];

  let query = supabase
    .from('leaderboard_entries')
    .select('*')
    .eq('puzzle_date', puzzleDate)
    .order('guesses_used', { ascending: true })
    .order('created_at', { ascending: true });

  // Filter by guild if provided
  if (guildId) {
    query = query.eq('guild_id', guildId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all-time leaderboard (aggregated stats per player)
 * @param {string|null} guildId - Discord guild ID for filtering (null for global)
 * @returns {Array} - Players with total wins and games played
 */
export async function getAllTimeLeaderboard(guildId = null) {
  if (!supabase) return [];

  let query = supabase
    .from('leaderboard_entries')
    .select('discord_username, discord_user_id, discord_avatar, won, guesses_used')
    .eq('is_seed', false);

  if (guildId) {
    query = query.eq('guild_id', guildId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all-time leaderboard:', error);
    return [];
  }

  // Aggregate on client side by Discord user ID
  const playerStats = {};
  (data || []).forEach(entry => {
    const id = entry.discord_user_id;
    if (!id) return;

    if (!playerStats[id]) {
      playerStats[id] = {
        discord_user_id: id,
        discord_username: entry.discord_username,
        discord_avatar: entry.discord_avatar,
        games_played: 0,
        total_wins: 0,
        total_guesses: 0
      };
    }
    playerStats[id].games_played++;
    if (entry.won) {
      playerStats[id].total_wins++;
      playerStats[id].total_guesses += entry.guesses_used;
    }
  });

  // Convert to array and sort by wins, then by average guesses
  return Object.values(playerStats)
    .sort((a, b) => {
      if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
      const avgA = a.total_wins > 0 ? a.total_guesses / a.total_wins : 5;
      const avgB = b.total_wins > 0 ? b.total_guesses / b.total_wins : 5;
      return avgA - avgB;
    });
}

/**
 * Submit a new leaderboard entry with Discord identity
 * @param {Object} entry - Leaderboard entry data with Discord info
 * @returns {Object} - { success: boolean, data?: any, error?: string }
 */
export async function submitLeaderboardEntry(entry) {
  if (!supabase) return { success: false, error: 'Supabase not configured' };

  // Check if Discord user already submitted for this puzzle
  const { data: existing } = await supabase
    .from('leaderboard_entries')
    .select('id')
    .eq('puzzle_date', entry.puzzle_date)
    .eq('discord_user_id', entry.discord_user_id)
    .single();

  if (existing) {
    return { success: false, error: 'Already submitted for this puzzle', duplicate: true };
  }

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .insert([{
      puzzle_date: entry.puzzle_date,
      puzzle_number: entry.puzzle_number,
      discord_user_id: entry.discord_user_id,
      discord_username: entry.discord_username,
      discord_avatar: entry.discord_avatar,
      guild_id: entry.guild_id,
      display_name: entry.discord_username, // For backwards compatibility
      guesses_used: entry.guesses_used,
      won: entry.won,
      is_seed: false
    }])
    .select()
    .single();

  if (error) {
    console.error('Error submitting leaderboard entry:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data };
}

/**
 * Get user's ranking for a specific puzzle
 * @param {string} puzzleDate - Date in YYYY-MM-DD format
 * @param {string} discordUserId - Discord user ID
 * @param {string|null} guildId - Guild ID for guild-specific ranking
 * @returns {number|null} - User's rank or null if not found
 */
export async function getUserRanking(puzzleDate, discordUserId, guildId = null) {
  if (!supabase) return null;

  let query = supabase
    .from('leaderboard_entries')
    .select('id, discord_user_id, guesses_used, won, created_at')
    .eq('puzzle_date', puzzleDate)
    .order('guesses_used', { ascending: true })
    .order('created_at', { ascending: true });

  if (guildId) {
    query = query.eq('guild_id', guildId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return null;
  }

  const index = data.findIndex(entry => entry.discord_user_id === discordUserId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Check if Discord user has already submitted for a puzzle
 * @param {string} puzzleDate - Date in YYYY-MM-DD format
 * @param {string} discordUserId - Discord user ID
 * @returns {boolean} - True if already submitted
 */
export async function hasUserSubmitted(puzzleDate, discordUserId) {
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('id')
    .eq('puzzle_date', puzzleDate)
    .eq('discord_user_id', discordUserId)
    .single();

  return !error && !!data;
}

/**
 * Get entries by Discord user ID (for historical stats)
 * @param {string} discordUserId - Discord user ID
 * @returns {Array} - Array of leaderboard entries
 */
export async function getEntriesByDiscordUser(discordUserId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('leaderboard_entries')
    .select('*')
    .eq('discord_user_id', discordUserId)
    .order('puzzle_date', { ascending: false });

  if (error) {
    console.error('Error fetching entries by Discord user:', error);
    return [];
  }

  return data || [];
}
