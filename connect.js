require("dotenv").config();
const Eris = require("eris");

const account = new Eris(process.env["TOKEN"]);

// Export the username
function getUsername() {
  return account.user ? account.user.username : undefined;
}

// Export the connect function
function connectBot() {
  account.on("error", async (err) => {
    let message = "";
    if (err.toString().includes("Error: Invalid token")) {
      message = `An error occurred in the Discord bot. 
                  Probably invalid token. 
                  \n`;

      const webhookURL = process.env["WEBHOOK_URL"];

      const fetch = await import("node-fetch");

      await fetch.default(webhookURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: message }),
      });
      console.log("Sent error notification to Discord.");
    } else if (
      /*TODO refactor */
      /*common errors you can choose to ignore*/
      err
        .toString()
        .includes(
          "TypeError: Cannot read properties of undefined (reading 'add')"
        )
    ) {
      console.log(`An error occurred in the Discord bot. ${err}`);
    } else if (
      err
        .toString()
        .includes(
          "TypeError: Cannot read properties of undefined (reading 'get')"
        )
    ) {
      console.log(`An error occurred in the Discord bot. ${err}`);
    } else if (err.toString().includes("Error: Connection reset by peer")) {
      console.log(`An error occurred in the Discord bot. ${err}`);
    } else {
      /*other unknown errors can be sent to low importance discord channel*/
      message = `An error occurred in the Discord bot. ${err}\n`;

      const webhookURL = process.env["WEBHOOK_URL_LOW"];

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
}

module.exports = {
  connectBot,
  getUsername,
};
