const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/alertController");

router.get("/", ctrl.list);
router.post("/", ctrl.create);
router.delete("/:id", ctrl.remove);
router.put("/:id/trigger", ctrl.trigger);

module.exports = router;
