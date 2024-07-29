import express from "express";
import passport from "passport";
import GoogleStrategy from "passport-google-oidc";
import path from "path";
import { db } from "../db.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    cb(null, { id: user.id, username: user.name, name: user.name });
    console.log("serializeUser", user);
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/oauth2/redirect/google",
      scope: ["profile"],
    },
    function verify(issuer, profile, cb) {
      db.get(
        "SELECT * FROM federated_credentials WHERE provider = ? AND subject = ?",
        [issuer, profile.id],
        function (err, row) {
          if (err) {
            return cb(err);
          }
          if (!row) {
            db.run(
              "INSERT INTO users (name) VALUES (?)",
              [profile.displayName],
              function (err) {
                if (err) {
                  return cb(err);
                }

                const id = this.lastID;
                db.run(
                  "INSERT INTO federated_credentials (user_id, provider, subject) VALUES (?, ?, ?)",
                  [id, issuer, profile.id],
                  function (err) {
                    if (err) {
                      return cb(err);
                    }
                    const user = {
                      id: id,
                      name: profile.displayName,
                    };
                    return cb(null, user);
                  }
                );
              }
            );
          } else {
            db.get(
              "SELECT * FROM users WHERE id = ?",
              [row.user_id],
              function (err, row) {
                if (err) {
                  return cb(err);
                }
                if (!row) {
                  return cb(null, false);
                }
                return cb(null, row);
              }
            );
          }
        }
      );
    }
  )
);

router.get("/login", function (req, res) {
  res.sendFile(path.join(__dirname, "../client/login.html"));
});

router.get("/login/federated/google", passport.authenticate("google"));

router.get(
  "/oauth2/redirect/google",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/");
  }
);

router.post("/logout", function (req, res) {
  req.logOut(function (err) {
    if (err) {
      return res.status(500).send("Error logging out");
    } else {
      res.redirect("/");
    }
  });
});

export { router as authRouter };
