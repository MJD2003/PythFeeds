const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/newsController");

router.get("/crypto", ctrl.crypto);
router.get("/stock/:ticker", ctrl.stock);

module.exports = router;
