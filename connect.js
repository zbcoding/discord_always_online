import dotenv from 'dotenv';
import { Client } from 'discord.js-selfbot-v13';
import { sendError, sendLowError, sendInfo } from './error.js';
dotenv.config();

// Parse tokens from environment variables
function _getTokensRaw() {
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

function getTokens() {
  const rawTokens = _getTokensRaw();
  return rawTokens.map(t => {
    if (typeof t === 'object' && t !== null) {
      return { name: t.name || null, token: t.token || t.value || null };
    }
    if (typeof t === 'string') {
      const colonIndex = t.indexOf(':');
      if (colonIndex > 0) {
        return { name: t.substring(0, colonIndex).trim(), token: t.substring(colonIndex + 1).trim() };
      }
      return { name: null, token: t.trim() };
    }
    return { name: null, token: String(t).trim() };
  }).filter(t => t.token && t.token.length > 0);
}

// Store all bot instances
const botInstances = [];

// Create bot instances for all tokens
export function initializeBots() {
  const tokens = getTokens();

  for (let i = 0; i < tokens.length; i++) {
    const tokenObj = tokens[i];
    const token = tokenObj.token;

    // Create a Discord.js selfbot client for each token
    const client = new Client({
      checkUpdate: false,
    });

    botInstances.push({
      id: i,
      client,
      token,
      providedName: tokenObj.name,
      username: null,
      lastReconnect: null,
      nextReconnect: null,
      status: 'disconnected', // 'connecting' | 'connected' | 'error' | 'disconnected'
      errorCount: 0,
      totalErrorCount: 0,
      lastError: null,
      lastErrorTime: null,
      consecutiveErrors: 0, // Track consecutive errors for backoff
      backoffMs: 0, // Current backoff delay in ms
      connectionTimeout: null,
      statusTimeout: null,
      handlersSetup: false,
      firstConnect: true,
    });
  }

  console.log(`Initialized ${botInstances.length} bot instance(s) with independent connections`);
  return botInstances;
}

// Get username for a specific bot instance
export function getUsername(botId = 0) {
  if (botId >= 0 && botId < botInstances.length) {
    const bot = botInstances[botId];
    return bot.client.user ? bot.client.user.username : (bot.providedName || `Bot #${botId}`);
  }
  return 'Unknown';
}

// Get all usernames
export function getAllUsernames() {
  return botInstances.map((bot, index) =>
    bot.client.user ? bot.client.user.username : (bot.providedName || `Bot #${index}`)
  );
}

// Mask token for safe logging
function maskToken(token) {
  if (!token) return '***MASKED***';
  return token.length > 8
    ? `${token.substring(0, 4)}...${token.substring(token.length - 4)}`
    : '***MASKED***';
}

// Mask token occurrences in a string
function maskTokenInString(str, token) {
  if (!str || !token || !str.includes(token)) return str;
  return str.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), maskToken(token));
}

// Setup error handlers for a bot instance (called once per bot)
function setupErrorHandlers(botInstance) {
  const { id, client } = botInstance;

  client.on("error", async (err) => {
    const username = getUsername(id);
    let errorMessage = `Account: ${username} (Bot #${id}, Token: ${maskToken(botInstance.token)}) `;
    const errStr = err.toString();

    // Track error in bot instance
    botInstance.errorCount++;
    botInstance.totalErrorCount++;
    botInstance.consecutiveErrors++;
    botInstance.lastError = errStr;
    botInstance.lastErrorTime = new Date();
    botInstance.status = 'error';

    // Calculate exponential backoff: 30s, 60s, 120s, 240s, etc. (capped at 5 min)
    const baseBackoff = 30000; // 30 seconds
    const maxBackoff = 300000; // 5 minutes
    botInstance.backoffMs = Math.min(
      baseBackoff * Math.pow(2, botInstance.consecutiveErrors - 1),
      maxBackoff
    );

    // Log full error details for debugging
    console.log(`[${new Date().toISOString()}] [Bot #${id}] ERROR DETAILS:`);
    console.log(`  Error type: ${err.name || 'Unknown'}`);

    // Mask token in error message if present
    const safeMessage = maskTokenInString(err.message || errStr, botInstance.token);

    console.log(`  Error message: ${safeMessage}`);
    console.log(`  Error count: ${botInstance.errorCount}, consecutive: ${botInstance.consecutiveErrors}, total: ${botInstance.totalErrorCount}`);
    console.log(`  Next retry backoff: ${(botInstance.backoffMs/1000).toFixed(0)}s`);

    if (err.code) {
      console.log(`  Error code: ${err.code}`);
    }

    // Show stack trace for debugging (first 3 lines, with tokens masked)
    if (err.stack) {
      const stackLines = maskTokenInString(
        err.stack.split('\n').slice(0, 3).join('\n'),
        botInstance.token
      );
      console.log(`  Stack trace:\n${stackLines}`);
    }

    // Handle specific error codes and types
    if (errStr.includes("TOKEN_INVALID") || errStr.includes("Incorrect token") || errStr.includes("401") || errStr.includes("Unauthorized")) {
      console.log(`  AUTHENTICATION ERROR - Invalid Discord token`);
      console.log(`     Possible causes:`);
      console.log(`       - Token has been revoked/reset`);
      console.log(`       - Token format is incorrect`);
      console.log(`       - Account may be locked or disabled`);
      errorMessage += `Authentication failed - Invalid token.\n`;
      sendError(errorMessage);
    } else if (errStr.includes("ECONNREFUSED") || errStr.includes("ENOTFOUND")) {
      console.log(`  Network connection error - check internet connectivity`);
      errorMessage += `Network connection error. ${safeMessage}\n`;
      sendLowError(errorMessage);
    } else if (errStr.includes("429") || errStr.includes("rate limit")) {
      console.log(`  RATE LIMITED by Discord - backing off`);
      errorMessage += `Rate limited by Discord. ${safeMessage}\n`;
      sendLowError(errorMessage);
    } else {
      // Unknown error - send to webhook and log full details
      console.log(`  ERROR - Full error object:`);
      console.log(err);
      errorMessage += `An error occurred. ${safeMessage}\n`;
      sendLowError(errorMessage);
    }

    console.log(''); // Blank line for readability
  });

  client.on("disconnect", () => {
    botInstance.status = 'disconnected';
    console.log(`[${new Date().toISOString()}] [Bot #${id}] Disconnected`);
  });

  // Monitor presence changes to detect if status goes idle
  client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (!client.user || newPresence.userId !== client.user.id) return;
    const newStatus = newPresence.status;

    if (newStatus === 'idle' || newStatus === 'dnd') {
      console.log(`[${new Date().toISOString()}] [Bot #${id}] Status changed to ${newStatus.toUpperCase()}, will return to online`);

      const randomDelay = (Math.random() * 5 + 5) * 1000;
      setTimeout(() => {
        if (client.user) {
          try {
            client.user.setStatus('online');
            console.log(`[${new Date().toISOString()}] [Bot #${id}] Returned status to ONLINE after ${(randomDelay/1000).toFixed(1)}s`);
          } catch (err) {
            console.log(`[${new Date().toISOString()}] [Bot #${id}] Failed to return to online:`, err.message);
          }
        }
      }, randomDelay);
    }
  });

  client.on("ready", () => {
    botInstance.username = client.user.username;
    botInstance.status = 'connected';
    botInstance.errorCount = 0;
    botInstance.consecutiveErrors = 0;
    botInstance.backoffMs = 0;
    botInstance.lastError = null;
    botInstance.lastErrorTime = null;

    // Clear connection timeout if it exists
    if (botInstance.connectionTimeout) {
      clearTimeout(botInstance.connectionTimeout);
      botInstance.connectionTimeout = null;
    }

    console.log(`[${new Date().toISOString()}] [Bot #${id}] Successfully connected as ${client.user.username}`);
    console.log(`  User ID: ${client.user.id}`);
    console.log(`  Tag: ${client.user.tag}`);

    // Send startup notification on first successful connect
    if (botInstance.firstConnect) {
      botInstance.firstConnect = false;
      sendInfo(`Bot #${id} connected successfully as ${client.user.username}`);
    }

    // Set status to online
    try {
      client.user.setStatus('online');
      console.log(`[${new Date().toISOString()}] [Bot #${id}] Status set to ONLINE`);
    } catch (err) {
      console.log(`[${new Date().toISOString()}] [Bot #${id}] Failed to set status:`, err.message);
    }

    // Schedule status refreshes with randomized timing (3-7 minutes)
    function scheduleStatusRefresh() {
      if (botInstance.statusTimeout) {
        clearTimeout(botInstance.statusTimeout);
      }

      const minMinutes = 3;
      const maxMinutes = 7;
      const randomMs = (Math.random() * (maxMinutes - minMinutes) + minMinutes) * 60 * 1000;

      botInstance.statusTimeout = setTimeout(() => {
        if (client.user) {
          try {
            client.user.setStatus('online');
            console.log(`[${new Date().toISOString()}] [Bot #${id}] Status refreshed`);
            scheduleStatusRefresh();
          } catch (err) {
            console.log(`[${new Date().toISOString()}] [Bot #${id}] Status refresh failed:`, err.message);
            scheduleStatusRefresh();
          }
        }
      }, randomMs);
    }

    scheduleStatusRefresh();
  });

  botInstance.handlersSetup = true;
}

// Connect all bots with staggered timing
export function connectAllBots(stagger = true, silentSkip = false) {
  if (botInstances.length === 0) {
    throw new Error('No bot instances initialized. Call initializeBots() first.');
  }

  if (!silentSkip) {
    console.log(`Connecting ${botInstances.length} bot(s)${stagger ? ' with staggered timing' : ''}...`);
  }

  botInstances.forEach((botInstance, index) => {
    // Skip bots that are already connected
    if (botInstance.status === 'connected') {
      if (!silentSkip) {
        console.log(`[${new Date().toISOString()}] [Bot #${botInstance.id}] Already connected, skipping`);
      }
      return;
    }

    const delay = stagger ? index * getRandomDelay(5000, 15000) : 0;

    setTimeout(() => {
      // Only setup error handlers once per bot
      if (!botInstance.handlersSetup) {
        setupErrorHandlers(botInstance);
      }

      botInstance.status = 'connecting';

      botInstance.client.login(botInstance.token).catch(err => {
        const safeMessage = maskTokenInString(err.message, botInstance.token);
        console.log(`[${new Date().toISOString()}] [Bot #${botInstance.id}] Login failed:`, safeMessage);
        botInstance.status = 'error';
        botInstance.lastError = safeMessage;
        botInstance.lastErrorTime = new Date();
        botInstance.errorCount++;
        botInstance.totalErrorCount++;
        botInstance.consecutiveErrors++;
        const name = getUsername(botInstance.id);
        sendError(`Account ${name} (Token: ${maskToken(botInstance.token)}) login failed: ${safeMessage}`);
      });

      botInstance.lastReconnect = new Date();
      console.log(`[${new Date().toISOString()}] [Bot #${botInstance.id}] Initiating connection${stagger ? ` (delayed ${(delay / 1000).toFixed(1)}s)` : ''}...`);

      // Clear any existing connection timeout
      if (botInstance.connectionTimeout) {
        clearTimeout(botInstance.connectionTimeout);
      }

      // Set timeout to detect hanging connections (60 seconds)
      botInstance.connectionTimeout = setTimeout(() => {
        if (botInstance.status === 'connecting') {
          console.log(`[${new Date().toISOString()}] [Bot #${botInstance.id}] WARNING: Connection timeout after 60s`);
          console.log(`  Status is still 'connecting' - no ready or error event received`);
          console.log(`  This usually indicates:`);
          console.log(`    - Invalid or expired user token`);
          console.log(`    - Network/firewall blocking Discord WebSocket`);
          console.log(`    - Discord rate limiting the connection attempts`);
          botInstance.status = 'error';
          botInstance.lastError = 'Connection timeout - no response from Discord';
          botInstance.lastErrorTime = new Date();
          botInstance.errorCount++;
          botInstance.totalErrorCount++;
          botInstance.consecutiveErrors++;
          const name = getUsername(botInstance.id);
          sendError(`Account ${name} (Token: ${maskToken(botInstance.token)}) connection timed out after 60s - likely invalid/expired token`);
        }
      }, 60000);
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

  // Check if we should apply backoff delay
  if (botInstance.backoffMs > 0 && botInstance.status === 'error') {
    console.log(`[${new Date().toISOString()}] [Bot #${botId}] Delaying reconnection by ${(botInstance.backoffMs/1000).toFixed(0)}s due to errors`);
    setTimeout(() => {
      attemptConnection(botId);
    }, botInstance.backoffMs);
    return;
  }

  attemptConnection(botId);
}

// Internal function to actually attempt connection
function attemptConnection(botId) {
  const botInstance = botInstances[botId];

  if (!botInstance.handlersSetup) {
    setupErrorHandlers(botInstance);
  }

  botInstance.status = 'connecting';

  botInstance.client.login(botInstance.token).catch(err => {
    const safeMessage = maskTokenInString(err.message, botInstance.token);
    console.log(`[${new Date().toISOString()}] [Bot #${botId}] Login failed:`, safeMessage);
    botInstance.status = 'error';
    botInstance.lastError = safeMessage;
    botInstance.lastErrorTime = new Date();
    botInstance.errorCount++;
    botInstance.totalErrorCount++;
    botInstance.consecutiveErrors++;
    const name = getUsername(botId);
    sendError(`Account ${name} (Token: ${maskToken(botInstance.token)}) login failed: ${safeMessage}`);
  });

  botInstance.lastReconnect = new Date();
  console.log(`[${new Date().toISOString()}] [Bot #${botId}] Reconnecting...`);

  // Clear any existing connection timeout
  if (botInstance.connectionTimeout) {
    clearTimeout(botInstance.connectionTimeout);
  }

  // Set timeout to detect hanging connections (60 seconds)
  botInstance.connectionTimeout = setTimeout(() => {
    if (botInstance.status === 'connecting') {
      console.log(`[${new Date().toISOString()}] [Bot #${botId}] WARNING: Connection timeout after 60s`);
      console.log(`  Status is still 'connecting' - no ready or error event received`);
      console.log(`  This usually indicates:`);
      console.log(`    - Invalid or expired user token`);
      console.log(`    - Network/firewall blocking Discord WebSocket`);
      console.log(`    - Discord rate limiting the connection attempts`);
      botInstance.status = 'error';
      botInstance.lastError = 'Connection timeout - no response from Discord';
      botInstance.lastErrorTime = new Date();
      botInstance.errorCount++;
      botInstance.totalErrorCount++;
      botInstance.consecutiveErrors++;
      const name = getUsername(botId);
      sendError(`Account ${name} (Token: ${maskToken(botInstance.token)}) connection timed out after 60s - likely invalid/expired token`);
    }
  }, 60000);
}

// Graceful shutdown - destroy all clients and clear timers
export function shutdownAllBots() {
  console.log(`[${new Date().toISOString()}] Shutting down ${botInstances.length} bot(s)...`);
  for (const bot of botInstances) {
    if (bot.connectionTimeout) {
      clearTimeout(bot.connectionTimeout);
      bot.connectionTimeout = null;
    }
    if (bot.statusTimeout) {
      clearTimeout(bot.statusTimeout);
      bot.statusTimeout = null;
    }
    try {
      bot.client.destroy();
      bot.status = 'disconnected';
      console.log(`[${new Date().toISOString()}] [Bot #${bot.id}] Destroyed`);
    } catch (err) {
      console.log(`[${new Date().toISOString()}] [Bot #${bot.id}] Error during shutdown:`, err.message);
    }
  }
}

// Get bot instances (for external use if needed)
export function getBotInstances() {
  return botInstances;
}
