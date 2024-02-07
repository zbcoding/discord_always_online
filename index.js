const Eris = require("eris");
//Eris is a package for interacting with Discord
const keepAlive = require("./server");

keepAlive();

/*you can find your mfa token by searching "mfa" in the developer console on the application tab. discord likes to hide this after loading so if you refresh the page then click "x" to stop the refresh you can catch and copy the mfa token value before it disappears. then put this token in replit secrets or you put your token in a .env file to secure Alternatively: Network tab, filter by /api, search for library in the list, check for authorization: key
in the header tab below
*/

const account = new Eris(process.env['TOKEN']);

/*create a discord webhook and then use to notify you if there's issue getting your account, e.g. to refresh your account token*/
/*Put the webhook_url in the replit secrets. webhook_url_low is another url for noncritical errors sent to muted discord channel, make another webhook or use the same webhook_url and channel*/

account.on("error", async (err) => {
    let message = "";
    if (err.toString().includes("Error: Invalid token")) {
        message = `An error occurred in the Discord bot. 
                  Probably invalid token. 
                  See replit.\n`;

        const webhookURL = process.env['WEBHOOK_URL'];

        const fetch = await import("node-fetch");

        await fetch.default(webhookURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ content: message }),
        });

        console.log("Sent error notification to Discord.");
    }
    /*TODO refactor */
    /*common errors to discord bot message outputs*/
    else if (err.toString().includes("TypeError: Cannot read properties of undefined (reading 'add')")) {
        console.log(`An error occurred in the Discord bot. ${err}`);
    }
    else if (err.toString().includes("TypeError: Cannot read properties of undefined (reading 'get')")) {
        console.log(`An error occurred in the Discord bot. ${err}`);
    }
    else if (err.toString().includes("Error: Connection reset by peer")) {
        console.log(`An error occurred in the Discord bot. ${err}`);
    }
    else {
        message = `An error occurred in the Discord bot. ${err}\n`;

        const webhookURL = process.env['WEBHOOK_URL_LOW'];

        const fetch = await import("node-fetch");

        await fetch.default(webhookURL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ content: message }),
        });

        console.log("Sent error notification to Discord.");

    }
});

account.connect();