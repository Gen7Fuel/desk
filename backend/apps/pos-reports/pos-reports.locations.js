const { error } = require("./pos-reports.parser");

const LOCATIONS_URL = "https://app.gen7fuel.com/api/locations";

// URL/timeout options are for local HTTP verification. Production uses the same
// public Hub endpoint as Desk's SitePicker; no credentials or new env are needed.
function createLocationsClient({
  url = LOCATIONS_URL,
  timeoutMs = 10000,
  cacheMs = 60000,
} = {}) {
  let cached,
    expires = 0,
    pending;
  async function load() {
    let response, body;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw error(
          `Hub locations API returned HTTP ${response.status}. Retry shortly.`,
          502,
        );
      }
      body = await response.json();
    } catch (e) {
      if (e.status) throw e;
      throw error(
        "Hub locations API is unavailable or returned invalid JSON. Retry shortly.",
        503,
      );
    }
    if (
      !Array.isArray(body) ||
      body.some((l) => !l || typeof l._id !== "string" || !l._id.trim()) ||
      new Set(body.map((l) => l._id)).size !== body.length
    ) {
      throw error("Hub locations API returned an invalid location list.", 502);
    }
    const text = (value) => (typeof value === "string" ? value.trim() : "");
    cached = body.map((l) => ({
      _id: l._id,
      stationName: text(l.stationName),
      site: text(l.site),
      name: text(l.name),
      timezone: text(l.timezone),
    }));
    expires = Date.now() + cacheMs;
    return cached;
  }
  return async function getLocations() {
    if (cached && Date.now() < expires) return cached.map((l) => ({ ...l }));
    if (!pending)
      pending = load().finally(() => {
        pending = null;
      });
    const locations = await pending;
    return locations.map((l) => ({ ...l }));
  };
}

module.exports = {
  LOCATIONS_URL,
  createLocationsClient,
  getLocations: createLocationsClient(),
};
