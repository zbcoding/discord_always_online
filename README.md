# discord_always_online
Keeps the online status of discord profile online (green icon) no matter how you are using the application on desktop/mobile.

### Ways to use this:
- a) Use with uptimerobot and replit to automate the script
- b) use another node service like onrender with a cron job/pinger (free online cronjob).
- c) an app platform like Digital Ocean app platform or your own server

You'll need to add values to .env if not using replit or app platform service.
If using replit, create secret keys in replit or edit the code to add them.
e.g.: for this line `const webhookURL = process.env['WEBHOOK_URL'];`, you would create a secret in Replit with the key: `WEBHOOK_URL` and the value: `the webhook url that your Discord Webhook Bot uses`.

### How to find the discord mfa token:
You'll need a discord webhook bot set up with credentials.
You can get your discord token from the developer console local storage. Sometimes starts with "Mfa", or is similar to this example: Mfa.2VoidOTY1MVoidDM1OTI0.G3g32e.2ZhtTR6RMGiGz_FTd-85kLc11111233112LZOETg
You can find your mfa token by searching "mfa" or "token" in the developer console on the application tab. Check the local storage. Alternatively: Network tab, filter by /api, search for library in the list, check for authorization: key in the header tab below. Discord likes to hide the token after loading the page. In order to copy the token, you can try stopping the page from loading or using the network tab in developer settings to slow the page load down. Put the token in replit secrets, the app platform's environment variables, or in a .env file.

### Discord notifications for errors:
If the code stops (e.g. you changed your discord password which requires you to update the auth key), an error message is sent to a notification channel in discord via discord webhook/bot.
- Create a discord webhook for notifications, e.g. to refresh your account token
- Put the webhook_url in the environment variables/secrets.
- webhook_url_low is another discord hook for non-critical errors, you can either use another webhook or use the same webhook_url.
- Port can be edited by adding `PORT` in .env (default: 3000)

```npm i```
```node .\index.js```
