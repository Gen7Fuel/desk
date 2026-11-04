const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const locationsClient = require("./pos-reports.locations");
const models = require("./pos-reports.model");
const {
  parseJournal,
  summarize,
  validateTimezone,
  hash,
  error,
  validDate,
} = require("./pos-reports.parser");

const burlington = {
  id: "burlington",
  name: "Burlington",
  folder: "Burlington",
  locationId: "",
  storeLocationIds: ["D68C818D4175E5A209ED"],
};
const segment = (value) =>
  typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9 _-]{0,79}$/.test(value);
let lastScan = {
  imported: 0,
  duplicates: 0,
  waiting: 0,
  issues: [],
  completedAt: null,
};
async function listLocations() {
  return locationsClient.getLocations();
}
async function listSites(knownLocations) {
  const saved = await models.Site.find().lean();
  const sites = saved.some((s) => s.id === burlington.id)
    ? saved
    : [burlington, ...saved];
  // Burlington is usable without a Hub connection. Additional sites must resolve
  // their configured location, never silently fall back to Toronto or UTC.
  const locations =
    knownLocations !== undefined
      ? knownLocations
      : sites.some((s) => s.id !== "burlington")
        ? await listLocations().catch(() => [])
        : [];
  return sites.map((s) => {
    const location = locations.find((l) => String(l._id) === s.locationId);
    const timezone =
      s.id === "burlington" ? "America/Toronto" : location?.timezone;
    let issue = "";
    try {
      validateTimezone(timezone);
    } catch {
      issue =
        "A Hub location with a valid timezone is required. Retry if Hub is unavailable.";
    }
    return { ...s, timezone: timezone || "", issue };
  });
}
async function saveSite(input) {
  if (
    !input ||
    typeof input.id !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.id) ||
    !segment(input.folder) ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 100
  )
    throw error("Provide a site ID, site name, and a single directory name.");
  if (
    !Array.isArray(input.storeLocationIds) ||
    !input.storeLocationIds.length ||
    input.storeLocationIds.length > 20 ||
    input.storeLocationIds.some(
      (s) => typeof s !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(s),
    )
  )
    throw error("Provide valid StoreLocationIDs.");
  const sites = await listSites();
  if (
    sites.some(
      (s) =>
        s.id !== input.id &&
        (s.folder === input.folder ||
          s.storeLocationIds.some((id) => input.storeLocationIds.includes(id))),
    )
  )
    throw error(
      "The folder or StoreLocationID is already assigned to another site.",
      409,
    );
  const existing = sites.find((s) => s.id === input.id);
  const changed =
    existing &&
    (existing.folder !== input.folder ||
      existing.locationId !== (input.locationId || "") ||
      JSON.stringify(existing.storeLocationIds) !==
        JSON.stringify(input.storeLocationIds));
  if (changed && (await models.File.exists({ site: input.id })))
    throw error(
      "An imported site mapping cannot be changed. Create a new mapping for a different POS or location.",
      409,
    );
  const locationId =
    typeof input.locationId === "string" ? input.locationId : "";
  if (input.id !== "burlington") {
    const location = (await listLocations()).find(
      (l) => String(l._id) === locationId,
    );
    if (!location) throw error("Select a valid Hub location for this site.");
    validateTimezone(location.timezone);
  }
  await models.Site.findOneAndUpdate(
    { id: input.id },
    {
      $set: {
        id: input.id,
        name: input.name.trim(),
        folder: input.folder,
        locationId,
        storeLocationIds: [...new Set(input.storeLocationIds)],
      },
    },
    { upsert: true, runValidators: true },
  );
  return listSites();
}
async function withLock(task) {
  const owner = randomUUID();
  let acquired;
  try {
    acquired = await models.Lock.findOneAndUpdate(
      { _id: "pos-files", expires: { $lt: new Date() } },
      { $set: { owner, expires: new Date(Date.now() + 300000) } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (e) {
    if (e.code === 11000)
      throw error(
        "Another POS import or acceptance is running. Retry shortly.",
        409,
      );
    throw e;
  }
  if (!acquired) throw error("Another POS operation is running.", 409);
  let lost = false;
  const heartbeat = setInterval(async () => {
    try {
      const result = await models.Lock.updateOne(
        { _id: "pos-files", owner },
        { $set: { expires: new Date(Date.now() + 300000) } },
      );
      if (!result.matchedCount) lost = true;
    } catch {
      lost = true;
    }
  }, 30000);
  heartbeat.unref();
  const check = () => {
    if (lost) throw error("The POS operation lost its lock. Retry.", 409);
  };
  try {
    return await task(check);
  } finally {
    clearInterval(heartbeat);
    await models.Lock.deleteOne({ _id: "pos-files", owner });
  }
}
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
};
async function roots() {
  if (!process.env.POS_DATA_DIR || !process.env.POS_ARCHIVE_DIR)
    throw error(
      "Configure POS_DATA_DIR and POS_ARCHIVE_DIR on the backend.",
      503,
    );
  const data = await fs.realpath(process.env.POS_DATA_DIR).catch(() => {
    throw error("POS data directory is unavailable.", 503);
  });
  const archive = await fs.realpath(process.env.POS_ARCHIVE_DIR).catch(() => {
    throw error("POS archive directory is unavailable.", 503);
  });
  if (inside(data, archive) || inside(archive, data))
    throw error(
      "POS data and archive must be separate, non-nested directories.",
      503,
    );
  return { data, archive };
}
async function siteRoot(data, site) {
  if (!segment(site.folder)) throw error("Invalid site directory.");
  const target = path.join(data, site.folder);
  const stat = await fs.lstat(target);
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw error("Site directory must be a real directory.");
  const real = await fs.realpath(target);
  if (!inside(data, real))
    throw error("Site directory is outside the data directory.");
  return real;
}
async function* walk(directory, base = directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) yield* walk(full, base);
    else if (entry.isFile() && /\.xml$/i.test(entry.name))
      yield {
        full,
        relative: path.relative(base, full).split(path.sep).join("/"),
      };
  }
}
async function readStable(full, stableMs) {
  const before = await fs.lstat(full);
  if (!before.isFile() || before.isSymbolicLink())
    throw error("Expected a regular XML file.");
  if (before.size > 16 * 1024 * 1024) throw error("XML file exceeds 16 MB.");
  if (Date.now() - before.mtimeMs < stableMs) return null;
  const buffer = await fs.readFile(full);
  const after = await fs.lstat(full);
  if (
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    before.ino !== after.ino
  )
    throw error(
      "File changed while reading; retry after upload completes.",
      409,
    );
  return { buffer, hash: hash(buffer), stat: after };
}
async function scanUnlocked(check = () => {}) {
  const { data } = await roots();
  const sites = await listSites();
  const result = { imported: 0, duplicates: 0, waiting: 0, issues: [] };
  const stableMs = Math.max(
    1000,
    Number(process.env.POS_FILE_STABLE_SECONDS || 30) * 1000,
  );
  for (const site of sites) {
    check();
    if (site.issue) {
      result.issues.push({ site: site.id, file: "", message: site.issue });
      continue;
    }
    let base;
    try {
      base = await siteRoot(data, site);
    } catch (e) {
      result.issues.push({
        site: site.id,
        file: "",
        message:
          e.code === "ENOENT"
            ? "Site directory does not exist yet."
            : e.message,
      });
      continue;
    }
    for await (const file of walk(base)) {
      check();
      try {
        const loaded = await readStable(file.full, stableMs);
        if (!loaded) {
          result.waiting++;
          continue;
        }
        const known = await models.File.findOne({
          site: site.id,
          path: file.relative,
          hash: loaded.hash,
        }).lean();
        if (known) {
          // A retransmitted, already archived file is not a new sale, but its new
          // physical copy still needs archiving on the next acceptance/retry.
          if (known.archived)
            await models.File.updateOne(
              { _id: known._id },
              { $set: { archived: false } },
            );
          result.duplicates++;
          continue;
        }
        const prior = await models.File.findOne({
          site: site.id,
          path: file.relative,
          archived: false,
        }).lean();
        if (prior && prior.hash !== loaded.hash)
          throw error(
            "This source filename changed after import. Preserve it and resolve the conflicting upload before accepting.",
          );
        const events = parseJournal(loaded.buffer.toString("utf8"), site);
        const keys = events.map((e) => e.key);
        const existing = await models.Event.find({
          site: site.id,
          key: { $in: keys },
        }).lean();
        const hashes = new Map(existing.map((e) => [e.key, e.hash]));
        for (const e of events) {
          if (hashes.has(e.key) && hashes.get(e.key) !== e.hash)
            throw error(
              `Conflicting version of transaction ${e.data.id}; file needs investigation.`,
            );
          hashes.set(e.key, e.hash);
        }
        // Validate the whole file before inserting any event. Upserts also make a
        // process crash midway through this file safe to retry.
        for (const e of events) {
          check();
          await models.Event.updateOne(
            { site: site.id, key: e.key },
            { $setOnInsert: { site: site.id, ...e } },
            { upsert: true },
          );
        }
        await models.File.create({
          site: site.id,
          path: file.relative,
          hash: loaded.hash,
          days: [...new Set(events.map((e) => e.date))],
          eventKeys: [...new Set(keys)],
        });
        result.imported++;
      } catch (e) {
        result.issues.push({
          site: site.id,
          file: file.relative,
          message: e.status
            ? e.message
            : "Could not read or import this file. Check server logs and filesystem permissions.",
        });
        console.error("[pos/import]", site.id, file.relative, e.message);
      }
    }
  }
  // Unknown directories stay visible instead of silently disappearing from reports.
  for (const entry of await fs.readdir(data, { withFileTypes: true })) {
    if (entry.isDirectory() && !sites.some((s) => s.folder === entry.name))
      result.issues.push({
        site: "",
        file: entry.name,
        message: "No site mapping is configured for this directory.",
      });
    if (entry.isFile() && /\.xml$/i.test(entry.name))
      result.issues.push({
        site: "",
        file: entry.name,
        message: "Move this XML file into its site directory.",
      });
  }
  lastScan = { ...result, completedAt: new Date().toISOString() };
  return lastScan;
}
function validateIdentity(site, date) {
  if (
    typeof site !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(site) ||
    !validDate(date)
  )
    throw error("Invalid site or calendar date.");
}
async function detail(site, date, resolvedSites) {
  validateIdentity(site, date);
  const [events, files, saved, history, sites] = await Promise.all([
    models.Event.find({ site, date }).sort({ key: 1 }).lean(),
    models.File.find({ site, days: date }).sort({ path: 1, hash: 1 }).lean(),
    models.Report.findOne({ site, date }).lean(),
    models.Revision.find({ site, date })
      .select(
        "revision acceptedBy acceptedAt sourceHash snapshot.totals snapshot.timezone",
      )
      .sort({ revision: -1 })
      .lean(),
    resolvedSites || listSites(),
  ]);
  if (!events.length && !saved)
    throw error("Report not found. Scan for new files first.", 404);
  const config = sites.find((s) => s.id === site);
  if (!config) throw error("Site mapping is missing.", 409);
  const sourceHash = hash(events.map((e) => [e.key, e.hash]));
  const summary = summarize(events);
  if (config.issue)
    summary.issues.push({
      code: "location",
      message:
        "The site timezone could not be verified from Hub. Check its location or retry when Hub is available.",
      blocking: true,
    });
  else if (events.some((e) => e.data.timezone !== config.timezone))
    summary.issues.push({
      code: "timezone",
      message:
        "The location timezone changed after import. Resolve the mapping before accepting.",
      blocking: true,
    });
  const pendingFiles = files.filter((f) => !f.archived).length;
  return {
    site,
    siteName: config.name,
    date,
    timezone:
      events[0]?.data.timezone || saved?.snapshot?.timezone || config.timezone,
    sourceHash,
    revision: saved?.revision || 0,
    status:
      saved?.acceptedHash === sourceHash
        ? "accepted"
        : saved?.revision
          ? "needs-review"
          : "draft",
    acceptedBy: saved?.acceptedBy || "",
    acceptedAt: saved?.acceptedAt || null,
    ...summary,
    eventCount: events.length,
    pendingFiles,
    events: events.map((e) => ({ ...e.data, eventHash: e.hash })),
    files: files.map((f) => ({
      path: f.path,
      hash: f.hash,
      archived: f.archived,
      days: f.days,
    })),
    history,
  };
}
async function listReports(filters = {}) {
  const query = {};
  if (filters.site) {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(filters.site))
      throw error("Invalid site.");
    query.site = filters.site;
  }
  for (const name of ["from", "to"])
    if (filters[name] && !validDate(filters[name]))
      throw error("Invalid date filter.");
  if (filters.from || filters.to)
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  if (filters.from && filters.to && filters.from > filters.to)
    throw error("From date must be before to date.");
  const days = await models.Event.aggregate([
    { $match: query },
    { $group: { _id: { site: "$site", date: "$date" } } },
    { $sort: { "_id.date": -1, "_id.site": 1 } },
    { $limit: 200 },
  ]);
  const reports = [];
  const sites = days.length ? await listSites() : [];
  for (const day of days) {
    const { events, files, history, ...row } = await detail(
      day._id.site,
      day._id.date,
      sites,
    );
    reports.push(row);
  }
  return reports;
}
async function archiveSiteFiles(site, check) {
  const { data, archive } = await roots();
  const config = (await listSites()).find((s) => s.id === site);
  const base = await siteRoot(data, config);
  const files = await models.File.find({ site, archived: false }).lean();
  const errors = [];
  let archived = 0,
    waiting = 0;
  for (const file of files) {
    check();
    const events = await models.Event.find({
      site,
      key: { $in: file.eventKeys },
    }).lean();
    const accepted = await models.Report.find({
      site,
      date: { $in: file.days },
    }).lean();
    // Multi-day files stay in FTP until every event has an accepted snapshot.
    if (
      events.length !== file.eventKeys.length ||
      events.some(
        (e) =>
          !accepted
            .find((r) => r.date === e.date)
            ?.acceptedEventHashes?.includes(e.hash),
      )
    ) {
      waiting++;
      continue;
    }
    try {
      const source = path.resolve(base, file.path);
      if (
        !inside(base, source) ||
        !inside(base, await fs.realpath(path.dirname(source)))
      )
        throw error("Source path is outside its site directory.");
      const targetDirectory = path.join(
        archive,
        site,
        [...file.days].sort()[0],
      );
      await fs.mkdir(targetDirectory, { recursive: true });
      if (!inside(archive, await fs.realpath(targetDirectory)))
        throw error("Archive destination is outside the archive directory.");
      const target = path.join(targetDirectory, `${file.hash}.xml`);
      let loaded;
      try {
        loaded = await readStable(source, 0);
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      if (loaded && loaded.hash !== file.hash)
        throw error(
          "Source file changed after import; original left in place.",
        );
      if (loaded) {
        const temp = path.join(targetDirectory, `.${randomUUID()}.part`);
        try {
          await fs.writeFile(temp, loaded.buffer, {
            flag: "wx",
            mode: 0o640,
            flush: true,
          });
          // link publishes a completed file without replacing an existing archive.
          try {
            await fs.link(temp, target);
          } catch (e) {
            if (e.code !== "EEXIST") throw e;
          }
        } finally {
          await fs.unlink(temp).catch(() => {});
        }
      }
      const targetStat = await fs.lstat(target);
      if (
        !targetStat.isFile() ||
        targetStat.isSymbolicLink() ||
        hash(await fs.readFile(target)) !== file.hash
      )
        throw error(
          "Archive content verification failed; source left in place.",
        );
      if (loaded) {
        const current = await readStable(source, 0);
        if (
          current.hash !== file.hash ||
          current.stat.ino !== loaded.stat.ino ||
          current.stat.mtimeMs !== loaded.stat.mtimeMs
        )
          throw error("Source changed during archiving; source left in place.");
        check();
        await fs.unlink(source);
      }
      // If the process crashed after unlink, verified archive content is sufficient
      // to finish marking this file on a later retry.
      await models.File.updateOne(
        { _id: file._id },
        { $set: { archived: true, archivePath: target } },
      );
      archived++;
    } catch (e) {
      errors.push({ file: file.path, message: e.message });
    }
  }
  return { archived, waiting, errors };
}
async function accept(site, date, input, user) {
  validateIdentity(site, date);
  if (
    !input ||
    !/^[a-f0-9]{64}$/.test(input.sourceHash) ||
    !Number.isInteger(input.revision) ||
    input.revision < 0
  )
    throw error("Provide the reviewed sourceHash and revision.");
  return withLock(async (check) => {
    // Recover an acceptance interrupted after the immutable revision was saved.
    const previous = await models.Report.findOne({ site, date }).lean();
    const pending = await models.Revision.findOne({
      site,
      date,
      revision: (previous?.revision || 0) + 1,
    }).lean();
    if (pending) {
      await models.Report.findOneAndUpdate(
        { site, date },
        {
          $set: {
            revision: pending.revision,
            acceptedHash: pending.sourceHash,
            acceptedAt: pending.acceptedAt,
            acceptedBy: pending.acceptedBy,
            snapshot: pending.snapshot,
            acceptedEventHashes: pending.snapshot.eventHashes,
          },
        },
        {
          upsert: true,
          runValidators: true,
          writeConcern: { w: "majority", j: true },
        },
      );
    }
    const scan = await scanUnlocked(check);
    if (scan.issues.some((i) => i.site === site))
      throw error(
        "Resolve this site's import issues before acceptance. Refresh files to see details.",
        409,
      );
    const current = await detail(site, date);
    if (
      current.sourceHash !== input.sourceHash ||
      current.revision !== input.revision
    )
      throw error(
        "The report changed. Review the latest report before accepting.",
        409,
      );
    if (current.issues.some((i) => i.blocking))
      throw error(
        "Resolve the report reconciliation issues before acceptance.",
        409,
      );
    check();
    if (current.status !== "accepted") {
      const acceptedAt = new Date(),
        acceptedBy = user.email || user.userId || "unknown";
      const snapshot = {
        totals: current.totals,
        payments: current.payments,
        departments: current.departments,
        issues: current.issues,
        timezone: current.timezone,
        files: current.files,
        eventCount: current.eventCount,
        eventHashes: current.events.map((e) => e.eventHash),
      };
      // Write immutable revision first. The global lease serializes acceptance;
      // upsert lets a crash between history and report writes resume safely.
      await models.Revision.updateOne(
        { site, date, revision: current.revision + 1 },
        {
          $setOnInsert: {
            site,
            date,
            revision: current.revision + 1,
            sourceHash: current.sourceHash,
            acceptedAt,
            acceptedBy,
            snapshot,
          },
        },
        { upsert: true, writeConcern: { w: "majority", j: true } },
      );
      const revision = await models.Revision.findOne({
        site,
        date,
        revision: current.revision + 1,
      }).lean();
      if (revision.sourceHash !== current.sourceHash)
        throw error(
          "A previously interrupted acceptance needs recovery before new files can be accepted.",
          409,
        );
      await models.Report.findOneAndUpdate(
        { site, date },
        {
          $set: {
            revision: revision.revision,
            acceptedHash: revision.sourceHash,
            acceptedAt: revision.acceptedAt,
            acceptedBy: revision.acceptedBy,
            snapshot: revision.snapshot,
            acceptedEventHashes: current.events.map((e) => e.eventHash),
          },
        },
        {
          upsert: true,
          runValidators: true,
          writeConcern: { w: "majority", j: true },
        },
      );
    }
    check();
    const archive = await archiveSiteFiles(site, check);
    return { report: await detail(site, date), archive, scan };
  });
}
function startImporter() {
  if (!process.env.POS_DATA_DIR || !process.env.POS_ARCHIVE_DIR) return;
  const run = () =>
    withLock(scanUnlocked).catch((e) => {
      if (e.status !== 409) console.error("[pos/scan]", e.message);
    });
  run();
  const timer = setInterval(
    run,
    Math.max(10000, Number(process.env.POS_SCAN_SECONDS || 60) * 1000),
  );
  timer.unref();
  return timer;
}
module.exports = {
  listSites,
  listLocations,
  saveSite: (input) => withLock(() => saveSite(input)),
  listReports,
  detail,
  accept,
  scan: () => withLock(scanUnlocked),
  scanStatus: () => lastScan,
  startImporter,
  archiveSiteFiles,
  roots,
  readStable,
  inside,
};
