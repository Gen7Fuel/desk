const {
  createLocationsClient,
  LOCATIONS_URL,
} = require("./pos-reports.locations");
const location = {
  _id: "loc-1",
  site: "Example",
  stationName: "Example Station",
  timezone: "America/Winnipeg",
  privateField: "not-retained",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("uses the existing public Hub endpoint with GET and retains only the location fields used by Desk", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => [location] });
  vi.stubGlobal("fetch", fetch);
  const get = createLocationsClient();
  const result = await get();
  expect(fetch).toHaveBeenCalledWith(LOCATIONS_URL, {
    headers: { Accept: "application/json" },
    signal: expect.any(AbortSignal),
  });
  expect(result).toEqual([
    {
      _id: "loc-1",
      site: "Example",
      stationName: "Example Station",
      name: "",
      timezone: "America/Winnipeg",
    },
  ]);
  expect(result[0]).not.toHaveProperty("privateField");
});
it("shares in-flight reads, caches valid responses for one minute, and protects cached records from caller mutation", async () => {
  let finish;
  const fetch = vi.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const get = createLocationsClient();
  const first = get(),
    second = get();
  finish({ ok: true, json: async () => [location] });
  const [a, b] = await Promise.all([first, second]);
  a[0].timezone = "changed";
  expect(b[0].timezone).toBe("America/Winnipeg");
  expect((await get())[0].timezone).toBe("America/Winnipeg");
  expect(fetch).toHaveBeenCalledTimes(1);
  const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
  fetch.mockResolvedValue({
    ok: true,
    json: async () => [{ ...location, timezone: "America/Vancouver" }],
  });
  expect((await get())[0].timezone).toBe("America/Vancouver");
  clock.mockRestore();
});
it("does not reuse expired timezone values after an upstream failure, and retries on the next request", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [location] })
    .mockRejectedValueOnce(new Error("network down"))
    .mockResolvedValueOnce({ ok: true, json: async () => [location] });
  vi.stubGlobal("fetch", fetch);
  const get = createLocationsClient({ cacheMs: 0 });
  await get();
  await expect(get()).rejects.toMatchObject({ status: 503 });
  expect((await get())[0]._id).toBe("loc-1");
});
it.each([{}, [null], [{ timezone: "America/Toronto" }], [location, location]])(
  "rejects an invalid Hub location list: %j",
  async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => body }),
    );
    await expect(createLocationsClient()()).rejects.toMatchObject({
      status: 502,
    });
  },
);
it("reports upstream HTTP errors and invalid JSON without caching them", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 500 })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error("HTML");
      },
    });
  vi.stubGlobal("fetch", fetch);
  const get = createLocationsClient();
  await expect(get()).rejects.toMatchObject({
    status: 502,
    message: expect.stringContaining("HTTP 500"),
  });
  await expect(get()).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(2);
});
