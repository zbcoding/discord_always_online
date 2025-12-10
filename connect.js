import dotenv from 'dotenv';
import Eris from 'eris';
import { sendError, sendLowError } from './error.js';
dotenv.config();

// Parse tokens from environment variables
function getTokens() {
  // Check for TOKENS format
  if (process.env.TOKENS) {
    let tokensStr = process.env.TOKENS.trim();
    
    // Handle Coolify/Docker escaped quotes: [\"token1\",\"token2\"] -> ["token1","token2"]
    if (tokensStr.includes('\\"')) {
      tokensStr = tokensStr.replace(/\\"/g, '"');
      console.log('Detected escaped quotes in TOKENS, unescaping...');
    }
    
    // Handle unquoted array format: [token1,token2] -> ["token1","token2"]
    // Match pattern: starts with [, contains unquoted values separated by commas, ends with ]
    if (tokensStr.startsWith('[') && tokensStr.endsWith(']') && !tokensStr.includes('"')) {
      // Extract content between brackets and split by comma
      const innerContent = tokensStr.slice(1, -1);
      const tokens = innerContent.split(',').map(t => t.trim()).filter(t => t.length > 0);
      if (tokens.length > 0) {
        console.log(`Parsed ${tokens.length} token(s) from TOKENS (unquoted array format)`);
        return tokens;
      }
    }
    
    // Try parsing as JSON array
    try {
      const tokens = JSON.parse(tokensStr);
      if (Array.isArray(tokens) && tokens.length > 0) {
        console.log(`Parsed ${tokens.length} token(s) from TOKENS (JSON format)`);
        return tokens;
      }
      console.warn('TOKENS is not a valid JSON array or is empty');
    } catch (err) {
      console.error('Failed to parse TOKENS as JSON:', err.message);
      
      // Fallback: try comma-separated format (without brackets/quotes)
      // e.g., TOKENS=token1,token2,token3
      if (!tokensStr.startsWith('[')) {
        const tokens = tokensStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (tokens.length > 0) {
          console.log(`Parsed ${tokens.length} token(s) from TOKENS (comma-separated format)`);
          return tokens;
        }
      }
    }
  }

  // Fall back to legacy TOKEN format
  if (process.env.TOKEN) {
    // Also try parsing TOKEN as JSON array (in case user used TOKEN instead of TOKENS)
    let tokenStr = process.env.TOKEN.trim();
    if (tokenStr.includes('\\"')) {
      tokenStr = tokenStr.replace(/\\"/g, '"');
    }
    
    // Handle unquoted array format for TOKEN too
    if (tokenStr.startsWith('[') && tokenStr.endsWith(']') && !tokenStr.includes('"')) {
      const innerContent = tokenStr.slice(1, -1);
      const tokens = innerContent.split(',').map(t => t.trim()).filter(t => t.length > 0);
      if (tokens.length > 0) {
        console.log(`Parsed ${tokens.length} token(s) from TOKEN (unquoted array format)`);
        return tokens;
      }
    }
    
    if (tokenStr.startsWith('[')) {
      try {
        const tokens = JSON.parse(tokenStr);
        if (Array.isArray(tokens) && tokens.length > 0) {
          console.log(`Parsed ${tokens.length} token(s) from TOKEN (JSON format)`);
          return tokens;
        }
      } catch (err) {
        // Not JSON, treat as single token
      }
    }
    console.log('Using single token from TOKEN');
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
      nextReconnect: null,
      status: 'disconnected', // 'connecting' | 'connected' | 'error' | 'disconnected'
      errorCount: 0,
      lastError: null,
      lastErrorTime: null
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
    const errStr = err.toString();

    // Track error in bot instance
    botInstance.errorCount++;
    botInstance.lastError = errStr;
    botInstance.lastErrorTime = new Date();
    botInstance.status = 'error';

    if (errStr.includes("Error: Invalid token")) {
      errorMessage += `An error occurred in the Discord bot. Invalid token.\n`;
      sendError(errorMessage);
    } else if (
      errStr.includes(
        "TypeError: Cannot read properties of undefined (reading 'add')"
      )
    ) {
      console.log(`[${new Date().toISOString()}] [Bot #${id}] Error: Cannot read 'add' (error #${botInstance.errorCount})`);
    } else if (
      errStr.includes(
        "TypeError: Cannot read properties of undefined (reading 'get')"
      )
    ) {
      console.log(`[${new Date().toISOString()}] [Bot #${id}] Error: Cannot read 'get' (error #${botInstance.errorCount})`);
    } else if (errStr.includes("Error: Connection reset by peer")) {
      console.log(`[${new Date().toISOString()}] [Bot #${id}] Connection reset by peer (error #${botInstance.errorCount})`);
    } else {
      /*other unknown errors can be sent to low importance discord webhook*/
      errorMessage += `An error occurred in the Discord bot. ${err}\n`;
      sendLowError(errorMessage);
    }
  });

  account.on("disconnect", () => {
    botInstance.status = 'disconnected';
    console.log(`[${new Date().toISOString()}] [Bot #${id}] Disconnected`);
  });

  account.on("ready", () => {
    botInstance.username = account.user.username;
    botInstance.status = 'connected';
    botInstance.errorCount = 0; // Reset error count on successful connection
    botInstance.lastError = null;
    console.log(`[${new Date().toISOString()}] [Bot #${id}] Connected as ${account.user.username}`);
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
      botInstance.status = 'connecting';
      botInstance.account.connect();
      botInstance.lastReconnect = new Date();
      console.log(`[${new Date().toISOString()}] [Bot #${botInstance.id}] Initiating connection${stagger ? ` (delayed ${(delay / 1000).toFixed(1)}s)` : ''}...`);
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

  botInstance.status = 'connecting';
  botInstance.account.connect();
  botInstance.lastReconnect = new Date();
  console.log(`[${new Date().toISOString()}] [Bot #${botId}] Reconnecting...`);
}

// Get bot instances (for external use if needed)
export function getBotInstances() {
  return botInstances;
}
