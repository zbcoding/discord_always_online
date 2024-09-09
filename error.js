import fetch from 'node-fetch';

export async function sendError(errorMessage) {
    const webhookURL = process.env["WEBHOOK_URL"];
      await fetch(webhookURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: errorMessage }),
      });
      console.log("Sent error notification to Discord.");
}

export async function sendLowError(lowErrorMessage) {
    const webhookURL = process.env["WEBHOOK_URL_LOW"];
    await fetch(webhookURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: lowErrorMessage }),
    });
    console.log("Sent low level error notification to Discord.");
}