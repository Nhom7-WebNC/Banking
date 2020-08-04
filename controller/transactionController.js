const transactionModel = require("../models/transactionModel");
const express = require("express");
const bcrypt = require("bcryptjs");
const accountModel = require("../models/accountModel");
const otpModel = require("../models/otpModel");
const userModel = require("../models/userModel");
const receiverModel = require("../models/receiverModel");
var mailSender = require("../config/mail");
const config = require("../config/default.json");
const process = require("../config/process.config");
const NodeRSA = require("node-rsa");
var superagent = require("superagent");
const hash = require("object-hash");
const moment = require("moment");
const crypto = require("crypto");
const openpgp = require("openpgp");
const axios = require("axios");
const kbpgp = require("kbpgp");
const fs = require("fs");
var router = express.Router();
module.exports = {
  partnerBankDetail: async function (req, res) {
    const body = req.body;
    const bank_code = config.auth.bankcode;

    const ts = Date.now();
    const sig = hash.MD5(bank_code + ts + JSON.stringify(body) + config.auth.secretPartnerRSA);
    const headers = { bank_code, sig, ts };

    const partner = req.headers.partner_bank;

    switch (partner) {
      case "TUB":
        superagent
          .post(`${config.auth.apiRoot}/bank-detail`)
          .send(body)
          .set(headers)
          .end((err, result) => {
            const resu = JSON.parse(result.text);
            res.status(200).json({ resu });
          });
        break;
      case "partner34":
        const time = moment().valueOf();
        const hash2 = crypto
          .createHash("sha256")
          .update(time + config.auth.secret)
          .digest("hex");
        const code = config.auth.bankcode;
        const configAxios = {
          headers: {
            "x-time": time,
            "x-partner-code": code,
            "x-signature": hash2,
          },
        };
        axios
          .get("https://banking34.herokuapp.com/api/user/" + body.accNum, configAxios)
          .then(function (response) {
            console.log(response.data);
            const result = response.data;
            return res.status(200).json({ result });
          })
          .catch(function (error) {
            console.log(error.response);
            return res.status(400).send(error.response);
          });
        break;
      default:
        break;
    }
  },

  TransferOtherBank: async function (req, res) {
    const partner_bank = req.headers.partner_bank;
    switch (partner_bank) {
      case "TUB":
        const privateKeyArmored = fs.readFileSync("my_rsa_private.key", "utf8");
        const myKeyPrivate = new NodeRSA().importKey(privateKeyArmored);
        const body2 = req.body;
        const bank_code = "PPNBank";
        const ts = Date.now();
        const hashString = hash.MD5(
          bank_code + ts.toString() + JSON.stringify(req.body) + config.auth.secretPartnerRSA
        );
        var sig = myKeyPrivate.sign(hashString, "hex", "hex");
        const headers = { ts, bank_code, sig };
        const { content, amount, transferer, receiver, payFee } = req.body;
        await accountModel.findOne("checking_account_number", transferer).then((rows) => {
          console.log(rows);
          row = rows[0];
          if (rows.length < 1) {
            res.status(400).json({ msg: "tài khoản không tồn tại" });
          } else {
            if (row.checking_account_amount > amount) {
              superagent
                .post(`${config.auth.apiRoot}/money-transfer`)
                .send(body2)
                .set(headers)
                .end((err, result) => {
                  accountModel.updateCheckingMoney(transferer, row.checking_account_amount - amount);
                  //log
                  //history log
                  let transactionHistory = {
                    sender_account_number: body2.transferer,
                    sender_bank_code: bank_code,
                    receiver_account_number: body2.receiver,
                    //don't have bankcode of receiver
                    receiver_bank_code: "",
                    amount: body2.amount,
                    transaction_fee: 5000,
                    log: body2.transferer + " đã gửi " + body2.amount + " cho " + body2.receiver,
                    message: body2.content,
                    status: 0,
                  };
                  transactionModel.add(transactionHistory);
                  const resu = JSON.parse(result.text);
                  res.status(200).json({ resu });
                });
            } else {
              res.status(400).json({
                message: "Tài khoản không đủ tiền",
                receiver,
              });
            }
          }
        });
        break;
      case "partner34":
        const time = moment().valueOf();
        const body = JSON.stringify(req.body);
        const hash3 = crypto
          .createHash("sha256")
          .update(time + body + config.auth.secret)
          .digest("hex");
        const code = config.auth.bankcode;
        const data = `${req.body.moneyAmount},${req.body.accNum},${time}`;
        const signature = await signData(data);
        // console.log(signature.split("\r\n").join("\\n"));
        const rows = await accountModel.findOne("checking_account_number", transferer);

        if (rows.length < 1) {
          res.status(400).json({ msg: "tài khoản không tồn tại" });
        } else {
          const row = rows[0];
        }

        const configAxios = {
          headers: {
            "x-time": time,
            "x-partner-code": code,
            "x-hash": hash3,
            "x-signature-pgp": signature.split("\r\n").join("\\n"),
          },
        };
        const postBody = req.body;
        axios
          .post("https://banking34.herokuapp.com/api/transfer/update", postBody, configAxios)
          .then(function (response) {
            console.log(response.data);

            accountModel.updateCheckingMoney(transferer, row.checking_account_amount - amount);
            //log
            //history log
            let transactionHistory = {
              sender_account_number: postBody.transferer,
              sender_bank_code: "PPNBank",
              receiver_account_number: postBody.accNum,
              //don't have bankcode of receiver
              receiver_bank_code: "",
              amount: postBody.moneyAmount,
              transaction_fee: 5000,
              log: postBody.transferer + " đã gửi " + postBody.moneyAmount + " cho " + postBody.accNum,
              message: postBody.content,
              status: 0,
            };
            transactionModel.add(transactionHistory);
            return res.status(200).json(response.data);
          })
          .catch(function (error) {
            console.log(error.response);
            return res.status(400).send(error.response);
          });
        break;
      default:
        break;
    }
  },
  myBankDetail: async function (req, res) {
    if (req.body.bank_code == "PPNBank") {
    } else {
      var con = confirm(req);
      if (con == 1) {
        //time #
        return res.status(400).send({
          message: "The request was out of date.", // quá hạn
        });
      }

      if (con == 2) {
        return res.status(400).send({
          message: "You are not one of our partners.",
        });
      }

      if (con == 3) {
        //sig #

        return res.status(400).send({
          message: "The file was changed by strangers." + JSON.stringify(req.headers.sig),
        });
      }
    }

    try {
      const rows_id = await accountModel.findOne("checking_account_number", req.body.account_number);
      if (rows_id.length <= 0) {
        return res.status(403).json({ msg: "Không tìm thấy tài khoản này" });
      }

      const idFind = rows_id[0].user_id;
      const rows = await userModel.findOne("id", idFind);
      console.log(rows_id);
      if (rows.length == 0) {
        return res.status(403).send({
          message: `No user has account number ${req.body.account_number}`,
        });
      } else {
        const ret = {
          account: req.body.account_number,
          name: rows[0].name,
        };
        //update Partner_Call_Log
        const entityUpdateLog1 = {
          bank_code: req.get("bank_code"),
          account_number: req.body.account_number,
          created_at: moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        // const updatePartnerLog1 = await partnerCallLog.add(entityUpdateLog1);

        return res.status(200).send(ret);
      }
    } catch (err) {
      console.log("error: ", err.message);
      return res.status(500).send({ message: "Error." });
    }
  },
  TransferSameBank: async function (req, res) {
    const data = {
      transferer: req.body.transferer,
      receiver: req.body.receiver,
      amount: req.body.amount,
      content: req.body.content,
      payFee: req.body.payFee,
      receiverName: req.body.reminder,
    };
    //kiểm tra tài khoản người gửi
    const account_transfer = await accountModel.findOne("checking_account_number", data.transferer);
    if (account_transfer.length <= 0) {
      res.status(403).json({ msg: "tai khoan nguoi gui khong ton tai" });
    }
    const transferer = account_transfer[0];

    const account_receiver = await accountModel.findOne("checking_account_number", data.receiver);
    if (account_receiver.length <= 0 || data.transferer == data.receiver) {
      res.status(403).json({ msg: "tai khoan nguoi nhan khong ton tai" });
    }
    const receiver = account_receiver[0];
    const transfer_fee = 3000;
    if (transferer.checking_account_amount > data.amount && data.amount > transfer_fee) {
      switch (data.payFee) {
        case "transferer":
          accountModel.updateCheckingMoney(
            transferer.checking_account_number,
            transferer.checking_account_amount - data.amount - transfer_fee
          );
          accountModel.updateCheckingMoney(
            receiver.checking_account_number,
            receiver.checking_account_amount + data.amount
          );
          break;
        case "receiver":
          accountModel.updateCheckingMoney(
            transferer.checking_account_number,
            transferer.checking_account_amount - data.amount
          );
          accountModel.updateCheckingMoney(
            receiver.checking_account_number,
            receiver.checking_account_amount + data.amount - transfer_fee
          );
          break;
        default:
          break;
      }
      let transactionHistory = {
        sender_account_number: transferer.checking_account_number,
        sender_bank_code: "PPNBank",
        receiver_account_number: receiver.checking_account_number,
        //don't have bankcode of receiver
        receiver_bank_code: "PPNBank",
        amount: data.amount,
        transaction_fee: 3000,
        log:
          " Chuyển tiền cùng ngân hàng " +
          transferer.checking_account_number +
          " đã gửi " +
          data.amount +
          " cho " +
          receiver.checking_account_number,
        message: data.content,
        status: 0,
      };
      transactionModel.add(transactionHistory);
      if (req.body.checked == true) {
        const newReceiver = {
          user_id: req.body.user_id,
          name_reminiscent: req.body.reminder,
          reminder_account_number: data.receiver,
          bank_code: "PPNBank",
        };
        receiverModel.add(newReceiver);
      }
      res.status(201).json({ msg: "Chuyển tiền thành công" });
    } else {
      res.status(403).json({ msg: "Số tiền trong tài khoản không đủ" });
    }
  },
  receive: async function (req, res) {
    const { ts, bank_code, sig } = req.headers;

    const private = fs.readFileSync("partner_RSA_private.key", "utf8");
    const privateKey = new NodeRSA().importKey(private);
    const body = req.body;
    const ts2 = moment().valueOf();
    const hashString3 = hash.MD5(bank_code + ts + JSON.stringify(req.body) + config.auth.secret);
    const mySign = privateKey.sign(hashString3, "hex", "hex");
    const public = fs.readFileSync("partner_RSA_public.key", "utf8");
    const publicKey = new NodeRSA().importKey(public);
    const hashString = hash.MD5(bank_code + ts + JSON.stringify(req.body) + config.auth.secret);
    var veri = publicKey.verify(hashString, mySign, "hex", "hex");
    const currentTime = moment().valueOf();

    console.log("ts", ts2);
    console.log("sig", hashString);

    if (currentTime - ts > config.auth.expireTime) {
      console.log("return 1");
      res.status(401).json({ msg: "wrong time" });
    }

    if (bank_code != config.auth.partnerRSA && bank_code != config.auth.partnerPGP) {
      console.log("return 2");
      res.status(401).json({ msg: "wrong bank code" });
    }

    if (!req.body.transferer) {
      console.log("return 4");
      res.status(401).json({ msg: "wrong transferer" });

      res.status(401);
    }

    if (veri != true) {
      return res.status(400).json({
        msg: "Wrong sign.",
      });
    }
    const { content, amount, transferer, receiver, payFee } = req.body;
    switch (bank_code) {
      case "TUB":
        console.log(req.body);
        console.log(receiver);
        accountModel.findOne("checking_account_number", receiver).then((rows, err) => {
          if (rows.length <= 0 || err) {
            res.status(401).json({ msg: "khong tim thay tai khoan nay" });
            return;
          }
          console.log(rows);
          accountModel.updateCheckingMoney(receiver, amount);
          //log
          let transactionHistory = {
            sender_account_number: body.transferer,
            sender_bank_code: bank_code,
            receiver_account_number: body.receiver,
            //don't have bankcode of receiver
            receiver_bank_code: "",
            amount: body.amount,
            transaction_fee: 5000,
            log: body.transferer + " đã gửi " + body.amount + " cho " + body.receiver,
            message: body.content,
            status: 0,
          };
          transactionModel.add(transactionHistory);
          res.status(200).json({ msg: "Chuyển tiền thành công " });
        });
        break;
      case "partner34":
        console.log(req.body);
        console.log(receiver);
        accountModel.findOne("checking_account_number", receiver).then((rows, err) => {
          if (rows.length <= 0 || err) {
            res.status(401).json({ msg: "khong tim thay tai khoan nay" });
            return;
          }
          console.log(rows);
          accountModel.updateCheckingMoney(receiver, amount);
          //log
          let transactionHistory = {
            sender_account_number: body.transferer,
            sender_bank_code: bank_code,
            receiver_account_number: body.receiver,
            //don't have bankcode of receiver
            receiver_bank_code: "",
            amount: body.amount,
            transaction_fee: 5000,
            log: body.transferer + " đã gửi " + body.amount + " cho " + body.receiver,
            message: body.content,
            status: 0,
          };
          transactionModel.add(transactionHistory);
          res.status(200).json({ msg: "Chuyển tiền thành công " });
        });
        break;
      default:
        res.status(403).json({ msg: " Ngan hang lạ chua connect" });
        return;
        break;
    }
  },

  getAll: async function (req, res, next) {
    const data = transactionModel.findAll().then((rows) => {
      console.log(rows);
      res.status(200).json({ rows });
    });
  },
};
async function signData(data) {
  const privateKeyArmored = config.auth.myPrivatePGP;
  const passphrase = config.auth.passphrase; // what the private key is encrypted with
  const {
    keys: [privateKey],
  } = await openpgp.key.readArmored(privateKeyArmored);
  console.log("data", data);
  // console.log("private", privateKeyArmored);
  console.log("private", privateKey);

  const a = await privateKey.decrypt(passphrase);

  const { data: text } = await openpgp.sign({
    message: openpgp.cleartext.fromText(data), // CleartextMessage or Message object
    privateKeys: [privateKey], // for signing
  });

  return text;
}
