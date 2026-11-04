// Start postman/simulations/pos-locations.sim.yaml on a local port first.
// Runs the real HTTP client + site timezone resolver. Only the Desk site model
// read is replaced; this script never connects to Mongo or touches source XML.
const assert = require("node:assert/strict");
const http = require("node:http");
const {
  createLocationsClient,
} = require("../backend/apps/pos-reports/pos-reports.locations");
const client = require("../backend/apps/pos-reports/pos-reports.locations");
const models = require("../backend/apps/pos-reports/pos-reports.model");
const service = require("../backend/apps/pos-reports/pos-reports.service");

async function run() {
  const requests = [];
  let fixture;
  let base = process.argv[2] || "http://127.0.0.1:4187";
  if (process.argv.includes("--local-fixture")) {
    // Same synthetic response as the consumer contract. Used when the Postman
    // runner is unavailable; this is real HTTP, not an intercepted fetch stub.
    const locations = [
      {
        _id: "000000000000000000000001",
        stationName: "Example Station",
        site: "Example",
        timezone: "America/Winnipeg",
      },
    ];
    fixture = http.createServer((req, res) => {
      requests.push({ method: req.method, path: req.url });
      if (
        req.method !== "GET" ||
        ![
          "/hub/api/locations",
          "/unavailable/api/locations",
          "/slow/api/locations",
        ].includes(req.url)
      ) {
        res.writeHead(501);
        res.end();
        return;
      }
      if (req.url.startsWith("/unavailable/")) {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Dependency unavailable" }));
        return;
      }
      const respond = () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(locations));
      };
      if (req.url.startsWith("/slow/")) setTimeout(respond, 250);
      else respond();
    });
    await new Promise((resolve, reject) => {
      fixture.once("error", reject);
      fixture.listen(0, "127.0.0.1", resolve);
    });
    base = `http://127.0.0.1:${fixture.address().port}`;
  }
  const originalRead = models.Site.find;
  const originalClient = client.getLocations;
  models.Site.find = () => ({
    lean: async () => [
      {
        id: "example",
        name: "Example",
        folder: "Example",
        locationId: "000000000000000000000001",
        storeLocationIds: ["EXAMPLE"],
      },
    ],
  });
  try {
    client.getLocations = createLocationsClient({
      url: `${base}/hub/api/locations`,
    });
    const locations = await service.listLocations();
    assert.equal(locations[0].timezone, "America/Winnipeg");
    const sites = await service.listSites();
    assert.equal(
      sites.find((s) => s.id === "example").timezone,
      "America/Winnipeg",
    );
    assert.equal(
      sites.find((s) => s.id === "burlington").timezone,
      "America/Toronto",
    );
    console.log("PASS: real HTTP read and site timezone resolution");

    client.getLocations = createLocationsClient({
      url: `${base}/unavailable/api/locations`,
      cacheMs: 0,
    });
    await assert.rejects(service.listLocations(), { status: 502 });
    const unavailable = await service.listSites();
    assert.notEqual(unavailable.find((s) => s.id === "example").issue, "");
    assert.equal(unavailable.find((s) => s.id === "burlington").issue, "");
    console.log(
      "PASS: HTTP 503 blocks unknown timezone and preserves Burlington",
    );

    client.getLocations = createLocationsClient({
      url: `${base}/slow/api/locations`,
      timeoutMs: 100,
    });
    await assert.rejects(service.listLocations(), { status: 503 });
    console.log(
      "PASS: delayed dependency response is aborted at client timeout",
    );
    if (fixture) {
      assert.equal(requests.length, 4);
      assert.ok(requests.every((r) => r.method === "GET"));
      console.log("PASS: fixture observed all 4 dependency requests; GET only");
    }
  } finally {
    models.Site.find = originalRead;
    client.getLocations = originalClient;
    if (fixture) {
      fixture.closeAllConnections();
      await new Promise((resolve) => fixture.close(resolve));
    }
  }
}
run().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
