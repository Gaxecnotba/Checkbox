import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import session from "express-session";
import passport from "passport";
import SQLiteStore from "connect-sqlite3";

async function setupDB() {
  const db = await open({
    filename: "checkbox.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS checkbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checkboxename TEXT UNIQUE,
        checked BOOLEAN
    );
  `);

  for (let i = 1; i <= 100; i++) {
    try {
      await db.run(
        "INSERT INTO checkbox (checkboxename, checked) VALUES (?, ?)",
        `checkbox-${i}`,
        false
      );
    } catch (err) {
      if (err.code !== "SQLITE_CONSTRAINT") {
        console.error("Something went wrong inserting checkboxes", err);
      }
    }
  }

  return db;
}

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(join(__dirname, "client")));

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
    store: new SQLiteStore({ db: "users.db", dir: "./server/db/users.db" }),
  })
);

app.use(passport.authenticate("session"));
app.use(passport.initialize());
app.use(passport.session());
import router from "./routes/auth.js";
app.use("/", router);

setupDB().then((db) => {
  io.on("connection", (socket) => {
    console.log("A user connected");
    db.all("SELECT checkboxename, checked FROM checkbox").then((rows) => {
      rows.forEach((row) => {
        socket.emit("checkbox changed", {
          id: row.checkboxename,
          checked: row.checked,
        });
      });
    });

    socket.on("checkboxes-names", async (data) => {
      try {
        await db.run(
          "INSERT INTO checkbox (checkboxename, checked) VALUES (?, ?)",
          data.name,
          data.checked
        );
      } catch (err) {
        console.error("Something went wrong", err);
      }
    });

    socket.on("checkbox changed", async (data) => {
      try {
        await db.run(
          "UPDATE checkbox SET checked = ? WHERE checkboxename = ?",
          data.checked,
          data.id
        );

        console.log(
          `Received "checkbox changed" event: ${data.id} is now ${data.checked}`
        );
        socket.broadcast.emit("checkbox changed", data);
      } catch (err) {
        console.error("Something went wrong updating the checkbox", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("A user disconnected");
    });
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
