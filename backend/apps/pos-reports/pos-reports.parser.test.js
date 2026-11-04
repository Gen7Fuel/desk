const {
  parseJournal,
  summarize,
  completionDay,
  cents,
} = require("./pos-reports.parser");
const site = {
  name: "Burlington",
  timezone: "America/Toronto",
  storeLocationIds: ["STORE"],
};
const item = (quantity = "1", amount = "10.00", tax = "0.50") =>
  `<TransactionLine status="normal"><TransactionLineSequenceNumber>1</TransactionLineSequenceNumber><ItemLine><ItemCode><POSCode>00001234</POSCode></ItemCode><Description>Sample item</Description><ActualSalesPrice>10.00</ActualSalesPrice><RegularSellPrice>10.00</RegularSellPrice><SalesQuantity>${quantity}</SalesQuantity><SalesAmount>${amount}</SalesAmount><ItemTax><TaxLevelID>1</TaxLevelID><TaxCollectedAmount>${tax}</TaxCollectedAmount></ItemTax></ItemLine></TransactionLine>`;
const tender = (amount, change = "no") =>
  `<TransactionLine status="normal"><TenderInfo><Tender><TenderCode>Cash</TenderCode><TenderSubCode>cash</TenderSubCode></Tender><TenderAmount>${amount}</TenderAmount><ChangeFlag value="${change}"/></TenderInfo></TransactionLine>`;
function eventXml({
  id = "1",
  date = "2026-11-03",
  time = "12:00:00",
  type = "SaleEvent",
  quantity = "1",
  gross = "10.00",
  tax = "0.50",
  total = "10.50",
  itemTax = "0.50",
  extra = "",
  flags = "",
} = {}) {
  return `<${type}><TransactionID>${id}</TransactionID><EventSequenceID>1</EventSequenceID><RegisterID>R1</RegisterID><TillID>1</TillID><BusinessDate>2026-11-02</BusinessDate><EventStartDate>2026-11-02</EventStartDate><EventStartTime>23:59:58</EventStartTime><EventEndDate>${date}</EventEndDate><EventEndTime>${time}</EventEndTime>${flags}<TransactionDetailGroup>${item(quantity, gross, itemTax)}${extra}${tender("20.00")}${tender((Number(total) - 20).toFixed(2), "yes")}</TransactionDetailGroup><TransactionSummary><TransactionTotalGrossAmount>${gross}</TransactionTotalGrossAmount><TransactionTotalNetAmount>${total}</TransactionTotalNetAmount><TransactionTotalTaxNetAmount>${tax}</TransactionTotalTaxNetAmount></TransactionSummary></${type}>`;
}
const journal = (...events) =>
  `<NAXML-POSJournal><TransmissionHeader><StoreLocationID>STORE</StoreLocationID></TransmissionHeader><JournalReport>${events.join("")}</JournalReport></NAXML-POSJournal>`;

describe("POS journal normalization", () => {
  it("assigns a sale crossing midnight to its completion day and preserves leading-zero product codes", () => {
    const events = parseJournal(journal(eventXml({ time: "00:00:01" })), site);
    expect(events[0].date).toBe("2026-11-03");
    expect(events[0].data.businessDate).toBe("2026-11-02");
    expect(events[0].data.items[0].code).toBe("00001234");
    expect(summarize(events).totals).toMatchObject({
      sales: 1,
      gross: 1000,
      tax: 50,
      total: 1050,
      cash: 1050,
    });
  });
  it("handles site local midnight, offsets, and DST without using the server timezone", () => {
    expect(completionDay("2026-11-03", "00:00:00", "America/Toronto")).toBe(
      "2026-11-03",
    );
    expect(completionDay("2026-11-03", "03:00:00Z", "America/Toronto")).toBe(
      "2026-11-02",
    );
    expect(completionDay("2026-11-03", "03:00:00Z", "Asia/Tokyo")).toBe(
      "2026-11-03",
    );
    expect(completionDay("2026-11-01", "01:30:00", "America/Toronto")).toBe(
      "2026-11-01",
    );
    expect(() =>
      completionDay("2026-02-30", "12:00:00", site.timezone),
    ).toThrow();
    expect(() =>
      completionDay("2026-11-03", "24:00:00", site.timezone),
    ).toThrow();
    expect(() => completionDay("2026-11-03", "12:00:00", "invalid")).toThrow();
  });
  it("uses authoritative transaction tax while flagging apparent per-unit item tax", () => {
    const events = parseJournal(
      journal(
        eventXml({
          quantity: "2",
          gross: "20.00",
          tax: "1.00",
          total: "21.00",
        }),
      ),
      site,
    );
    const summary = summarize(events);
    expect(summary.totals.tax).toBe(100);
    expect(summary.issues).toEqual([
      expect.objectContaining({
        code: "item-tax",
        difference: -50,
        message: expect.stringContaining("per unit"),
      }),
    ]);
    expect(events[0].data.items[0].tax).toBe(50);
  });
  it("excludes void transactions, training/suspended sales, and corrected items", () => {
    const corrected = item("1", "10.00", "0.50").replace(
      'status="normal"',
      'status="errorcorrect"',
    );
    const events = parseJournal(
      journal(
        eventXml({ extra: corrected }),
        eventXml({ id: "2", type: "VoidEvent" }),
        eventXml({ id: "3", flags: '<TrainingModeFlag value="yes"/>' }),
        eventXml({ id: "4", flags: '<SuspendFlag value="yes"/>' }),
      ),
      site,
    );
    expect(summarize(events).totals).toMatchObject({
      sales: 1,
      voids: 1,
      gross: 1000,
      tax: 50,
      total: 1050,
    });
    expect(summarize(events).issues).toEqual([]);
  });
  it("blocks financial reconciliation failures, while not treating an item-tax discrepancy alone as blocking", () => {
    const events = parseJournal(journal(eventXml({ total: "99.00" })), site);
    expect(summarize(events).issues).toContainEqual(
      expect.objectContaining({ code: "summary", blocking: true }),
    );
  });
  it("retains signed promotions without subtracting them from sales a second time", () => {
    const xml = journal(eventXml()).replace(
      "<RegularSellPrice>",
      "<Promotion><PromotionID>P1</PromotionID><PromotionReason>offer</PromotionReason><PromotionAmount>-0.90</PromotionAmount></Promotion><RegularSellPrice>",
    );
    expect(summarize(parseJournal(xml, site)).totals).toMatchObject({
      gross: 1000,
      total: 1050,
      discounts: -90,
      discountLines: 1,
    });
  });
  it("accepts barcode-only line extensions without altering totals", () => {
    const xml = journal(eventXml()).replace(
      "</ItemLine>",
      "</ItemLine><Extension><Barcode><Symbology>101</Symbology><RowData>MTAwMA==</RowData></Barcode></Extension>",
    );
    expect(summarize(parseJournal(xml, site)).totals.total).toBe(1050);
  });
  it("rejects unmapped stores, DTDs, malformed XML, unknown sale lines and missing financial totals", () => {
    expect(() =>
      parseJournal(journal(eventXml()).replace("STORE", "OTHER"), site),
    ).toThrow("does not match");
    expect(() => parseJournal("<!DOCTYPE x><NAXML-POSJournal/>", site)).toThrow(
      "DTD",
    );
    expect(() => parseJournal("<NAXML-POSJournal>", site)).toThrow("Malformed");
    expect(() =>
      parseJournal(
        journal(eventXml())
          .replace("<ItemLine>", "<FuelLine>")
          .replace("</ItemLine>", "</FuelLine>"),
        site,
      ),
    ).toThrow("Unsupported");
    expect(() =>
      parseJournal(
        journal(eventXml()).replace(
          "<TransactionTotalNetAmount>10.50</TransactionTotalNetAmount>",
          "",
        ),
        site,
      ),
    ).toThrow("Incomplete");
  });
  it("calculates exact cents and rejects malformed values", () => {
    expect(cents("0.29")).toBe(29);
    expect(cents("-6.85")).toBe(-685);
    expect(cents("12.3")).toBe(1230);
    expect(() => cents("NaN")).toThrow();
    expect(() => cents("1.234")).toThrow();
  });
});

module.exports = { site, journal, eventXml };
