# discord_always_online
Keeps the online status of discord profile online (green icon) no matter how you are using the application on desktop/mobile.

Ways to use this:
- a) Use with uptimerobot and replit to automate the script
- b) use another node service like onrender with a cron job/pinger (free online cronjob).
You'll need to add .env if not using replit.

You'll need a discord webhook bot set up with credentials.
You can get your discord token from the developer console local storage. Sometimes starts with "Mfa", or is similar to this example: Mjg2VoidOTY1MVoidDM1OTI0.G3g32e.2ZhtTR6RMGiGz_FTd-85kLc1oHtPA212LZOETg

If using replit, create secret keys in replit or edit the code to add them.
e.g.: for this line `const webhookURL = process.env['WEBHOOK_URL'];`, you would create a secret in Replit with the key: `WEBHOOK_URL` and the value: `the webhook url that your Discord Webhook Bot uses`.

If the code stops (e.g. you changed your discord password which requires you to update the auth key), an error message is sent to a notification channel in discord via discord webhook/bot.

Also read all the information in the code comments.

You can find your mfa token by searching "mfa" in the developer console on the application tab. Discord likes to hide this after loading so if you refresh the page then click "x" to stop the refresh you can catch and copy the mfa token value before it disappears. then put this token in replit secrets or you put your token in a .env file to secure Alternatively: Network tab, filter by /api, search for library in the list, check for authorization: key in the header tab below.

- Create a discord webhook and then use to notify you if there's issue getting your account, e.g. to refresh your account token
- Put the webhook_url in the replit secrets.
- webhook_url_low is another url for noncritical errors sent to muted discord channel, make another webhook or use the same webhook_url and channel.


```npm i```
```node .\index.js```
