const keepAlive = require("./server");
const { connectBot } = require("./connect");

connectBot();
keepAlive();
