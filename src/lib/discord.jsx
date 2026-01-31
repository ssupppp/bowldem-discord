import { DiscordSDK } from '@discord/embedded-app-sdk';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Singleton SDK instance - created once at module level
const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

// Context for Discord state
const DiscordContext = createContext(null);

/**
 * Discord Provider Component
 * Handles SDK initialization, OAuth flow, and provides Discord context to the app
 */
export function DiscordProvider({ children }) {
  const [status, setStatus] = useState('pending'); // pending, ready, authenticated, error
  const [user, setUser] = useState(null);
  const [guildId, setGuildId] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      try {
        // Step 1: Wait for Discord client connection
        await discordSdk.ready();

        if (!mounted) return;

        setChannelId(discordSdk.channelId);
        setGuildId(discordSdk.guildId);
        setStatus('ready');

        // Step 2: Request authorization (opens OAuth modal in Discord)
        const { code } = await discordSdk.commands.authorize({
          client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
          response_type: 'code',
          state: '',
          prompt: 'none',
          scope: ['identify', 'guilds'],
        });

        if (!mounted) return;

        // Step 3: Exchange code for token via our backend
        const tokenResponse = await fetch('/.proxy/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!tokenResponse.ok) {
          throw new Error('Token exchange failed');
        }

        const { access_token } = await tokenResponse.json();

        // Step 4: Authenticate with Discord using the token
        const auth = await discordSdk.commands.authenticate({ access_token });

        if (!mounted) return;

        setUser(auth.user);
        setStatus('authenticated');

        // Step 5: Get initial participants in the activity
        try {
          const { participants: initialParticipants } =
            await discordSdk.commands.getInstanceConnectedParticipants();
          setParticipants(initialParticipants);
        } catch (e) {
          // Participants API may not be available in all contexts
          console.warn('Could not get participants:', e);
        }

        // Subscribe to participant updates
        discordSdk.subscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE', (data) => {
          if (mounted) {
            setParticipants(data.participants);
          }
        });

      } catch (e) {
        console.error('Discord setup failed:', e);
        if (mounted) {
          setError(e);
          setStatus('error');
        }
      }
    }

    setup();

    return () => {
      mounted = false;
      // Cleanup subscriptions
      try {
        discordSdk.unsubscribe('ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE');
      } catch (e) {
        // Ignore unsubscribe errors
      }
    };
  }, []);

  // Open Discord invite dialog
  const openInvite = useCallback(async () => {
    try {
      await discordSdk.commands.openInviteDialog();
    } catch (e) {
      console.error('Failed to open invite dialog:', e);
    }
  }, []);

  // Open external link (goes through Discord)
  const openExternalLink = useCallback(async (url) => {
    try {
      await discordSdk.commands.openExternalLink({ url });
    } catch (e) {
      console.error('Failed to open external link:', e);
    }
  }, []);

  // Close the activity
  const closeActivity = useCallback((code = 1000, message = 'User closed') => {
    discordSdk.close(code, message);
  }, []);

  const value = {
    discordSdk,
    status,
    user,
    guildId,
    channelId,
    participants,
    error,
    openInvite,
    openExternalLink,
    closeActivity,
  };

  // Show loading screen during setup
  if (status === 'pending' || status === 'ready') {
    return (
      <div className="discord-loading">
        <div className="discord-loading-content">
          <div className="discord-spinner"></div>
          <p>Connecting to Discord...</p>
        </div>
        <style>{`
          .discord-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #1e3a8a;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .discord-loading-content {
            text-align: center;
          }
          .discord-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            margin: 0 auto 16px;
            animation: discord-spin 1s linear infinite;
          }
          @keyframes discord-spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show error screen if setup failed
  if (status === 'error') {
    return (
      <div className="discord-error">
        <div className="discord-error-content">
          <h2>Connection Failed</h2>
          <p>{error?.message || 'Unable to connect to Discord'}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
        <style>{`
          .discord-error {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #1e3a8a;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .discord-error-content {
            text-align: center;
            padding: 24px;
          }
          .discord-error h2 {
            margin: 0 0 12px;
          }
          .discord-error p {
            margin: 0 0 20px;
            opacity: 0.8;
          }
          .discord-error button {
            background: white;
            color: #1e3a8a;
            border: none;
            padding: 10px 24px;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
          }
          .discord-error button:hover {
            opacity: 0.9;
          }
        `}</style>
      </div>
    );
  }

  return (
    <DiscordContext.Provider value={value}>
      {children}
    </DiscordContext.Provider>
  );
}

/**
 * Hook to access Discord context
 * Must be used within DiscordProvider
 */
export function useDiscord() {
  const context = useContext(DiscordContext);
  if (!context) {
    throw new Error('useDiscord must be used within DiscordProvider');
  }
  return context;
}

/**
 * Get Discord avatar URL for a user
 */
export function getDiscordAvatarUrl(userId, avatarHash, size = 64) {
  if (!avatarHash) {
    // Default avatar based on user ID
    const defaultIndex = (BigInt(userId) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  }
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
}

/**
 * Export the SDK instance for direct access if needed
 */
export { discordSdk };
