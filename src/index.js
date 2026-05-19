import dotenv from 'dotenv';
import express from 'express';
import { Temporal } from '@js-temporal/polyfill';
import { initializeBots, connectAllBots, connectBot, getAllUsernames, getBotInstances, shutdownAllBots } from './connect.js';

dotenv.config();

// Check if using internal scheduling mode (opt-in) or external cron mode (default)
const USE_INTERNAL_SCHEDULING = process.env.USE_INTERNAL_SCHEDULING === 'true';

// Dashboard password for revealing first 5 chars of account names
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';

// Rate limiting for the health endpoint
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max requests per window
const rateLimitMap = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  return true;
}

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// HTML-escape to prevent XSS from usernames or error messages
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Format uptime using Temporal API
// Months are the largest unit intentionally
function formatUptime(seconds) {
  const start = Temporal.PlainDateTime.from("1970-01-01T00:00");
  const end = start.add({ seconds: Math.floor(seconds) });
  const diff = start.until(end, { largestUnit: "months" });

  const parts = [];
  if (diff.months > 0) parts.push(`${diff.months} month${diff.months !== 1 ? 's' : ''}`);
  if (diff.days > 0) parts.push(`${diff.days} day${diff.days !== 1 ? 's' : ''}`);
  if (diff.hours > 0) parts.push(`${diff.hours} hour${diff.hours !== 1 ? 's' : ''}`);
  if (diff.minutes > 0) parts.push(`${diff.minutes} min`);

  return parts.length > 0 ? parts.join(', ') : '0 min';
}

// Health check server
const app = express();

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => {
  const clientIp = req.ip || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    return res.status(429).send('Too Many Requests. Try again later.');
  }

  const usernames = getAllUsernames();
  const botInstances = getBotInstances();
  const now = new Date();
  const uptime = process.uptime();
  const mode = USE_INTERNAL_SCHEDULING ? 'Internal Scheduling' : 'External Cron';
  const formattedUptime = formatUptime(uptime);

  // Check if password query param matches for revealing account names
  const authenticated = DASHBOARD_PASSWORD && req.query.password === DASHBOARD_PASSWORD;

  // In external cron mode, trigger reconnection when this endpoint is hit
  if (!USE_INTERNAL_SCHEDULING) {
    console.log("External cron ping received - triggering reconnection");
    connectAllBots(true, true); // Stagger the reconnections, suppress already connected logs
  }

  // Build HTML account rows
  const accountRows = botInstances.map((bot, i) => {
    const username = bot.client.user ? bot.client.user.username : null;
    let displayName = 'Connecting...';

    // Determine display name based on auth
    if (username && username.length > 0) {
      if (authenticated) {
        // Show first 5 chars + asterisks for the rest
        const visible = username.substring(0, 5);
        const hidden = username.length > 5 ? '*'.repeat(username.length - 5) : '';
        displayName = escapeHtml(visible) + hidden;
      } else {
        displayName = '*'.repeat(username.length);
      }
    }

    // Determine status color based on actual connection state
    let statusColor = '#6c757d'; // gray for unknown
    let statusBadge = '';

    if (bot.status === 'connected' && bot.errorCount === 0) {
      statusColor = '#28a745'; // green - healthy
      statusBadge = '<span style="color: #28a745; font-weight: 500;">&#10003; Connected</span>';
    } else if (bot.status === 'connecting') {
      statusColor = '#ffc107'; // yellow - connecting
      statusBadge = '<span style="color: #ffc107;">&#x27F3; Connecting...</span>';
      displayName = 'Connecting...';
    } else if (bot.status === 'error') {
      statusColor = '#dc3545'; // red - error
      statusBadge = `<span style="color: #dc3545;">&#10007; Error (${bot.errorCount} recent, ${bot.totalErrorCount} total)</span>`;
    } else if (bot.status === 'disconnected') {
      statusColor = '#6c757d'; // gray - disconnected
      statusBadge = '<span style="color: #6c757d;">&#8855; Disconnected</span>';
      displayName = 'Disconnected';
    }

    const lastReconnect = bot.lastReconnect ? bot.lastReconnect.toISOString() : 'Never';

    // Error details row (shown below the main row if there's an error)
    let errorDetailRow = '';
    if (bot.lastError && bot.lastErrorTime) {
      const safeError = escapeHtml(bot.lastError).substring(0, 200);
      const errorAge = Math.round((now.getTime() - bot.lastErrorTime.getTime()) / 1000);
      let errorAgeStr;
      if (errorAge < 60) errorAgeStr = `${errorAge}s ago`;
      else if (errorAge < 3600) errorAgeStr = `${Math.floor(errorAge / 60)}m ago`;
      else errorAgeStr = `${Math.floor(errorAge / 3600)}h ago`;

      errorDetailRow = `
        <tr>
          <td colspan="3" style="padding: 4px 12px 12px 32px; border-bottom: 1px solid #dee2e6; background: #fff5f5;">
            <span style="font-size: 0.8em; color: #dc3545;">
              Last error (${errorAgeStr}): ${safeError}
            </span>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td style="padding: 12px; ${errorDetailRow ? '' : 'border-bottom: 1px solid #dee2e6;'}">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${statusColor}; margin-right: 8px;"></span>
          ${displayName}
        </td>
        <td style="padding: 12px; ${errorDetailRow ? '' : 'border-bottom: 1px solid #dee2e6;'} font-size: 0.9em;">${statusBadge}</td>
        <td style="padding: 12px; ${errorDetailRow ? '' : 'border-bottom: 1px solid #dee2e6;'} color: #6c757d; font-size: 0.9em;">${lastReconnect}</td>
      </tr>
      ${errorDetailRow}
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
          <h1>Discord Always Online</h1>
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
              <p>${escapeHtml(mode)}</p>
            </div>
            <div class="info-card">
              <h3>Uptime</h3>
              <p>${escapeHtml(formattedUptime)}</p>
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
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Health check server running on port ${port}`);
  console.log(`Mode: ${USE_INTERNAL_SCHEDULING ? 'Internal Scheduling' : 'External Cron (default)'}`);
  if (DASHBOARD_PASSWORD) {
    console.log('Dashboard password is set - append ?password=<your_password> to reveal account names');
  }
});

// Discord connection logic
console.log('Starting Discord Always Online...');
console.log('Initializing bot instances...');
const botInstances = initializeBots();

console.log('Initial connection with staggered timing...');
connectAllBots(true); // Stagger initial connections

// Only use internal scheduling if explicitly enabled
if (USE_INTERNAL_SCHEDULING) {
  console.log('Internal scheduling mode enabled');
  console.log('   Bots will stay connected indefinitely and only reconnect if disconnected');
  console.log('   This is more reliable and less likely to trigger automation detection');
} else {
  console.log('Waiting for external cron pings to trigger reconnections...');
}

// Graceful shutdown handler
function handleShutdown(signal) {
  console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...`);
  shutdownAllBots();
  server.close(() => {
    console.log(`[${new Date().toISOString()}] HTTP server closed`);
    process.exit(0);
  });
  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.log(`[${new Date().toISOString()}] Forced exit after 10s timeout`);
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
