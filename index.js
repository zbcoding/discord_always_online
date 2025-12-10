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

  // Build detailed account list
  const accountList = botInstances.map((bot, i) => {
    const name = bot.account.user ? bot.account.user.username : `Bot #${i}`;
    const lastReconnect = bot.lastReconnect ? bot.lastReconnect.toISOString() : 'Never';

    return `    ${i + 1}. ${name}
       Last: ${lastReconnect}`;
  }).join('\n\n');

  // In external cron mode, trigger reconnection when this endpoint is hit
  if (!USE_INTERNAL_SCHEDULING) {
    console.log("External cron ping received - triggering reconnection");
    connectAllBots(true); // Stagger the reconnections
  }

  res.send(`
    Discord Always Online - Health Check

    Accounts (${usernames.length}):
${accountList}

    Status: Running
    Mode: ${mode}
    Uptime: ${Math.floor(uptime / 60)} minutes
    Current Time: ${now.toISOString()}
  `);
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

    console.log(`Bot #${botId} next reconnection scheduled in ${(randomMs / 60000).toFixed(2)} minutes`);
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
} else {
  console.log('Waiting for external cron pings to trigger reconnections...');
}
