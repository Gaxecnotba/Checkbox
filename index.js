import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import login from "./routes/auth.js";
import passport from "passport";

async function main() {
  const SQLiteStore = connectSqlite3(session);
  const db = await open({
    filename: "checkbox.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
      CREATE TABLE IF NOT EXISTS checkbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checkboxename TEXT UNIQUE ,
        checked BOOLEAN,
        user TEXT
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
  const app = express();
  const server = createServer(app);
  const io = new Server(server);

  const __dirname = dirname(fileURLToPath(import.meta.url));

  app.use(express.static(join(__dirname, "client")));

  const sessionM = session({
    secret: "secret",
    resave: true,
    saveUninitialized: false,
    store: new SQLiteStore({ db: "users.db", dir: "server/db" }),
  });

  app.use(sessionM);

  app.use(passport.authenticate("session"));
  // app.use(passport.session());
  app.use("/", login);

  app.get("/", (req, res) => {
    const session = req.user;
    if (!session) {
      return res.redirect("/client/login.html");
    }
    res.sendFile(join(__dirname, "index.html"));
  });

  function handshake(session) {
    return (req, res, next) => {
      const is_handshake = req._query.sid === undefined;
      if (is_handshake) {
        session(req, res, next);
      } else {
        next();
      }
    };
  }

  io.engine.use(handshake(sessionM));
  io.engine.use(handshake(passport.session()));
  io.engine.use(
    handshake((req, res, next) => {
      if (req.user) {
        next();
      } else {
        res.writeHead(401);
        res.end();
      }
    })
  );

  io.on("connection", (socket) => {
    const userId = socket.request.user.id;
    socket.join(`user:${userId}`);

    // Emit the current state of the checkboxes when a user connects
    db.all("SELECT checkboxename, checked FROM checkbox WHERE user = ?", [
      userId,
    ]).then((rows) => {
      rows.forEach((row) => {
        socket.emit("checkbox changed", {
          id: row.checkboxename,
          checked: row.checked,
          user: userId,
        });
      });
    });

    socket.on("checkbox changed", async (data) => {
      try {
        await db.run(
          `INSERT INTO checkbox (checkboxename, checked, user) VALUES (?, ?, ?)
           ON CONFLICT(checkboxename) DO UPDATE SET checked = excluded.checked, user = excluded.user`,
          data.id,
          data.checked,
          userId
        );
        io.to(`user:${userId}`).emit("checkbox changed", {
          id: data.id,
          checked: data.checked,
          user: userId,
        });
      } catch (err) {
        console.error("Something went wrong", err);
      }
    });
  });

  server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
  });
}
main();
