const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const models = require("./pos-reports.model");
const service = require("./pos-reports.service");
const locationsClient = require("./pos-reports.locations");

// Mongo model methods are replaced with an in-memory store; parsing, routes,
// JWT/permissions, source files, archive publication and deletion run for real.
function memoryModel(model) {
  const rows = [];
  const clone = (v) => structuredClone(v);
  const matches = (row, query) =>
    Object.entries(query).every(([key, value]) => {
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("$in" in value)
          return Array.isArray(row[key])
            ? row[key].some((v) => value.$in.includes(v))
            : value.$in.includes(row[key]);
        if ("$lt" in value) return row[key] < value.$lt;
        if ("$gte" in value && row[key] < value.$gte) return false;
        if ("$lte" in value && row[key] > value.$lte) return false;
        return true;
      }
      return Array.isArray(row[key])
        ? row[key].includes(value)
        : row[key] === value;
    });
  const query = (get) => ({
    sort() {
      return this;
    },
    select() {
      return this;
    },
    lean: async () => clone(get()),
    then(resolve, reject) {
      return Promise.resolve(clone(get())).then(resolve, reject);
    },
  });
  vi.spyOn(model, "find").mockImplementation((filter = {}) =>
    query(() => rows.filter((r) => matches(r, filter))),
  );
  vi.spyOn(model, "findOne").mockImplementation((filter) =>
    query(() => rows.find((r) => matches(r, filter)) || null),
  );
  vi.spyOn(model, "exists").mockImplementation(
    async (filter) => rows.find((r) => matches(r, filter)) || null,
  );
  const upsert = (filter, update, options = {}) => {
    let row = rows.find((r) => matches(r, filter));
    let inserted = false;
    if (!row && options.upsert) {
      if (filter._id && rows.some((r) => r._id === filter._id))
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      row = {
        _id: `${model.modelName}-${rows.length + 1}`,
        ...Object.fromEntries(
          Object.entries(filter).filter(([, v]) => typeof v !== "object"),
        ),
        ...clone(update.$setOnInsert || {}),
      };
      rows.push(row);
      inserted = true;
    }
    if (row) Object.assign(row, clone(update.$set || {}));
    return { row, matchedCount: row && !inserted ? 1 : 0 };
  };
  vi.spyOn(model, "updateOne").mockImplementation(
    async (filter, update, options) => upsert(filter, update, options),
  );
  vi.spyOn(model, "findOneAndUpdate").mockImplementation(
    (filter, update, options) => {
      let value;
      try {
        value = upsert(filter, update, options).row || null;
      } catch (e) {
        return Promise.reject(e);
      }
      return query(() => value);
    },
  );
  vi.spyOn(model, "create").mockImplementation(async (data) => {
    const row = {
      _id: `${model.modelName}-${rows.length + 1}`,
      archived: false,
      ...clone(data),
    };
    rows.push(row);
    return clone(row);
  });
  vi.spyOn(model, "deleteOne").mockImplementation(async (filter) => {
    const index = rows.findIndex((r) => matches(r, filter));
    if (index >= 0) rows.splice(index, 1);
    return { deletedCount: index >= 0 ? 1 : 0 };
  });
  return rows;
}
const storeId = "D68C818D4175E5A209ED";
const eventXml = (id, date = "2026-11-03", time = "12:00:00") =>
  `<SaleEvent><TransactionID>${id}</TransactionID><EventSequenceID>1</EventSequenceID><RegisterID>R1</RegisterID><TillID>1</TillID><BusinessDate>2026-11-02</BusinessDate><EventEndDate>${date}</EventEndDate><EventEndTime>${time}</EventEndTime><TransactionDetailGroup><TransactionLine status="normal"><TransactionLineSequenceNumber>1</TransactionLineSequenceNumber><ItemLine><ItemCode><POSCode>00001</POSCode></ItemCode><SalesQuantity>1</SalesQuantity><SalesAmount>10.00</SalesAmount></ItemLine></TransactionLine><TransactionLine status="normal"><TenderInfo><Tender><TenderCode>Cash</TenderCode></Tender><TenderAmount>10.00</TenderAmount></TenderInfo></TransactionLine></TransactionDetailGroup><TransactionSummary><TransactionTotalGrossAmount>10.00</TransactionTotalGrossAmount><TransactionTotalNetAmount>10.00</TransactionTotalNetAmount><TransactionTotalTaxNetAmount>0.00</TransactionTotalTaxNetAmount></TransactionSummary></SaleEvent>`;
const journal = (...events) =>
  `<NAXML-POSJournal><TransmissionHeader><StoreLocationID>${storeId}</StoreLocationID></TransmissionHeader><JournalReport>${events.join("")}</JournalReport></NAXML-POSJournal>`;
let temp, data, archive, rows;
beforeEach(async () => {
  vi.spyOn(locationsClient, "getLocations").mockResolvedValue([]);
  rows = Object.fromEntries(
    Object.entries(models).map(([name, model]) => [name, memoryModel(model)]),
  );
  temp = await fs.mkdtemp(path.join(os.tmpdir(), "desk-pos-test-"));
  data = path.join(temp, "data");
  archive = path.join(temp, "archive");
  await fs.mkdir(path.join(data, "Burlington"), { recursive: true });
  await fs.mkdir(archive);
  vi.stubEnv("POS_DATA_DIR", data);
  vi.stubEnv("POS_ARCHIVE_DIR", archive);
  vi.stubEnv("POS_FILE_STABLE_SECONDS", "1");
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (
    temp &&
    path.basename(temp).startsWith("desk-pos-test-") &&
    path.dirname(temp) === os.tmpdir()
  )
    await fs.rm(temp, { recursive: true, force: true });
});
async function upload(name, xml) {
  const target = path.join(data, "Burlington", name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, xml);
  await fs.utimes(
    target,
    new Date(Date.now() - 60000),
    new Date(Date.now() - 60000),
  );
  return target;
}
const acceptCurrent = async (date = "2026-11-03") => {
  const current = await service.detail("burlington", date);
  return service.accept("burlington", date, current, {
    email: "reviewer@example.test",
  });
};

it("imports nested site XML, accepts a report, verifies the archive, and retains the report after deleting sources", async () => {
  const xml = journal(eventXml("1"));
  const source = await upload("nested/a.xml", xml);
  expect(await service.scan()).toMatchObject({ imported: 1, issues: [] });
  expect(await fs.readFile(source, "utf8")).toBe(xml);
  const result = await acceptCurrent();
  expect(result.report).toMatchObject({
    status: "accepted",
    revision: 1,
    pendingFiles: 0,
    acceptedBy: "reviewer@example.test",
    timezone: "America/Toronto",
  });
  expect(result.archive).toEqual({ archived: 1, waiting: 0, errors: [] });
  await expect(fs.access(source)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(rows.File[0].archivePath, "utf8")).toBe(xml);
  expect(rows.Revision[0].snapshot.totals.total).toBe(1000);
  expect((await service.detail("burlington", "2026-11-03")).totals.total).toBe(
    1000,
  );
});
it("requires review of late files, rejects a stale acceptance, and preserves previous acceptance totals", async () => {
  await upload("a.xml", journal(eventXml("1")));
  await service.scan();
  await acceptCurrent();
  const old = await service.detail("burlington", "2026-11-03");
  await upload("late.xml", journal(eventXml("2")));
  await expect(
    service.accept("burlington", "2026-11-03", old, { email: "test" }),
  ).rejects.toMatchObject({ status: 409 });
  expect((await service.detail("burlington", "2026-11-03")).status).toBe(
    "needs-review",
  );
  expect(rows.Revision).toHaveLength(1);
  expect(rows.Revision[0].snapshot.totals.total).toBe(1000);
  const revised = await acceptCurrent();
  expect(revised.report).toMatchObject({
    revision: 2,
    status: "accepted",
    totals: { total: 2000 },
  });
  expect(rows.Revision).toHaveLength(2);
});
it("deduplicates retransmissions and can archive a retransmitted copy without another revision", async () => {
  const xml = journal(eventXml("1"));
  await upload("a.xml", xml);
  await upload("copy.xml", xml);
  await service.scan();
  expect((await service.detail("burlington", "2026-11-03")).totals.sales).toBe(
    1,
  );
  await acceptCurrent();
  const copy = await upload("a.xml", xml);
  await service.scan();
  expect((await service.detail("burlington", "2026-11-03")).pendingFiles).toBe(
    1,
  );
  const result = await acceptCurrent();
  expect(result.report.revision).toBe(1);
  await expect(fs.access(copy)).rejects.toMatchObject({ code: "ENOENT" });
});
it("keeps multi-day files in FTP until every day is accepted", async () => {
  const source = await upload(
    "both.xml",
    journal(
      eventXml("1", "2026-11-02", "23:59:59"),
      eventXml("2", "2026-11-03", "00:00:01"),
    ),
  );
  await service.scan();
  expect((await acceptCurrent("2026-11-02")).archive).toMatchObject({
    archived: 0,
    waiting: 1,
  });
  await fs.access(source);
  expect((await acceptCurrent("2026-11-03")).archive).toMatchObject({
    archived: 1,
    waiting: 0,
  });
  await expect(fs.access(source)).rejects.toMatchObject({ code: "ENOENT" });
});
it("retains sources on archive failure and retries without creating a second revision", async () => {
  const source = await upload("a.xml", journal(eventXml("1")));
  await service.scan();
  const originalLink = fs.link;
  const spy = vi
    .spyOn(fs, "link")
    .mockRejectedValue(Object.assign(new Error("denied"), { code: "EACCES" }));
  const failed = await acceptCurrent();
  expect(failed.report.status).toBe("accepted");
  expect(failed.archive.errors).toHaveLength(1);
  await fs.access(source);
  spy.mockImplementation(originalLink);
  expect((await acceptCurrent()).archive.errors).toEqual([]);
  expect(rows.Revision).toHaveLength(1);
});
it("recovers a crash after removing a source but before recording archive completion", async () => {
  const source = await upload("a.xml", journal(eventXml("1")));
  await service.scan();
  const originalUpdate = models.File.updateOne.getMockImplementation();
  vi.spyOn(models.File, "updateOne").mockImplementationOnce(async () => {
    throw new Error("database interrupted");
  });
  const failed = await acceptCurrent();
  expect(failed.archive.errors).toHaveLength(1);
  await expect(fs.access(source)).rejects.toMatchObject({ code: "ENOENT" });
  models.File.updateOne.mockImplementation(originalUpdate);
  expect((await acceptCurrent()).archive).toMatchObject({
    archived: 1,
    errors: [],
  });
});
it("recovers an acceptance interrupted between history and current report writes", async () => {
  await upload("a.xml", journal(eventXml("1")));
  await service.scan();
  const original = models.Report.findOneAndUpdate.getMockImplementation();
  models.Report.findOneAndUpdate.mockImplementationOnce(async () => {
    throw new Error("database interrupted");
  });
  await expect(acceptCurrent()).rejects.toThrow("database interrupted");
  expect(rows.Revision).toHaveLength(1);
  expect(rows.Report).toHaveLength(0);
  models.Report.findOneAndUpdate.mockImplementation(original);
  await expect(acceptCurrent()).rejects.toMatchObject({ status: 409 });
  expect((await acceptCurrent()).report.revision).toBe(1);
});
it("rejects conflicting events, malformed or wrong-site files without deleting them", async () => {
  await upload("a.xml", journal(eventXml("1")));
  await service.scan();
  const source = await upload(
    "conflict.xml",
    journal(
      eventXml("1").replace(
        "<TillID>1</TillID>",
        "<TillID>1</TillID><CashierID>different</CashierID>",
      ),
    ),
  );
  await upload("bad.xml", "<broken>");
  await upload("wrong.xml", journal(eventXml("2")).replace(storeId, "WRONG"));
  expect((await service.scan()).issues).toHaveLength(3);
  expect(rows.Event).toHaveLength(1);
  await expect(acceptCurrent()).rejects.toMatchObject({ status: 409 });
  await fs.access(source);
});
it("waits for active uploads and rejects nested archive storage or traversal mappings", async () => {
  await fs.writeFile(
    path.join(data, "Burlington", "new.xml"),
    journal(eventXml("1")),
  );
  expect((await service.scan()).waiting).toBe(1);
  vi.stubEnv("POS_ARCHIVE_DIR", path.join(data, "Burlington"));
  await expect(service.roots()).rejects.toMatchObject({ status: 503 });
  await expect(
    service.saveSite({
      id: "bad",
      name: "Bad",
      folder: "../escape",
      storeLocationIds: ["x"],
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it("serializes mutations with the database lease", async () => {
  rows.Lock.push({
    _id: "pos-files",
    owner: "other-process",
    expires: new Date(Date.now() + 60000),
  });
  await expect(service.scan()).rejects.toMatchObject({ status: 409 });
});
it("reads other site timezones from locations and keeps their reports separate from Burlington", async () => {
  const locations = [
    {
      _id: "location-1",
      stationName: "Oakville",
      timezone: "America/Winnipeg",
    },
  ];
  locationsClient.getLocations.mockResolvedValue(locations);
  const settings = await service.saveSite({
    id: "oakville",
    name: "Oakville",
    folder: "Oakville",
    locationId: "location-1",
    storeLocationIds: ["OTHERSTORE"],
  });
  expect(settings.find((s) => s.id === "oakville").timezone).toBe(
    "America/Winnipeg",
  );
  await fs.mkdir(path.join(data, "Oakville"));
  const filename = path.join(data, "Oakville", "a.xml");
  await fs.writeFile(
    filename,
    journal(eventXml("1", "2026-11-03", "05:30:00Z")).replace(
      storeId,
      "OTHERSTORE",
    ),
  );
  await fs.utimes(filename, new Date(0), new Date(0));
  await upload("a.xml", journal(eventXml("1")));
  expect((await service.scan()).imported).toBe(2);
  expect((await service.detail("oakville", "2026-11-02")).timezone).toBe(
    "America/Winnipeg",
  );
  expect((await service.detail("burlington", "2026-11-03")).totals.sales).toBe(
    1,
  );
  locations[0].timezone = "";
  await expect(
    service.saveSite({
      id: "new-site",
      name: "New",
      folder: "New",
      locationId: "location-1",
      storeLocationIds: ["NEWSTORE"],
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it("shows Hub location failures while retaining Burlington and blocking other site timezone resolution", async () => {
  rows.Site.push({
    id: "other",
    name: "Other",
    folder: "Other",
    locationId: "loc-1",
    storeLocationIds: ["OTHER"],
  });
  locationsClient.getLocations.mockRejectedValue(new Error("Hub unavailable"));
  const sites = await service.listSites();
  expect(sites.find((s) => s.id === "burlington")).toMatchObject({
    timezone: "America/Toronto",
    issue: "",
  });
  expect(sites.find((s) => s.id === "other")).toMatchObject({
    timezone: "",
    issue: expect.any(String),
  });
  const app = express();
  app.use("/api/pos-reports", require("./pos-reports.routes"));
  const token = jwt.sign(
    { permissions: { hub: { shifts: { read: true } } } },
    process.env.JWT_SECRET || "desk-dev-secret",
  );
  const response = await request(app)
    .get("/api/pos-reports/sites")
    .auth(token, { type: "bearer" });
  expect(response.status).toBe(200);
  expect(response.body.locationIssue).toContain("Hub locations");
  expect(response.body.locations).toEqual([]);
  expect(response.body.sites.find((s) => s.id === "burlington").timezone).toBe(
    "America/Toronto",
  );
});
it("blocks an overwritten source file instead of silently changing the reviewed report", async () => {
  const source = await upload("a.xml", journal(eventXml("1")));
  await service.scan();
  await upload("a.xml", journal(eventXml("2")));
  const result = await service.scan();
  expect(result.issues[0].message).toContain("filename changed");
  await expect(acceptCurrent()).rejects.toMatchObject({ status: 409 });
  expect(rows.Event).toHaveLength(1);
  expect(rows.Revision).toHaveLength(0);
  await fs.access(source);
});
it("resolves locations once for a report list even when Hub is unavailable", async () => {
  rows.Site.push({
    id: "other",
    name: "Other",
    folder: "Other",
    locationId: "loc-1",
    storeLocationIds: ["OTHER"],
  });
  await upload("a.xml", journal(eventXml("1", "2026-11-02")));
  await upload("b.xml", journal(eventXml("2", "2026-11-03")));
  await service.scan();
  vi.spyOn(models.Event, "aggregate").mockResolvedValue([
    { _id: { site: "burlington", date: "2026-11-02" } },
    { _id: { site: "burlington", date: "2026-11-03" } },
  ]);
  locationsClient.getLocations
    .mockClear()
    .mockRejectedValue(new Error("Hub down"));
  const reports = await service.listReports();
  expect(reports).toHaveLength(2);
  expect(reports.every((report) => report.timezone === "America/Toronto")).toBe(
    true,
  );
  expect(locationsClient.getLocations).toHaveBeenCalledTimes(1);
});
it("enforces read and update permissions on the actual API routes", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/pos-reports", require("./pos-reports.routes"));
  const token = (read, update) =>
    jwt.sign(
      {
        email: "user@test",
        permissions: { hub: { shifts: { read, update } } },
      },
      process.env.JWT_SECRET || "desk-dev-secret",
    );
  expect((await request(app).get("/api/pos-reports/scan")).status).toBe(401);
  expect(
    (
      await request(app)
        .get("/api/pos-reports/scan")
        .auth(token(false, false), { type: "bearer" })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app)
        .get("/api/pos-reports/scan")
        .auth(token(true, false), { type: "bearer" })
    ).status,
  ).toBe(200);
  expect(
    (
      await request(app)
        .post("/api/pos-reports/scan")
        .auth(token(true, false), { type: "bearer" })
    ).status,
  ).toBe(403);
  await upload("a.xml", journal(eventXml("1")));
  expect(
    (
      await request(app)
        .post("/api/pos-reports/scan")
        .auth(token(true, true), { type: "bearer" })
    ).status,
  ).toBe(200);
  const preview = await request(app)
    .get("/api/pos-reports/reports/burlington/2026-11-03")
    .auth(token(true, false), { type: "bearer" });
  expect(preview.body.totals.total).toBe(1000);
  const accepted = await request(app)
    .post("/api/pos-reports/reports/burlington/2026-11-03/accept")
    .auth(token(true, true), { type: "bearer" })
    .send({ sourceHash: preview.body.sourceHash, revision: 0 });
  expect(accepted.status).toBe(200);
  expect(accepted.body.report.status).toBe("accepted");
  expect(
    (
      await request(app)
        .get("/api/pos-reports/reports/burlington/2026-02-30")
        .auth(token(true, false), { type: "bearer" })
    ).status,
  ).toBe(400);
});
