require('dotenv').config();
const express = require("express");
const server = express();

server.get('/favicon.ico', (req, res) => res.status(204));

server.all("/", (req, res) => {
  var date = Date();
  res.send(`Your account is alive! ${date}`);
});

server.listen(process.env.PORT || 3000)

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