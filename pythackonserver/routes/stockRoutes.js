const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/stockController");

router.get("/", ctrl.list);
router.get("/stream/sse", ctrl.stream);
router.get("/:ticker", ctrl.detail);

module.exports = router;
