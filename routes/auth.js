const express = require("express");
const User = require("../models/user");
const { body } = require("express-validator");
const authController = require("../controllers/auth");
const isAuth = require("../middlewares/is-auth");

const router = express.Router();

router.get("/status", isAuth, authController.getStatus);

router.put(
  "/signup",
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom((value, { req }) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject("email address already exist!");
          }
          return Promise.resolve();
        });
      })
      .normalizeEmail(),
    body("password").trim().isLength({ min: 5 }),
    body("name").trim().not().isEmpty(),
  ],
  authController.signup
);

router.post("/login", authController.login);

router.patch(
  "/status",
  isAuth,
  [body("status").trim().not().isEmpty()],
  authController.updateUserStatus
);
module.exports = router;
