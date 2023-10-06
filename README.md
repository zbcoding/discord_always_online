# discord_always_online
Keeps the online status of discord profile online (green icon)

Use with uptimerobot and replit to automate the script.

Create secret keys in replit or edit the code to add them.
e.g.: for this line `const webhookURL = process.env['WEBHOOK_URL'];`, you would create a secret in Replit with the key: `WEBHOOK_URL` and the value: `the webhook url that your Discord Webhook Bot uses`.

If the code stops (e.g. you changed your discord password which requires you to update the auth key), an error message is sent to a notification channel in discord via discord webhook/bot.

More information in the code comments
