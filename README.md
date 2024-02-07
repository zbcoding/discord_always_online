# discord_always_online
Keeps the online status of discord profile online (green icon)

Use with uptimerobot and replit to automate the script or use another service with a cron job/pinger.
You'll need to add .env if not using replit.

You'll need a discord webhook bot set up with credentials.
You can get your discord token from the developer console local storage. Sometimes starts with "Mfa", or is similar to this example: Mjg2VoidOTY1MVoidDM1OTI0.G3g32e.2ZhtTR6RMGiGz_FTd-85kLc1oHtPA212LZOETg

Create secret keys in replit or edit the code to add them.
e.g.: for this line `const webhookURL = process.env['WEBHOOK_URL'];`, you would create a secret in Replit with the key: `WEBHOOK_URL` and the value: `the webhook url that your Discord Webhook Bot uses`.

If the code stops (e.g. you changed your discord password which requires you to update the auth key), an error message is sent to a notification channel in discord via discord webhook/bot.

Also read all the information in the code comments.
