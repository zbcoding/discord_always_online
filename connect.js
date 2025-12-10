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
      lastErrorTime: null,
      consecutiveErrors: 0, // Track consecutive errors for backoff
      backoffMs: 0 // Current backoff delay in ms
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
    let safeMessage = err.message || errStr;
    if (safeMessage.includes(botInstance.token)) {
      const token = botInstance.token;
      const maskedToken = token.length > 12 
        ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}`
        : '***MASKED***';
      safeMessage = safeMessage.replace(new RegExp(token, 'g'), maskedToken);
    }
    
    console.log(`  Error message: ${safeMessage}`);
    console.log(`  Error count: ${botInstance.errorCount}, consecutive: ${botInstance.consecutiveErrors}`);
    console.log(`  Next retry backoff: ${(botInstance.backoffMs/1000).toFixed(0)}s`);
    
    if (err.code) {
      console.log(`  Error code: ${err.code}`);
    }
    
    // Show stack trace for debugging (first 3 lines, with tokens masked)
    if (err.stack) {
      let stackLines = err.stack.split('\n').slice(0, 3).join('\n');
      if (stackLines.includes(botInstance.token)) {
        const token = botInstance.token;
        const maskedToken = token.length > 12 
          ? `${token.substring(0, 8)}...${token.substring(token.length - 4)}`
          : '***MASKED***';
        stackLines = stackLines.replace(new RegExp(token, 'g'), maskedToken);
      }
      console.log(`  Stack trace:\n${stackLines}`);
    }

    // Handle specific error codes and types
    if (err.code === 4003 || err.code === 4004 || errStr.includes("Not authenticated") || errStr.includes("Authentication failed")) {
      console.log(`  ⚠️  AUTHENTICATION ERROR - Invalid or expired Discord token`);
      console.log(`     Discord rejected the token (code ${err.code || 'unknown'})`);
      console.log(`     Possible causes:`);
      console.log(`       - Token has been revoked/reset`);
      console.log(`       - Token is for a different account type (user vs bot)`);
      console.log(`       - Token format is incorrect`);
      errorMessage += `Authentication failed - Discord rejected token (code ${err.code}).\n`;
      sendError(errorMessage);
    } else if (errStr.includes("Error: Invalid token") || errStr.includes("401") || errStr.includes("Unauthorized")) {
      errorMessage += `Invalid or unauthorized token. Check if token is valid and not expired.\n`;
      console.log(`  ⚠️  This appears to be an authentication error. Verify your token is correct.`);
      sendError(errorMessage);
    } else if (
      errStr.includes(
        "TypeError: Cannot read properties of undefined (reading 'add')"
      )
    ) {
      console.log(`  ℹ️  Internal Eris error - may indicate connection/auth issue`);
    } else if (
      errStr.includes(
        "TypeError: Cannot read properties of undefined (reading 'get')"
      )
    ) {
      console.log(`  ℹ️  Internal Eris error - may indicate connection/auth issue`);
    } else if (errStr.includes("Error: Connection reset by peer")) {
      console.log(`  ℹ️  Connection was reset - network or Discord server issue`);
    } else if (errStr.includes("ECONNREFUSED") || errStr.includes("ENOTFOUND")) {
      console.log(`  ℹ️  Network connection error - check internet connectivity`);
      errorMessage += `Network connection error. ${safeMessage}\n`;
      sendLowError(errorMessage);
    } else if (errStr.includes("429") || errStr.includes("rate limit")) {
      console.log(`  ⚠️  RATE LIMITED by Discord - backing off`);
      errorMessage += `Rate limited by Discord. ${safeMessage}\n`;
      sendLowError(errorMessage);
    } else {
      // Unknown error - send to webhook and log full details
      console.log(`  ⚠️  UNKNOWN ERROR TYPE - Full error object:`);
      console.log(err);
      errorMessage += `An error occurred in the Discord bot. ${safeMessage}\n`;
      sendLowError(errorMessage);
    }
    
    console.log(''); // Blank line for readability
  });

  account.on("disconnect", () => {
    botInstance.status = 'disconnected';
    const reason = arguments[0] || 'Unknown reason';
    console.log(`[${new Date().toISOString()}] [Bot #${id}] Disconnected - Reason: ${reason}`);
  });

  account.on("ready", () => {
    botInstance.username = account.user.username;
    botInstance.status = 'connected';
    botInstance.errorCount = 0; // Reset error count on successful connection
    botInstance.consecutiveErrors = 0; // Reset consecutive errors
    botInstance.backoffMs = 0; // Reset backoff
    botInstance.lastError = null;
    
    // Clear connection timeout if it exists
    if (botInstance.connectionTimeout) {
      clearTimeout(botInstance.connectionTimeout);
      botInstance.connectionTimeout = null;
    }
    
    console.log(`[${new Date().toISOString()}] [Bot #${id}] ✓ Successfully connected as ${account.user.username}`);
    console.log(`  User ID: ${account.user.id}`);
    console.log(`  Discriminator: ${account.user.discriminator || 'None'}`);
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
      
      // Set timeout to detect hanging connections (60 seconds)
      botInstance.connectionTimeout = setTimeout(() => {
        if (botInstance.status === 'connecting') {
          console.log(`[${new Date().toISOString()}] [Bot #${botInstance.id}] ⚠️  WARNING: Connection timeout after 60s`);
          console.log(`  Status is still 'connecting' - no ready or error event received`);
          console.log(`  This usually indicates:`);
          console.log(`    - Invalid or expired user token`);
          console.log(`    - User token instead of bot token (user tokens have restrictions)`);
          console.log(`    - Network/firewall blocking Discord WebSocket`);
          console.log(`    - Discord rate limiting the connection attempts`);
          botInstance.status = 'error';
          botInstance.lastError = 'Connection timeout - no response from Discord';
        }
      }, 60000); // 60 seconds
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

  // Only setup error handlers if not already set up
  if (!botInstance.handlersSetup) {
    setupErrorHandlers(botInstance);
    botInstance.handlersSetup = true;
  }

  botInstance.status = 'connecting';
  botInstance.account.connect();
  botInstance.lastReconnect = new Date();
  console.log(`[${new Date().toISOString()}] [Bot #${botId}] Reconnecting...`);
  
  // Set timeout to detect hanging connections (60 seconds)
  botInstance.connectionTimeout = setTimeout(() => {
    if (botInstance.status === 'connecting') {
      console.log(`[${new Date().toISOString()}] [Bot #${botId}] ⚠️  WARNING: Connection timeout after 60s`);
      console.log(`  Status is still 'connecting' - no ready or error event received`);
      console.log(`  This usually indicates:`);
      console.log(`    - Invalid or expired user token`);
      console.log(`    - User token instead of bot token (user tokens have restrictions)`);
      console.log(`    - Network/firewall blocking Discord WebSocket`);
      console.log(`    - Discord rate limiting the connection attempts`);
      botInstance.status = 'error';
      botInstance.lastError = 'Connection timeout - no response from Discord';
    }
  }, 60000); // 60 seconds
}

// Get bot instances (for external use if needed)
export function getBotInstances() {
  return botInstances;
}
