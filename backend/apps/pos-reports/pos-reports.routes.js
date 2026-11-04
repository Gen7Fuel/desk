const express = require("express");
const { authenticate, requirePermission } = require("../../middleware/auth");
const service = require("./pos-reports.service");
const router = express.Router();
router.use(authenticate, requirePermission("hub.shifts", "read"));
const write = requirePermission("hub.shifts", "update");
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (!e.status) console.error("[pos/reports]", e);
    res.status(e.code === 11000 ? 409 : e.status || 500).json({
      message:
        e.code === 11000
          ? "This report or site changed. Reload and retry."
          : e.status
            ? e.message
            : "Unable to complete the POS report request.",
    });
  }
};
router.get(
  "/sites",
  handle(async (_req, res) => {
    let locations = [],
      rawLocations = [],
      locationIssue = "";
    try {
      rawLocations = await service.listLocations();
      locations = rawLocations.map((l) => ({
        id: String(l._id),
        name: l.site || l.stationName || l.name || "",
        timezone: l.timezone || "",
      }));
    } catch {
      locationIssue = "Hub locations are unavailable. Retry shortly.";
    }
    res.json({
      sites: await service.listSites(rawLocations),
      locations,
      locationIssue,
    });
  }),
);
router.put(
  "/sites",
  write,
  handle(async (req, res) => {
    res.json(await service.saveSite(req.body));
  }),
);
router.post(
  "/scan",
  write,
  handle(async (_req, res) => {
    res.json(await service.scan());
  }),
);
router.get(
  "/scan",
  handle(async (_req, res) => {
    res.json(service.scanStatus());
  }),
);
router.get(
  "/reports",
  handle(async (req, res) => {
    res.json(await service.listReports(req.query));
  }),
);
router.get(
  "/reports/:site/:date",
  handle(async (req, res) => {
    res.json(await service.detail(req.params.site, req.params.date));
  }),
);
router.post(
  "/reports/:site/:date/accept",
  write,
  handle(async (req, res) => {
    res.json(
      await service.accept(
        req.params.site,
        req.params.date,
        req.body,
        req.user,
      ),
    );
  }),
);
module.exports = router;
