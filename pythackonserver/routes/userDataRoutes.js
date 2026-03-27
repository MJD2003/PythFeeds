const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/userDataController");

router.get("/:key", ctrl.get);
router.put("/:key", ctrl.put);
router.delete("/:key", ctrl.remove);

module.exports = router;
