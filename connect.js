import dotenv from 'dotenv';
import Eris from 'eris';
import { sendError, sendLowError } from './error';
dotenv.config();

const account = new Eris(process.env["TOKEN"]);

// Export the username
export function getUsername() {
  return account.user ? account.user.username : undefined;
}

// Export the connect function
export function connectBot() {
  account.on("error", async (err) => {
    let errorMessage = `Account: ${getUsername()} `;
    if (err.toString().includes("Error: Invalid token")) {
      errorMessage += `An error occurred in the Discord bot. Invalid token.\n`;
      sendError(errorMessage);
    } else if (
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
      /*other unknown errors can be sent to low importance discord webhook*/
      errorMessage += `An error occurred in the Discord bot. ${err}\n`;
      sendLowError(errorMessage);
    }
  });
  account.connect();
}
