require('dotenv').config();
const express = require("express");
const server = express();
const { username } = require('./index');

server.get('/favicon.ico', (req, res) => res.status(204));
server.all("/", (req, res) => {
  const date = Date();
  console.log("Just got a request!");
  const firstUserNameChar = username ? `${username[0]}` : '?';
  res.send(`Your account ${firstUserNameChar} is alive! ${date}`);
});

function keepAlive() {
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
    console.error('Server error:', err);
  });
}

module.exports = keepAlive;