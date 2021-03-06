var express = require("express");

const accountModel = require("../models/accountModel");
var router = express.Router();
const sendOTPController = require("../controller/sendOTPController");
const customerController = require("../controller/customerController");
const loginController = require("../controller/loginController");
const jwt = require("jsonwebtoken");
const employeeController = require("../controller/employeeController");
const transactionController = require("../controller/transactionController");
const receiverListController = require("../controller/receiverListController");
const debtController = require("../controller/debtReminderController");
const config = require("../config/default.json");
const adminController = require("../controller/adminController");

router.get("/", authenticateToken, async function (req, res) {
  accountModel.updateCheckingMoney(3000001, 1234);
  res.json("Welcome to userRoute Sucess");
});

//nhân viên

router.post("/employee/create-account", employee, employeeController.createAccount);
router.get("/employee", employee, employeeController.getAll);
router.get("/transaction-history", employee, transactionController.getAll);
router.get("/employee/get-transaction/:accountNumber", employee, employeeController.getTransaction);
router.post("/employee/recharge", employee, employeeController.recharge);

//chuyển tiền, nhận tiền (Customer)
router.get("/customers/infoAccount", customer, customerController.infoAccount);
router.post("/customers/getAccount", customer, customerController.getAccount);
router.post("/customers/sendOTP", customer, sendOTPController.sendOTP);
router.post("/customers/transferSameBank", customer, transactionController.TransferSameBank);
router.post("/customers/partnerBankDetail", customer, transactionController.partnerBankDetail);
router.post("/customers/transferOtherBank", customer, transactionController.TransferOtherBank);
router.post("/customers/add-receiver", customer, receiverListController.add);
router.post("/customers/get-transaction", customer, customerController.getTransaction);

//receiver List
router.post("/customers/getReceiverList", customer, receiverListController.getById);
router.post("/customers/deleteReceiverList", customer, receiverListController.delete);
router.post("/customers/updateReceiverList", customer, receiverListController.update);
router.post("/customers/getAllReceiver", customer, receiverListController.getAll);

//PGP bank
router.post("/accounts/receive", transactionController.receive);
router.post("/accounts/PPNBankDetail", transactionController.myBankDetail);

//login, đổi mk, quên mật khẩu
router.post("/auth/forgotPassword", loginController.forgotPassword);
router.post("/auth/changePassword", loginController.changePassword);
router.post("/login", loginController.login);
router.post("/login/getToken", loginController.getToken);
router.get("/generatePGP", customerController.generatePGP);
router.post("/sendOTP_username", sendOTPController.sendOTP_username);

//sửa thông tin nhân viên
router.get("/admin/manage-employee", admin, adminController.manager);
router.post("/admin/create-account", admin, adminController.createAccount);
router.get("/admin/delete/:id", admin, adminController.delete);
router.post("/admin/update", admin, adminController.update);
router.post("/admin/transactions", admin, adminController.getTransaction);

//nhắc nợ
router.post("/customers/create-debt", customer, debtController.createDebt);
router.post("/customers/get-debt", customer, debtController.getListDebt);
router.post("/customers/cancel-debt", customer, debtController.cancelDebt);
router.post("/customers/pay-debt", customer, debtController.payDebt);

function customer(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(403);
  jwt.verify(token, "access", (err, resp) => {
    if (err) return res.sendStatus(403);

    if (resp.user.role == "customer") {
      req.user = resp.user;
      next();
    } else {
      res.sendStatus(403);
    }
  });
  return;
}

function employee(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(403);
  jwt.verify(token, "access", (err, resp) => {
    if (err) return res.sendStatus(403);

    if (resp.user.role == "employee") {
      req.user = resp.user;
      next();
    } else {
      res.sendStatus(403);
    }
  });
  return;
}
function admin(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(403);
  jwt.verify(token, "access", (err, resp) => {
    if (err) return res.sendStatus(403);

    if (resp.user.role == "admin") {
      req.user = resp.user;
      next();
    } else {
      res.sendStatus(403);
    }
  });
  return;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return res.sendStatus(401);
  jwt.verify(token, "access", (err, user) => {
    if (err) return res.sendStatus(403);
    // req.user = user;
    next();
  });
}

module.exports = router;
