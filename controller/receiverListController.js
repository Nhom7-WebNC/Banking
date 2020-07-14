const receiverModel = require("../models/receiverModel");
module.exports = {
  add: async function (req, res, next) {
    const newReceiver = {
      user_id: req.body.user_id,
      name_reminiscent: req.body.name_reminiscent,
      reminder_account_number: req.body.reminder_account_number,
      bank_code: req.body.bank_code,
    };
    receiverModel.add(newReceiver);

    res.status(200).json({ msg: "add receiver success" });
  },
  getById: async function (req, res, next) {
    receiverModel.findByUserIdAndBankCode(req.body.user_id, req.body.bank_code).then(async (rows, err) => {
      if (err) {
        res.status(400).json({ msg: "get Receiver list have no data" });
      }
      res.status(200).json({ rows });
    });
  },
};
