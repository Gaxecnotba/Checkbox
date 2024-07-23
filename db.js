import sqlite3 from "sqlite3";
import crypto from "crypto";

const db = new sqlite3.Database("db/users.db");

function createTable() {
  db.serialize(function () {
    db.run(
      "CREATE TABLE IF NOT EXISTS users ( \
         id INTEGER PRIMARY KEY, \
         username TEXT UNIQUE, \
         hashed_password BLOB, \
         salt BLOB, \
         name TEXT, \
         email TEXT UNIQUE, \
         email_verified INTEGER \
       )"
    );
    db.run(
      "CREATE TABLE IF NOT EXISTS federated_credentials ( \
      id INTEGER PRIMARY KEY, \
      user_id INTEGER NOT NULL, \
      provider TEXT NOT NULL, \
      subject TEXT NOT NULL, \
      UNIQUE (provider, subject) \
    )"
    );

    db.run(
      "CREATE TABLE IF NOT EXISTS todos ( \
      id INTEGER PRIMARY KEY, \
      owner_id INTEGER NOT NULL, \
      title TEXT NOT NULL, \
      completed INTEGER \
    )"
    );
  });
}

function addUser(username, password) {
  const salt = crypto.randomBytes(16);
  const hashedPassword = crypto.pbkdf2Sync(
    password,
    salt,
    310000,
    32,
    "sha256"
  );
  db.run(
    "INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)",
    [username, hashedPassword, salt]
  );
}

function deleteRows() {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM users", (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export { db, createTable, addUser };
