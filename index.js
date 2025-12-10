require('dotenv').config();
const express = require("express");
const { connectBot, getUsername } = require("./connect");

// Check if using external cron mode (old way) or internal scheduling (new way)
const USE_EXTERNAL_CRON = process.env.USE_EXTERNAL_CRON === 'true';

// Health check server
const app = express();
let lastReconnect = new Date();
let nextReconnectTime = null;

app.get('/favicon.ico', (req, res) => res.status(204));
app.get('/', (req, res) => {
  const username = getUsername();
  const firstUserNameChar = username ? `"${username[0]}..."` : '?';
  const now = new Date();
  const uptime = process.uptime();
  const mode = USE_EXTERNAL_CRON ? 'External Cron' : 'Internal Scheduling';
  const nextIn = nextReconnectTime ? Math.max(0, (nextReconnectTime - now) / 1000 / 60).toFixed(2) : 'N/A';

  // In external cron mode, trigger reconnection when this endpoint is hit
  if (USE_EXTERNAL_CRON) {
    console.log("External cron ping received - triggering reconnection");
    connectBot();
    lastReconnect = new Date();
  }

  res.send(`
    Discord Always Online - Health Check

    Account: ${firstUserNameChar}
    Status: Running
    Mode: ${mode}
    Uptime: ${Math.floor(uptime / 60)} minutes
    Last Reconnect: ${lastReconnect.toISOString()}
    Next Reconnect: ${USE_EXTERNAL_CRON ? 'Via external cron' : `in ~${nextIn} minutes`}
    Current Time: ${now.toISOString()}
  `);
});

const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Health check server running on port ${port}`);
  console.log(`Mode: ${USE_EXTERNAL_CRON ? 'External Cron (old way)' : 'Internal Scheduling (new way)'}`);
});

// Discord connection logic
console.log('Starting Discord Always Online...');
console.log('Initial connection...');
connectBot();
lastReconnect = new Date();

// Only use internal scheduling if NOT in external cron mode
if (!USE_EXTERNAL_CRON) {
  // Schedule reconnection at random intervals between 3-5 minutes
  function scheduleNextReconnect() {
    const minMinutes = 3;
    const maxMinutes = 5;
    const randomMinutes = Math.random() * (maxMinutes - minMinutes) + minMinutes;
    const randomMs = randomMinutes * 60 * 1000;

    nextReconnectTime = new Date(Date.now() + randomMs);

    setTimeout(() => {
      const date = new Date().toISOString();
      console.log(`[${date}] Scheduled reconnection triggered (waited ${(randomMs / 60000).toFixed(2)} minutes)`);
      connectBot();
      lastReconnect = new Date();
      scheduleNextReconnect(); // Schedule the next reconnection
    }, randomMs);

    console.log(`Next reconnection scheduled in ${(randomMs / 60000).toFixed(2)} minutes`);
  }

  scheduleNextReconnect();
} else {
  console.log('Waiting for external cron pings to trigger reconnections...');
}
