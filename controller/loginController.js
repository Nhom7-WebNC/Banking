var express = require("express");
var router = express.Router();
const userModel = require("../models/userModel");
const accountModel = require("../models/accountModel");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/default.json");
const auth = require("../middlewares/auth.mdw");
const customerController = require("./customerController");
module.exports = {
  getToken: function (req, res) {
    console.log("getTOken");
    const refreshToken = req.body.refreshToken;
    const username = req.body.username;
    userModel.findOne("username", username).then(async (rows, err) => {
      if (rows.length <= 0) {
        console.log("rows", rows);
        res.status(401).json({ msg: "refresh token hết hạn vui lòng đăng nhập lại" });
        return;
      } else {
        const userFind = rows[0];
        if (refreshToken == userFind.token && auth.refreshTokenExpired(userFind.expries_at) != true) {
          const user = {
            username: username,
            id: userFind.id,
            role: userFind.role_name,
          };
          const accessToken = await auth.generateAuthToken(user);

          const refreshToken = await auth.generateRefreshToken(user);
          res.status(200).json({ accessToken: accessToken, refreshToken: refreshToken });
        } else {
          console.log("rows", rows);

          res.status(401).json({ msg: "refresh token hết hạn vui lòng đăng nhập lại" });
        }
      }
    });
  },

  signup: function (req, res) {
    const password = req.body.password;

    const user = userModel.findOne("username", req.body.username).then((rows) => {
      if (rows.length > 0) {
        res.status(403).json({ msg: "tai khoan da ton tai" });
      } else {
        bcrypt.genSalt(10, async (err, salt) => {
          bcrypt.hash(password, salt, function (err, hash) {
            passwordHash = hash;

            const newUserMysql = {
              username: req.body.username,
              password: passwordHash,
              name: req.body.name,
              phone_number: req.body.phone_number,
              email: req.body.email,
              birthday: req.body.birthday,
              address: req.body.address,
              gender: req.body.gender,
              role_name: req.body.role_name,
              personal_number: req.body.personal_number,
            };
            userModel.add(newUserMysql);
            return res.status(201).json("dang ki thanh cong" + { newUserMysql });
          });
        });
      }
    });
  },
  login: function (req, res) {
    const username = req.body.username;
    const password = req.body.password;
    userModel.findOne("username", username).then(async (rows, err) => {
      if (rows.length <= 0) {
        res.status(401).json({ msg: "đăng nhập không thành công" });
      } else {
        const compare = bcrypt.compareSync(password, rows[0].password);
        const user = { username: username, id: rows[0].id, role: rows[0].role_name };
        console.log("userlogin", user);
        if (compare) {
          const accessToken = auth.generateAuthToken({ user });
          const refreshToken = auth.generateRefreshToken({ user });

          const accounts = await accountModel.findOne("user_id", rows[0].id);
          var account_number = 0;
          console.log(accounts);
          if (accounts.length > 0) {
            account_number = accounts[0].checking_account_number;
          }

          res.status(200).json({
            account_number: account_number,
            token: accessToken,
            user: user,
          });

          // .then((rows) => {
          //   res.status(200).json({
          //     accessToken: accessToken,
          //     refreshToken: rows,
          //   });
          // });
        } else {
          res.status(401).json({ msg: "đăng nhập không thành công" });
        }
      }
    });
  },
};
