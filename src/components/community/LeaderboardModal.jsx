/**
 * LeaderboardModal Component (Discord Version)
 * Displays puzzle leaderboard and all-time leaderboard
 * Supports guild-specific and global views
 */

import React, { useState, useEffect } from 'react';
import { getLeaderboardForPuzzle, getAllTimeLeaderboard } from '../../lib/supabase.js';
import { getDiscordAvatarUrl } from '../../lib/discord.jsx';

/**
 * LeaderboardModal - Shows puzzle + all-time leaderboards
 * @param {Object} props
 * @param {number} props.puzzleNumber - Current puzzle number
 * @param {string} props.puzzleDate - Current puzzle date (YYYY-MM-DD)
 * @param {Function} props.onClose - Close handler
 * @param {number} props.guessesUsed - Number of guesses used
 * @param {boolean} props.won - Whether user won
 * @param {boolean} props.gameCompleted - Whether game is completed
 * @param {string} props.leaderboardMode - 'guild' or 'global'
 * @param {Function} props.onToggleLeaderboardMode - Toggle handler
 * @param {string} props.guildId - Discord guild ID
 */
export function LeaderboardModal({
  puzzleNumber,
  puzzleDate,
  onClose,
  guessesUsed,
  won,
  gameCompleted,
  leaderboardMode = 'guild',
  onToggleLeaderboardMode,
  guildId
}) {
  const [activeTab, setActiveTab] = useState('today'); // 'today' or 'allTime'
  const [puzzleLeaderboard, setPuzzleLeaderboard] = useState([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch leaderboards
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const queryGuildId = leaderboardMode === 'guild' ? guildId : null;

      const [puzzleData, allTimeData] = await Promise.all([
        getLeaderboardForPuzzle(puzzleDate, queryGuildId),
        getAllTimeLeaderboard(queryGuildId)
      ]);

      setPuzzleLeaderboard(puzzleData || []);
      setAllTimeLeaderboard(allTimeData || []);
      setLoading(false);
    }

    fetchData();
  }, [puzzleDate, leaderboardMode, guildId]);

  // Format time for display
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="leaderboard-modal">
      <div className="modal-header">
        <h2 className="overlay-title">Leaderboard</h2>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      {/* Guild/Global Toggle */}
      {guildId && (
        <div className="leaderboard-scope-toggle">
          <button
            className={`scope-btn ${leaderboardMode === 'guild' ? 'active' : ''}`}
            onClick={() => leaderboardMode !== 'guild' && onToggleLeaderboardMode?.()}
          >
            This Server
          </button>
          <button
            className={`scope-btn ${leaderboardMode === 'global' ? 'active' : ''}`}
            onClick={() => leaderboardMode !== 'global' && onToggleLeaderboardMode?.()}
          >
            Global
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="leaderboard-tabs">
        <button
          className={`leaderboard-tab ${activeTab === 'today' ? 'active' : ''}`}
          onClick={() => setActiveTab('today')}
        >
          Today #{puzzleNumber}
        </button>
        <button
          className={`leaderboard-tab ${activeTab === 'allTime' ? 'active' : ''}`}
          onClick={() => setActiveTab('allTime')}
        >
          All Time
        </button>
      </div>

      {/* Today's Leaderboard */}
      {activeTab === 'today' && (
        <div className="leaderboard-content">
          {loading ? (
            <div className="leaderboard-loading">Loading...</div>
          ) : puzzleLeaderboard.filter(e => e.won).length === 0 ? (
            <div className="leaderboard-empty">
              <div className="empty-icon">🏆</div>
              <p>No winners yet!</p>
              <p className="empty-hint">Be the first to solve today's puzzle</p>
            </div>
          ) : (
            <>
              {/* Leaderboard list - WINNERS ONLY */}
              <div className="leaderboard-list">
                {puzzleLeaderboard
                  .filter(entry => entry.won)
                  .sort((a, b) => {
                    if (a.guesses_used !== b.guesses_used) return a.guesses_used - b.guesses_used;
                    return new Date(a.created_at) - new Date(b.created_at);
                  })
                  .slice(0, 20)
                  .map((entry, index) => (
                    <div
                      key={entry.id || index}
                      className={`leaderboard-entry ${index < 3 ? 'top-three' : ''}`}
                    >
                      <span className="entry-rank">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && `${index + 1}.`}
                      </span>
                      {entry.discord_avatar && (
                        <img
                          className="entry-avatar"
                          src={getDiscordAvatarUrl(entry.discord_user_id, entry.discord_avatar, 32)}
                          alt=""
                        />
                      )}
                      <span className="entry-name">
                        {entry.discord_username || entry.display_name}
                      </span>
                      <span className="entry-result">
                        <span className="guesses-badge win">
                          {entry.guesses_used}/4
                        </span>
                      </span>
                      <span className="entry-time">{formatTime(entry.created_at)}</span>
                    </div>
                  ))}
              </div>

              {/* Stats summary - winners only */}
              <div className="leaderboard-stats">
                <div className="stat-item">
                  <span className="stat-value">
                    {puzzleLeaderboard.filter(e => e.won).length}
                  </span>
                  <span className="stat-label">Winners</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">
                    {puzzleLeaderboard.filter(e => e.won).length > 0
                      ? (puzzleLeaderboard.filter(e => e.won).reduce((sum, e) => sum + e.guesses_used, 0) /
                          puzzleLeaderboard.filter(e => e.won).length).toFixed(1)
                      : '-'}
                  </span>
                  <span className="stat-label">Avg Guesses</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* All-Time Leaderboard */}
      {activeTab === 'allTime' && (
        <div className="leaderboard-content">
          {loading ? (
            <div className="leaderboard-loading">Loading...</div>
          ) : allTimeLeaderboard.length === 0 ? (
            <div className="leaderboard-empty">
              <div className="empty-icon">🌟</div>
              <p>No all-time stats yet!</p>
              <p className="empty-hint">Play more puzzles to see rankings</p>
            </div>
          ) : (
            <div className="leaderboard-list">
              {allTimeLeaderboard.slice(0, 20).map((entry, index) => (
                <div
                  key={entry.discord_user_id || index}
                  className={`leaderboard-entry ${index < 3 ? 'top-three' : ''}`}
                >
                  <span className="entry-rank">
                    {index === 0 && '🥇'}
                    {index === 1 && '🥈'}
                    {index === 2 && '🥉'}
                    {index > 2 && `${index + 1}.`}
                  </span>
                  {entry.discord_avatar && (
                    <img
                      className="entry-avatar"
                      src={getDiscordAvatarUrl(entry.discord_user_id, entry.discord_avatar, 32)}
                      alt=""
                    />
                  )}
                  <span className="entry-name">{entry.discord_username}</span>
                  <span className="entry-stats">
                    <span className="wins-badge">{entry.total_wins}W</span>
                    <span className="games-badge">{entry.games_played}G</span>
                  </span>
                  <span className="entry-winrate">
                    {entry.games_played > 0
                      ? Math.round((entry.total_wins / entry.games_played) * 100)
                      : 0}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="modal-buttons">
        <button className="btn-enhanced btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * LeaderboardPreview - Compact view for end-game modal
 * Shows Top 3 + 2 entries surrounding user's rank
 */
export function LeaderboardPreview({
  entries = [],
  userRanking,
  totalPlayers,
  displayName,
  onViewFull,
  leaderboardMode,
  onToggleLeaderboardMode,
  guildId
}) {
  if (entries.length === 0) {
    return (
      <div className="leaderboard-preview">
        <div className="preview-header">
          <span className="preview-title">Today's Top Players</span>
        </div>
        <div className="preview-empty">Be the first on the leaderboard!</div>
        {onViewFull && (
          <button className="preview-view-all" onClick={onViewFull}>
            View Leaderboard
          </button>
        )}
      </div>
    );
  }

  // Filter to only show winners and sort
  const winners = entries
    .filter(e => e.won)
    .sort((a, b) => {
      if (a.guesses_used !== b.guesses_used) return a.guesses_used - b.guesses_used;
      return new Date(a.created_at) - new Date(b.created_at);
    });

  // Get top 3
  const top3 = winners.slice(0, 3);

  // Get surrounding entries if user is ranked > 3
  let surrounding = [];
  let showDivider = false;

  if (userRanking && userRanking > 3) {
    showDivider = true;
    const startIdx = Math.max(3, userRanking - 2);
    const endIdx = Math.min(winners.length, userRanking + 1);
    surrounding = winners.slice(startIdx - 1, endIdx);
  }

  const getRankEmoji = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}.`;
  };

  return (
    <div className="leaderboard-preview">
      <div className="preview-header">
        <span className="preview-title">
          {leaderboardMode === 'guild' ? 'Server Top Players' : 'Global Top Players'}
        </span>
        {totalPlayers > 0 && (
          <span className="preview-count">{totalPlayers} playing</span>
        )}
      </div>

      {/* Guild/Global toggle */}
      {guildId && onToggleLeaderboardMode && (
        <div className="preview-scope-toggle">
          <button
            className={`scope-btn-mini ${leaderboardMode === 'guild' ? 'active' : ''}`}
            onClick={() => leaderboardMode !== 'guild' && onToggleLeaderboardMode()}
          >
            Server
          </button>
          <button
            className={`scope-btn-mini ${leaderboardMode === 'global' ? 'active' : ''}`}
            onClick={() => leaderboardMode !== 'global' && onToggleLeaderboardMode()}
          >
            Global
          </button>
        </div>
      )}

      <div className="preview-list">
        {top3.map((entry, index) => (
          <div
            key={entry.id || index}
            className={`preview-entry ${(entry.discord_username || entry.display_name) === displayName ? 'is-user' : ''}`}
          >
            <span className="preview-rank">{getRankEmoji(index)}</span>
            {entry.discord_avatar && (
              <img
                className="preview-avatar"
                src={getDiscordAvatarUrl(entry.discord_user_id, entry.discord_avatar, 24)}
                alt=""
              />
            )}
            <span className="preview-name">{entry.discord_username || entry.display_name}</span>
            <span className="preview-result">{entry.guesses_used}/4</span>
          </div>
        ))}

        {showDivider && surrounding.length > 0 && (
          <>
            <div className="preview-divider">• • •</div>
            {surrounding.map((entry, idx) => {
              const actualRank = winners.indexOf(entry);
              return (
                <div
                  key={entry.id || `surrounding-${idx}`}
                  className={`preview-entry ${(entry.discord_username || entry.display_name) === displayName ? 'is-user' : ''}`}
                >
                  <span className="preview-rank">{actualRank + 1}.</span>
                  {entry.discord_avatar && (
                    <img
                      className="preview-avatar"
                      src={getDiscordAvatarUrl(entry.discord_user_id, entry.discord_avatar, 24)}
                      alt=""
                    />
                  )}
                  <span className="preview-name">{entry.discord_username || entry.display_name}</span>
                  <span className="preview-result">{entry.guesses_used}/4</span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {userRanking && !showDivider && (
        <div className="preview-user-rank">
          You're #{userRanking} of {totalPlayers}
        </div>
      )}

      {onViewFull && (
        <button className="preview-view-all" onClick={onViewFull}>
          View Full Leaderboard
        </button>
      )}
    </div>
  );
}

export default LeaderboardModal;
