import dotenv from 'dotenv';
import express from 'express';
import { initializeBots, connectAllBots, connectBot, getAllUsernames, getBotInstances } from './connect.js';

dotenv.config();

// Check if using internal scheduling mode (opt-in) or external cron mode (default)
const USE_INTERNAL_SCHEDULING = process.env.USE_INTERNAL_SCHEDULING === 'true';

// Health check server
const app = express();

app.get('/favicon.ico', (req, res) => res.status(204));
app.get('/', (req, res) => {
  const usernames = getAllUsernames();
  const botInstances = getBotInstances();
  const now = new Date();
  const uptime = process.uptime();
  const mode = USE_INTERNAL_SCHEDULING ? 'Internal Scheduling' : 'External Cron';

  // In external cron mode, trigger reconnection when this endpoint is hit
  if (!USE_INTERNAL_SCHEDULING) {
    console.log("External cron ping received - triggering reconnection");
    connectAllBots(true); // Stagger the reconnections
  }

  // Build HTML account rows
  const accountRows = botInstances.map((bot, i) => {
    const username = bot.client.user ? bot.client.user.username : null;
    let displayName = 'Connecting...';
    let statusText = bot.status || 'unknown';

    // Anonymize username: show asterisks matching username length
    if (username && username.length > 0) {
      displayName = '*'.repeat(username.length);
    }

    // Determine status color based on actual connection state
    let statusColor = '#6c757d'; // gray for unknown
    let statusBadge = '';
    
    if (bot.status === 'connected' && bot.errorCount === 0) {
      statusColor = '#28a745'; // green - healthy
      statusBadge = '<span style="color: #28a745; font-weight: 500;">✓ Connected</span>';
    } else if (bot.status === 'connecting') {
      statusColor = '#ffc107'; // yellow - connecting
      statusBadge = '<span style="color: #ffc107;">⟳ Connecting...</span>';
      displayName = 'Connecting...';
    } else if (bot.status === 'error') {
      statusColor = '#dc3545'; // red - error
      statusBadge = `<span style="color: #dc3545;">✗ Error (${bot.errorCount} errors)</span>`;
    } else if (bot.status === 'disconnected') {
      statusColor = '#6c757d'; // gray - disconnected
      statusBadge = '<span style="color: #6c757d;">⊗ Disconnected</span>';
      displayName = 'Disconnected';
    }

    const lastReconnect = bot.lastReconnect ? bot.lastReconnect.toISOString() : 'Never';

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; margin-right: 8px;"></span>
          ${displayName}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6; font-size: 0.9em;">${statusBadge}</td>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6; color: #6c757d; font-size: 0.9em;">${lastReconnect}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Discord Always Online - Health Check</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          max-width: 800px;
          width: 100%;
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #5865f2 0%, #7289da 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          font-size: 28px;
          margin-bottom: 8px;
        }
        .header p {
          opacity: 0.9;
          font-size: 14px;
        }
        .content {
          padding: 30px;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .info-card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          border-left: 4px solid #5865f2;
        }
        .info-card h3 {
          font-size: 12px;
          text-transform: uppercase;
          color: #6c757d;
          margin-bottom: 8px;
          font-weight: 600;
        }
        .info-card p {
          font-size: 20px;
          color: #212529;
          font-weight: 500;
        }
        .accounts-section h2 {
          font-size: 18px;
          margin-bottom: 16px;
          color: #212529;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #dee2e6;
        }
        thead {
          background: #f8f9fa;
        }
        th {
          padding: 12px;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          color: #6c757d;
          font-weight: 600;
          border-bottom: 2px solid #dee2e6;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px 30px;
          text-align: center;
          color: #6c757d;
          font-size: 12px;
          border-top: 1px solid #dee2e6;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
        }
        .status-running {
          background: #d4edda;
          color: #155724;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🟢 Discord Always Online</h1>
          <p>Health Check Dashboard</p>
        </div>

        <div class="content">
          <div class="info-grid">
            <div class="info-card">
              <h3>Status</h3>
              <p><span class="status-badge status-running">Running</span></p>
            </div>
            <div class="info-card">
              <h3>Mode</h3>
              <p>${mode}</p>
            </div>
            <div class="info-card">
              <h3>Uptime</h3>
              <p>${Math.floor(uptime / 60)} min</p>
            </div>
            <div class="info-card">
              <h3>Accounts</h3>
              <p>${usernames.length}</p>
            </div>
          </div>

          <div class="accounts-section">
            <h2>Active Accounts</h2>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Status</th>
                  <th>Last Reconnect</th>
                </tr>
              </thead>
              <tbody>
                ${accountRows}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer">
          Current Time: ${now.toISOString()}
        </div>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Health check server running on port ${port}`);
  console.log(`Mode: ${USE_INTERNAL_SCHEDULING ? 'Internal Scheduling' : 'External Cron (default)'}`);
});

// Discord connection logic
console.log('Starting Discord Always Online...');
console.log('Initializing bot instances...');
const botInstances = initializeBots();

console.log('Initial connection with staggered timing...');
connectAllBots(true); // Stagger initial connections

// Only use internal scheduling if explicitly enabled
if (USE_INTERNAL_SCHEDULING) {
  console.log('⚠️  Internal scheduled reconnections are DISABLED to avoid Discord rate limits');
  console.log('   Bots will stay connected indefinitely and only reconnect if disconnected');
  console.log('   This is more reliable and less likely to trigger automation detection');
  
  // DISABLED: Scheduled reconnections cause Discord to rate limit
  // Discord keeps connections alive once established - no need to reconnect
  // The bots will automatically reconnect if they get disconnected
  
  /*
  // Schedule independent reconnections for each bot at random intervals
  function scheduleNextReconnect(botId) {
    const minMinutes = 3;
    const maxMinutes = 5;
    const randomMinutes = Math.random() * (maxMinutes - minMinutes) + minMinutes;
    const randomMs = randomMinutes * 60 * 1000;

    const botInstance = botInstances[botId];
    botInstance.nextReconnect = new Date(Date.now() + randomMs);

    setTimeout(() => {
      const date = new Date().toISOString();
      console.log(`[${date}] Bot #${botId} scheduled reconnection triggered (waited ${(randomMs / 60000).toFixed(2)} minutes)`);
      connectBot(botId);
      scheduleNextReconnect(botId); // Schedule the next reconnection for this bot
    }, randomMs);

    console.log(`[${new Date().toISOString()}] [Bot #${botId}] Next reconnection scheduled in ${(randomMs / 60000).toFixed(2)} minutes`);
  }

  // Schedule reconnections for all bots independently
  botInstances.forEach((_, index) => {
    // Add initial random offset (0-60 seconds) to further stagger the scheduling
    const initialOffset = Math.random() * 60 * 1000;
    setTimeout(() => {
      scheduleNextReconnect(index);
    }, initialOffset);
  });

  console.log(`Independent reconnection schedules set up for ${botInstances.length} bot(s)`);
  */
} else {
  console.log('Waiting for external cron pings to trigger reconnections...');
}
