const router = require("express").Router();
const aiController = require("../controllers/aiController");

router.post("/analyze", aiController.analyze);
router.get("/market-brief", aiController.marketBrief);
router.post("/chat", aiController.chat);
router.post("/chat/stream", aiController.chatStream);
router.post("/portfolio-insights", aiController.portfolioInsights);
router.post("/correlation-insights", aiController.correlationInsights);
router.post("/simplify", aiController.simplify);
router.post("/summarize-news", aiController.summarizeNews);
router.post("/digest", aiController.digest);
router.get("/digest/dates", aiController.digestDates);
router.post("/classify-sentiment", aiController.classifySentiment);
router.get("/mood", aiController.mood);

module.exports = router;
