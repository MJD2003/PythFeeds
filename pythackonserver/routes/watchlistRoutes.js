const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/watchlistController");

router.get("/", ctrl.list);
router.post("/", ctrl.add);
router.delete("/:coinId", ctrl.remove);

module.exports = router;
