const dataService = require("../services/dataService");

async function protocols(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const data = await dataService.getProtocols(limit);
    res.json(data);
  } catch (err) { next(err); }
}

async function chainsTVL(req, res, next) {
  try {
    const data = await dataService.getChainsTVL();
    res.json(data);
  } catch (err) { next(err); }
}

async function tvlHistory(req, res, next) {
  try {
    const data = await dataService.getTVLHistory();
    res.json(data);
  } catch (err) { next(err); }
}

async function stablecoins(req, res, next) {
  try {
    const data = await dataService.getStablecoins();
    res.json(data);
  } catch (err) { next(err); }
}

async function yields(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const chain = req.query.chain || "";
    const data = await dataService.getYields(limit, chain);
    res.json(data);
  } catch (err) { next(err); }
}

async function bridges(req, res, next) {
  try {
    const data = await dataService.getBridges();
    res.json(data);
  } catch (err) { next(err); }
}

async function whaleAlerts(req, res, next) {
  try {
    const data = await dataService.getWhaleAlerts();
    res.json(data);
  } catch (err) { next(err); }
}

async function economicCalendar(req, res, next) {
  try {
    const data = await dataService.getEconomicCalendar();
    res.json(data);
  } catch (err) { next(err); }
}

module.exports = { protocols, chainsTVL, tvlHistory, stablecoins, yields, bridges, whaleAlerts, economicCalendar };
