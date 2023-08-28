const express = require("express");
// const fs = require('fs');

const server = express();

server.all("/", (req, res) => {
  var date = Date();
  res.send(`Your account is alive! ${date}`);
});

function keepAlive() {
  server.listen(3000, () => {
    var date = Date();
    console.log("Server is Ready!", date);
  });
}

module.exports = keepAlive;