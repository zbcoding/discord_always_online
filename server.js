import dotenv from 'dotenv';
import express from 'express';
import { getUsername } from './connect.js';
import { sendError } from './error.js';

dotenv.config();
const server = express();

server.get('/favicon.ico', (req, res) => res.status(204));
server.all("/", (req, res) => {
  const date = Date();
  console.log("Just got a request!");
  const username = getUsername();
  const firstUserNameChar = username ? `"${username[0]}..."` : '?';
  res.send(`Your account ${firstUserNameChar} is alive! ${date}`);
});

export function keepAlive() {
  const port = process.env.PORT || 3000;
  server.listen(port, '0.0.0.0', (err) => {
    if (err) {
      console.error('Error starting server:', err);
    } else {
      var date = Date();
      console.log("Server is Ready!", date);
    }
  });
  server.on('error', (err) => {
    sendError(err);
    console.error('Server error:', err);
  });
}
