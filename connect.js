import dotenv from 'dotenv';
import Eris from 'eris';
import { sendError, sendLowError } from './error.js';
dotenv.config();

// Parse tokens from environment variables
function getTokens() {
  // Check for new TOKENS format (JSON array)
  if (process.env.TOKENS) {
    try {
      const tokens = JSON.parse(process.env.TOKENS);
      if (Array.isArray(tokens)) {
        return tokens;
      }
      console.warn('TOKENS is not a valid JSON array, falling back to TOKEN');
    } catch (err) {
      console.error('Failed to parse TOKENS:', err.message);
    }
  }

  // Fall back to legacy TOKEN format
  if (process.env.TOKEN) {
    return [process.env.TOKEN];
  }

  throw new Error('No tokens found. Please set either TOKENS (JSON array) or TOKEN (single value) in .env');
}

// Store all bot instances
const botInstances = [];

// Create bot instances for all tokens
export function initializeBots() {
  const tokens = getTokens();

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Create a NEW Eris client instance for each token
    // This ensures each account has its own independent websocket connection
    const account = new Eris(token);

    botInstances.push({
      id: i,
      account,
      token,
      username: null,
      lastReconnect: null,
      nextReconnect: null
    });
  }

  console.log(`Initialized ${botInstances.length} bot instance(s) with independent connections`);
  return botInstances;
}

// Get username for a specific bot instance
export function getUsername(botId = 0) {
  if (botId >= 0 && botId < botInstances.length) {
    const bot = botInstances[botId];
    return bot.account.user ? bot.account.user.username : `Bot #${botId}`;
  }
  return 'Unknown';
}

// Get all usernames
export function getAllUsernames() {
  return botInstances.map((bot, index) =>
    bot.account.user ? bot.account.user.username : `Bot #${index}`
  );
}

// Setup error handlers for a bot instance
function setupErrorHandlers(botInstance) {
  const { id, account } = botInstance;

  account.on("error", async (err) => {
    const username = getUsername(id);
    let errorMessage = `Account: ${username} (Bot #${id}) `;

    if (err.toString().includes("Error: Invalid token")) {
      errorMessage += `An error occurred in the Discord bot. Invalid token.\n`;
      sendError(errorMessage);
    } else if (
      err
        .toString()
        .includes(
          "TypeError: Cannot read properties of undefined (reading 'add')"
        )
    ) {
      console.log(`[Bot #${id}] An error occurred in the Discord bot. ${err}`);
    } else if (
      err
        .toString()
        .includes(
          "TypeError: Cannot read properties of undefined (reading 'get')"
        )
    ) {
      console.log(`[Bot #${id}] An error occurred in the Discord bot. ${err}`);
    } else if (err.toString().includes("Error: Connection reset by peer")) {
      console.log(`[Bot #${id}] An error occurred in the Discord bot. ${err}`);
    } else {
      /*other unknown errors can be sent to low importance discord webhook*/
      errorMessage += `An error occurred in the Discord bot. ${err}\n`;
      sendLowError(errorMessage);
    }
  });

  account.on("ready", () => {
    botInstance.username = account.user.username;
    console.log(`[Bot #${id}] Connected as ${account.user.username}`);
  });
}

// Connect all bots with staggered timing
export function connectAllBots(stagger = true) {
  if (botInstances.length === 0) {
    throw new Error('No bot instances initialized. Call initializeBots() first.');
  }

  console.log(`Connecting ${botInstances.length} bot(s)${stagger ? ' with staggered timing' : ''}...`);

  botInstances.forEach((botInstance, index) => {
    const delay = stagger ? index * getRandomDelay(5000, 15000) : 0; // 5-15 seconds between each

    setTimeout(() => {
      setupErrorHandlers(botInstance);
      botInstance.account.connect();
      botInstance.lastReconnect = new Date();
      console.log(`[Bot #${botInstance.id}] Initiating connection${stagger ? ` (delayed ${(delay / 1000).toFixed(1)}s)` : ''}...`);
    }, delay);
  });
}

// Helper to get random delay
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Connect a specific bot by ID
export function connectBot(botId) {
  if (botId < 0 || botId >= botInstances.length) {
    throw new Error(`Invalid bot ID: ${botId}`);
  }

  const botInstance = botInstances[botId];

  // Only setup error handlers if not already set up
  if (!botInstance.handlersSetup) {
    setupErrorHandlers(botInstance);
    botInstance.handlersSetup = true;
  }

  botInstance.account.connect();
  botInstance.lastReconnect = new Date();
  console.log(`[Bot #${botId}] Reconnecting...`);
}

// Get bot instances (for external use if needed)
export function getBotInstances() {
  return botInstances;
}
