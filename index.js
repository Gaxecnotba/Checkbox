import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const oi = new Server(server, {
  connectionStateRecovery: {},
});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

oi.on("connection", (socket) => {
  socket.on("check box changed", (checkboxid, checked) => {
    oi.emit("check box changed", checkboxid, checked);
    console.log("connected");
  });
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
});
