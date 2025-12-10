# Discord Always Online

Keep your Discord account's online status (green icon) active 24/7, regardless of whether you're using the desktop or mobile app.

## Features
- ** Error Notifications** - Optional Discord webhook notifications for errors
- ** Dual Mode** - Supports both external cron (default) and internal scheduling modes

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/zbcoding/discord_always_online.git
cd discord_always_online

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your Discord token

# Run with Docker Compose
docker-compose up -d

# Check status
curl http://localhost:3000
```

### Option 2: Node.js

```bash
# Clone the repository
git clone https://github.com/zbcoding/discord_always_online.git
cd discord_always_online

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your Discord token

# Start the application
npm start
```

## ⚙️ Configuration

Create a `.env` file in the project root:

```env
# Discord Account Token (REQUIRED)
TOKEN=your_discord_token_here

# Discord Webhook URLs for error notifications (OPTIONAL)
WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_url
WEBHOOK_URL_LOW=https://discord.com/api/webhooks/your_low_priority_webhook_url

# Server Configuration
PORT=3000

# Scheduling Mode
# By default, uses external cron mode (requires external service to ping the endpoint)
# Set to 'true' to enable internal scheduling (no external service needed)
# USE_INTERNAL_SCHEDULING=true
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TOKEN` | ✅ Yes | - | Your Discord user token |
| `WEBHOOK_URL` | ❌ No | - | Discord webhook for high-priority error notifications |
| `WEBHOOK_URL_LOW` | ❌ No | - | Discord webhook for low-priority error notifications |
| `PORT` | ❌ No | `3000` | Port for the health check server |
| `USE_INTERNAL_SCHEDULING` | ❌ No | `false` | Enable internal scheduling mode (no external cron needed) |

## 🔑 Getting Your Discord Token

> ⚠️ **Warning**: Your Discord token is like a password. Never share it or commit it to version control!

1. Open Discord in your web browser
2. Press `F12` to open Developer Tools
3. Go to the **Application** tab
4. In the left sidebar, expand **Local Storage** → `https://discord.com`
5. Search for `token` in the filter box
6. Copy the value (it usually starts with `Mfa.` or similar)

Alternatively:
- Go to the **Network** tab
- Filter by `/api`
- Look for the `Authorization` header in any request
- Copy the token value

## 📊 Health Check Endpoint

Visit `http://localhost:3000/` to see:
- Account status
- Current mode (Internal Scheduling / External Cron)
- Uptime
- Last reconnection time

Example response:
```
Discord Always Online - Health Check

Accounts (1):
    1. YourUsername
       Last: 2025-01-15T10:30:00.000Z

Status: Running
Mode: Internal Scheduling
Uptime: 42 minutes
Current Time: 2025-01-15T10:35:00.000Z
```


### Scheduling Modes

#### External Cron Mode (Default)
- Requires external cron service (UptimeRobot, cron-job.org, etc.)
- External service pings `http://your-server:3000/` every 5-10 minutes to trigger reconnections
- Recommended for platforms like Render, Railway, or Heroku free tiers that auto-sleep
- **Setup**: Configure an external service to ping your endpoint regularly

#### Internal Scheduling Mode (Self-Contained)
- Set `USE_INTERNAL_SCHEDULING=true` in `.env`
- No external services needed
- Reconnects every 3-5 minutes automatically with random intervals
- Best for VPS, dedicated servers, or Docker deployments
- Just run `npm start` and forget!

## 🌐 Deployment Options

### Coolify / VPS (Recommended: Use Internal Scheduling)
1. Push your code to a Git repository
2. Create a new service in Coolify pointing to your repo
3. Add environment variables in Coolify dashboard:
   - `TOKEN=your_token`
   - `USE_INTERNAL_SCHEDULING=true` (recommended for VPS)
4. Deploy!

### Render / Railway / Fly.io (Use External Cron or Internal Scheduling)
1. Connect your GitHub repository
2. Add environment variables in the dashboard:
   - `TOKEN=your_token`
   - **Option A (External Cron - Default)**: Set up UptimeRobot or similar to ping your app URL every 5-10 minutes
   - **Option B (Internal Scheduling)**: Add `USE_INTERNAL_SCHEDULING=true`
3. Deploy as a web service
4. The app will start automatically

**Note**: For free tiers that auto-sleep, external cron (Option A) is recommended to wake the service.

### Self-Hosted Server (Recommended: Use Internal Scheduling)
```bash
# Clone on your server
git clone https://github.com/zbcoding/discord_always_online.git
cd discord_always_online

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your token and set USE_INTERNAL_SCHEDULING=true

# Run with PM2 (recommended for production)
npm install -g pm2
pm2 start index.js --name discord-always-online
pm2 save
pm2 startup
```


## Troubleshooting

### "Invalid token" error
- Your Discord token has expired or is incorrect
- You may have changed your Discord password (requires a new token)
- Copy a fresh token from Discord using the steps above

### Connection keeps dropping
- Discord might be rate-limiting you
- Check if you have a stable internet connection
- Review logs for specific error messages

### Health check shows "?"
- The bot hasn't connected yet (wait 30 seconds)
- Invalid token preventing connection
- Check console logs for errors

### No error notifications received
- Verify your `WEBHOOK_URL` is correct
- Test the webhook manually with a curl command
- Check that the webhook channel still exists

## 📝 Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# The app will start and show logs in the console
```
