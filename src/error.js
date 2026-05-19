import fetch from 'node-fetch';

/**
 * Escape Discord markdown formatting characters so messages render as plain text.
 * Escapes: \ * _ ~ | ` > # - [ ] ( )
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeDiscordMarkdown(text) {
  if (!text) return text;
  return text.replace(/[\\*_~|`>#\-\[\]()]/g, '\\$&');
}

/**
 * Send a notification to Discord webhook
 * @param {string} webhookURL - Discord webhook URL
 * @param {string} message - Message to send
 * @param {string} level - Error level for logging (e.g., 'error', 'low', 'info')
 */
async function sendWebhookNotification(webhookURL, message, level = 'error') {
  if (!webhookURL) {
    console.warn(`No webhook URL configured for ${level} level notifications`);
    return;
  }

  try {
    await fetch(webhookURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: escapeDiscordMarkdown(message) }),
    });
    console.log(`Sent ${level} level notification to Discord`);
  } catch (err) {
    console.error(`Failed to send ${level} notification to Discord:`, err.message);
  }
}

/**
 * Send high-priority error notification to Discord
 * @param {string} errorMessage - Error message to send
 */
export async function sendError(errorMessage) {
  const webhookURL = process.env.WEBHOOK_URL;
  await sendWebhookNotification(webhookURL, errorMessage, 'error');
}

/**
 * Send low-priority error notification to Discord
 * @param {string} lowErrorMessage - Low-priority error message to send
 */
export async function sendLowError(lowErrorMessage) {
  const webhookURL = process.env.WEBHOOK_URL_LOW;
  await sendWebhookNotification(webhookURL, lowErrorMessage, 'low');
}

/**
 * Send informational notification to Discord (startup, reconnect success, etc.)
 * Uses the low-priority webhook to avoid competing with real error alerts
 * @param {string} infoMessage - Info message to send
 */
export async function sendInfo(infoMessage) {
  const webhookURL = process.env.WEBHOOK_URL_LOW || process.env.WEBHOOK_URL;
  await sendWebhookNotification(webhookURL, infoMessage, 'info');
}
