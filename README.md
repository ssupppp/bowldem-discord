# Bowldem - Discord Activity

A cricket-themed Wordle game as a Discord Activity. Guess the Man of the Match from historic cricket matches!

## Features

- **Daily Puzzles**: New puzzle every day based on real cricket matches
- **Discord Integration**: Uses Discord identity (username, avatar)
- **Leaderboards**: Guild-specific and global leaderboards
- **Archive Mode**: Play past puzzles
- **Rich Feedback**: PTRM system (Played, Team, Role, Match) for guesses

## Prerequisites

- Node.js 18+
- Discord Application with Activities enabled
- Supabase project (for leaderboard data)
- Vercel account (for deployment)

## Setup

### 1. Discord Developer Portal

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application (or use existing)
3. Go to **OAuth2** section:
   - Add redirect URI: `https://your-vercel-domain.vercel.app`
4. Go to **Activities** section:
   - Enable Activities
   - Add URL Mapping for your Vercel domain
5. Copy your **Client ID** and **Client Secret**

### 2. Environment Variables

Create a `.env.local` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Discord Configuration (Client-side)
VITE_DISCORD_CLIENT_ID=your-discord-client-id
```

For Vercel deployment, also add these in the Vercel dashboard:
- `DISCORD_CLIENT_ID` - Same as above
- `DISCORD_CLIENT_SECRET` - From Discord Developer Portal

### 3. Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Add Discord-specific columns
ALTER TABLE leaderboard_entries
ADD COLUMN IF NOT EXISTS discord_user_id TEXT,
ADD COLUMN IF NOT EXISTS discord_username TEXT,
ADD COLUMN IF NOT EXISTS discord_avatar TEXT,
ADD COLUMN IF NOT EXISTS guild_id TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leaderboard_discord_user
ON leaderboard_entries(discord_user_id, puzzle_date);

CREATE INDEX IF NOT EXISTS idx_leaderboard_guild
ON leaderboard_entries(guild_id, puzzle_date, won, guesses_used, created_at);

-- Unique constraint for Discord users
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_discord_unique
ON leaderboard_entries(discord_user_id, puzzle_date)
WHERE discord_user_id IS NOT NULL;
```

Or run the migration file: `supabase/migrations/001_add_discord_columns.sql`

### 4. Install Dependencies

```bash
npm install
```

### 5. Local Development

For local testing with Discord, you need a tunnel:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start cloudflared tunnel
cloudflared tunnel --url http://localhost:5173
```

Then add the tunnel URL to your Discord Developer Portal URL Mappings.

## Deployment

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

### Configure Discord URL Mapping

In Discord Developer Portal > Activities > URL Mappings:

| Prefix | Target |
|--------|--------|
| `/` | `your-app.vercel.app` |

## Project Structure

```
bowldem-discord/
├── api/
│   └── token.js          # OAuth token exchange endpoint
├── src/
│   ├── components/       # React components
│   ├── hooks/            # Custom hooks
│   ├── lib/
│   │   ├── discord.jsx   # Discord SDK integration
│   │   └── supabase.js   # Database client
│   ├── data/             # Puzzle data
│   ├── utils/            # Utilities
│   ├── App.jsx           # Main app component
│   └── index.jsx         # Entry point
├── supabase/
│   └── migrations/       # Database migrations
├── vercel.json           # Vercel config with CSP headers
└── vite.config.js        # Vite configuration
```

## How It Works

1. **SDK Initialization**: Discord SDK initializes and establishes connection
2. **OAuth Flow**: User authorizes, token exchanged via `/api/token.js`
3. **Authentication**: SDK authenticates with access token
4. **Game Play**: User plays the daily puzzle
5. **Leaderboard**: Results saved with Discord identity and guild ID

## Leaderboard Modes

- **Guild Mode**: Shows only players from the current Discord server
- **Global Mode**: Shows all players across all servers

Toggle between modes using the Server/Global buttons.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Related

- [Bowldem Web Version](https://github.com/ssupppp/bowldem) - Standalone web version
- [Discord Embedded App SDK](https://discord.com/developers/docs/activities/overview)

## License

MIT
