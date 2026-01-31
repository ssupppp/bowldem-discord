/**
 * useLeaderboard Hook (Discord Version)
 * Manages leaderboard data fetching and submission
 * Uses Discord user identity instead of device ID
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getLeaderboardForPuzzle,
  getAllTimeLeaderboard,
  submitLeaderboardEntry,
  getUserRanking,
  getEntriesByDiscordUser
} from '../lib/supabase.js';
import { getDiscordAvatarUrl } from '../lib/discord.jsx';

/**
 * Custom hook for managing leaderboard data with Discord identity
 * @param {number} puzzleNumber - Current puzzle number
 * @param {string} puzzleDate - Current puzzle date (YYYY-MM-DD)
 * @param {string} discordUserId - Discord user ID
 * @param {string} discordUsername - Discord username
 * @param {string} guildId - Discord guild ID (null for DMs)
 * @param {string} leaderboardMode - 'guild' or 'global'
 * @returns {Object} - Leaderboard state and actions
 */
export function useLeaderboard(
  puzzleNumber,
  puzzleDate,
  discordUserId,
  discordUsername,
  guildId = null,
  leaderboardMode = 'guild'
) {
  // State for puzzle leaderboard
  const [puzzleLeaderboard, setPuzzleLeaderboard] = useState([]);
  const [puzzleLeaderboardLoading, setPuzzleLeaderboardLoading] = useState(false);

  // State for all-time leaderboard
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState([]);
  const [allTimeLoading, setAllTimeLoading] = useState(false);

  // User's ranking for today's puzzle
  const [userRanking, setUserRanking] = useState(null);

  // Historical entries for the user
  const [historicalEntries, setHistoricalEntries] = useState([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Error state
  const [error, setError] = useState(null);

  /**
   * Get guild ID for query based on mode
   */
  const queryGuildId = leaderboardMode === 'guild' ? guildId : null;

  /**
   * Fetch puzzle leaderboard
   */
  const fetchPuzzleLeaderboard = useCallback(async () => {
    if (!puzzleDate) return;

    setPuzzleLeaderboardLoading(true);
    setError(null);

    try {
      const data = await getLeaderboardForPuzzle(puzzleDate, queryGuildId);
      setPuzzleLeaderboard(data || []);
    } catch (err) {
      console.error('Error fetching puzzle leaderboard:', err);
      setError('Failed to load leaderboard');
      setPuzzleLeaderboard([]);
    } finally {
      setPuzzleLeaderboardLoading(false);
    }
  }, [puzzleDate, queryGuildId]);

  /**
   * Fetch all-time leaderboard
   */
  const fetchAllTimeLeaderboard = useCallback(async () => {
    setAllTimeLoading(true);
    setError(null);

    try {
      const data = await getAllTimeLeaderboard(queryGuildId);
      setAllTimeLeaderboard(data || []);
    } catch (err) {
      console.error('Error fetching all-time leaderboard:', err);
      setError('Failed to load all-time leaderboard');
      setAllTimeLeaderboard([]);
    } finally {
      setAllTimeLoading(false);
    }
  }, [queryGuildId]);

  /**
   * Submit entry to leaderboard with Discord identity
   */
  const submitToLeaderboard = useCallback(async (guessesUsed, won) => {
    if (!discordUserId || !puzzleDate || isSubmitting || hasSubmitted) {
      return { success: false, error: 'Invalid submission state' };
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const entry = {
        discord_user_id: discordUserId,
        discord_username: discordUsername,
        discord_avatar: null, // Avatar hash would come from Discord user object
        guild_id: guildId,
        puzzle_date: puzzleDate,
        puzzle_number: puzzleNumber,
        guesses_used: won ? guessesUsed : 5, // 5 represents a loss
        won: won
      };

      const result = await submitLeaderboardEntry(entry);

      if (result.success) {
        setHasSubmitted(true);
        // Refresh leaderboard to show new entry
        await fetchPuzzleLeaderboard();
        // Get user's ranking
        const ranking = await getUserRanking(puzzleDate, discordUserId, queryGuildId);
        setUserRanking(ranking);
      }

      return result;
    } catch (err) {
      console.error('Error submitting to leaderboard:', err);
      setError('Failed to submit to leaderboard');
      return { success: false, error: err.message };
    } finally {
      setIsSubmitting(false);
    }
  }, [discordUserId, discordUsername, guildId, puzzleDate, puzzleNumber, isSubmitting, hasSubmitted, fetchPuzzleLeaderboard, queryGuildId]);

  /**
   * Calculate percentile based on leaderboard position
   */
  const calculatePercentile = useCallback((guessesUsed, won) => {
    if (puzzleLeaderboard.length === 0) return null;

    // Count how many did better
    let betterCount = 0;
    for (const entry of puzzleLeaderboard) {
      if (entry.won && !won) {
        betterCount++;
      } else if (entry.won && won && entry.guesses_used < guessesUsed) {
        betterCount++;
      }
    }

    const percentile = Math.round(((puzzleLeaderboard.length - betterCount) / puzzleLeaderboard.length) * 100);
    return percentile;
  }, [puzzleLeaderboard]);

  /**
   * Get top N entries from puzzle leaderboard
   */
  const getTopEntries = useCallback((n = 5) => {
    return puzzleLeaderboard
      .filter(entry => entry.won)
      .sort((a, b) => {
        // Sort by guesses_used (ascending), then by created_at (ascending)
        if (a.guesses_used !== b.guesses_used) {
          return a.guesses_used - b.guesses_used;
        }
        return new Date(a.created_at) - new Date(b.created_at);
      })
      .slice(0, n);
  }, [puzzleLeaderboard]);

  /**
   * Fetch historical entries for the Discord user
   */
  const fetchHistoricalEntries = useCallback(async () => {
    if (!discordUserId) return;

    setHistoricalLoading(true);

    try {
      const entries = await getEntriesByDiscordUser(discordUserId);
      setHistoricalEntries(entries);
    } catch (err) {
      console.error('Error fetching historical entries:', err);
      setHistoricalEntries([]);
    } finally {
      setHistoricalLoading(false);
    }
  }, [discordUserId]);

  /**
   * Check if user has already submitted for today
   */
  useEffect(() => {
    if (discordUserId && puzzleLeaderboard.length > 0) {
      const existingEntry = puzzleLeaderboard.find(entry => entry.discord_user_id === discordUserId);
      if (existingEntry) {
        setHasSubmitted(true);
        setUserRanking(puzzleLeaderboard.indexOf(existingEntry) + 1);
      }
    }
  }, [puzzleLeaderboard, discordUserId]);

  // Fetch historical entries on mount
  useEffect(() => {
    if (discordUserId) {
      fetchHistoricalEntries();
    }
  }, [discordUserId]);

  return {
    // Puzzle leaderboard
    puzzleLeaderboard,
    puzzleLeaderboardLoading,
    fetchPuzzleLeaderboard,
    getTopEntries,

    // All-time leaderboard
    allTimeLeaderboard,
    allTimeLoading,
    fetchAllTimeLeaderboard,

    // User data (Discord username is used directly)
    userRanking,
    calculatePercentile,

    // Historical entries
    historicalEntries,
    historicalLoading,
    fetchHistoricalEntries,

    // Submission
    submitToLeaderboard,
    isSubmitting,
    hasSubmitted,

    // Error
    error
  };
}

export default useLeaderboard;
