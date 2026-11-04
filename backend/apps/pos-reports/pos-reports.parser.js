const { XMLParser, XMLValidator } = require("fast-xml-parser");
const { createHash } = require("node:crypto");
const hash = (value) =>
  createHash("sha256")
    .update(
      typeof value === "string" || Buffer.isBuffer(value)
        ? value
        : JSON.stringify(value),
    )
    .digest("hex");
const error = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const array = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => (typeof v === "string" ? v : "");
const cents = (v = "0") => {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(String(v)))
    throw error(`Invalid monetary amount: ${v}`);
  const sign = String(v).startsWith("-") ? -1 : 1;
  const [whole, fraction = ""] = String(v).replace("-", "").split(".");
  const amount = sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0")));
  if (!Number.isSafeInteger(amount) || Math.abs(amount) > 10000000000)
    throw error("Monetary amount exceeds supported range.");
  return amount;
};
function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
function validateTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
  } catch {
    throw error("A valid location timezone is required.");
  }
  if (!timezone) throw error("A valid location timezone is required.");
  return timezone;
}
function completionDay(date, time, timezone) {
  validateTimezone(timezone);
  // These journals record wall-clock timestamps, without an offset. Do not
  // convert them through UTC or through the server/browser's own timezone.
  if (
    !validDate(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
      time,
    )
  )
    throw error("Missing or invalid event completion timestamp.");
  if (/(Z|[+-]\d{2}:\d{2})$/.test(time)) {
    const instant = new Date(`${date}T${time}`);
    if (!Number.isFinite(instant.getTime()))
      throw error("Invalid event completion timestamp.");
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }
  return date;
}
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false,
});
function parseJournal(source, site) {
  if (Buffer.byteLength(source) > 16 * 1024 * 1024)
    throw error("XML file exceeds 16 MB.");
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw error("DTD and entity declarations are not supported.");
  if (XMLValidator.validate(source) !== true)
    throw error("Malformed XML journal.");
  const root = parser.parse(source)["NAXML-POSJournal"];
  if (!root) throw error("Expected NAXML-POSJournal XML.");
  const storeId = text(root.TransmissionHeader?.StoreLocationID);
  if (!site.storeLocationIds.includes(storeId))
    throw error(
      `StoreLocationID ${storeId || "(missing)"} does not match ${site.name}.`,
    );
  const events = [];
  for (const report of array(root.JournalReport)) {
    for (const [type, rawEvents] of Object.entries(report)) {
      if (!type.endsWith("Event")) continue;
      if (
        !["SaleEvent", "VoidEvent", "FinancialEvent", "OtherEvent"].includes(
          type,
        )
      )
        throw error(`Unsupported event type: ${type}`);
      for (const raw of array(rawEvents)) {
        const id = text(raw.TransactionID),
          register = text(raw.RegisterID),
          till = text(raw.TillID);
        const sequence = text(raw.EventSequenceID),
          date = text(raw.EventEndDate),
          time = text(raw.EventEndTime);
        if (!id || !register || !sequence)
          throw error(
            "Journal event is missing its transaction, register, or sequence ID.",
          );
        const day = completionDay(date, time, site.timezone);
        const key = [
          storeId,
          register,
          till,
          text(raw.BusinessDate),
          id,
          type,
          sequence,
        ].join("|");
        const issues = [],
          items = [],
          tenders = [];
        const lines = array(raw.TransactionDetailGroup?.TransactionLine);
        for (const line of lines) {
          const status = text(line["@_status"]);
          if (!["normal", "errorcorrect", "void", "cancel"].includes(status))
            throw error(`Unsupported transaction line status: ${status}`);
          for (const item of array(line.ItemLine)) {
            const quantity = Number(item.SalesQuantity);
            if (!Number.isFinite(quantity))
              throw error("Invalid item quantity.");
            const taxes = array(item.ItemTax).map((t) => ({
              level: text(t.TaxLevelID),
              amount: cents(t.TaxCollectedAmount),
            }));
            items.push({
              line: text(line.TransactionLineSequenceNumber),
              status,
              active: status === "normal",
              code: text(item.ItemCode?.POSCode),
              description: text(item.Description),
              department: text(item.MerchandiseCode),
              quantity,
              amount: cents(item.SalesAmount),
              unitPrice: cents(item.ActualSalesPrice),
              regularPrice: cents(item.RegularSellPrice),
              taxes,
              tax: taxes.reduce((s, t) => s + t.amount, 0),
              promotions: array(item.Promotion).map((p) => ({
                id: text(p.PromotionID),
                reason: text(p.PromotionReason),
                amount: cents(p.PromotionAmount),
              })),
              discounts: array(item.Discount).map((d) => ({
                reason: text(d.DiscountReason),
                amount: cents(d.DiscountAmount),
              })),
            });
          }
          for (const tender of array(line.TenderInfo))
            tenders.push({
              code: text(tender.Tender?.TenderCode),
              subCode: text(tender.Tender?.TenderSubCode),
              amount: cents(tender.TenderAmount),
              change: tender.ChangeFlag?.["@_value"] === "yes",
              active: status === "normal",
            });
          // SmartPOS puts scanned barcode metadata beside some item/tender lines.
          // It has no financial effect; other extension types require investigation.
          if (
            line.Extension &&
            Object.keys(line.Extension).some((k) => k !== "Barcode")
          )
            throw error("Unsupported transaction line extension.");
          const supported = new Set([
            "@_status",
            "TransactionLineSequenceNumber",
            "ItemLine",
            "TenderInfo",
            "Extension",
          ]);
          const unknown = Object.keys(line).filter((k) => !supported.has(k));
          if (unknown.length)
            throw error(
              `Unsupported transaction line content: ${unknown.join(", ")}`,
            );
        }
        const summary = raw.TransactionSummary;
        if (["SaleEvent", "VoidEvent"].includes(type) && !summary)
          throw error("Sale/void event has no transaction summary.");
        if (
          summary &&
          [
            "TransactionTotalGrossAmount",
            "TransactionTotalNetAmount",
            "TransactionTotalTaxNetAmount",
          ].some((field) => summary[field] == null)
        )
          throw error("Incomplete transaction summary.");
        const gross = cents(summary?.TransactionTotalGrossAmount),
          total = cents(summary?.TransactionTotalNetAmount);
        const tax = cents(summary?.TransactionTotalTaxNetAmount),
          fees = cents(summary?.TransactionTotalFeeNetAmount),
          rounding = cents(summary?.RoundingAmount);
        const activeItems = items.filter((i) => i.active);
        const itemTax = activeItems.reduce((s, i) => s + i.tax, 0);
        const quantityTax = activeItems.reduce(
          (s, i) => s + Math.round(i.tax * i.quantity),
          0,
        );
        if (summary && itemTax !== tax)
          issues.push({
            code: "item-tax",
            message:
              quantityTax === tax
                ? "Item tax appears to be per unit; transaction tax total used."
                : "Item tax differs from transaction tax; transaction tax total used.",
            difference: itemTax - tax,
          });
        if (summary && gross + tax + fees + rounding !== total)
          issues.push({
            code: "summary",
            message:
              "Sales plus tax, fees and rounding do not match the transaction total.",
            blocking: true,
          });
        if (
          type === "SaleEvent" &&
          tenders.filter((t) => t.active).reduce((s, t) => s + t.amount, 0) !==
            total
        )
          issues.push({
            code: "tender",
            message:
              "Payments minus change do not match the transaction total.",
            blocking: true,
          });
        if (summary && activeItems.reduce((s, i) => s + i.amount, 0) !== gross)
          issues.push({
            code: "items",
            message: "Active item amounts do not match transaction sales.",
            blocking: true,
          });
        const excluded =
          raw.TrainingModeFlag?.["@_value"] === "yes" ||
          raw.SuspendFlag?.["@_value"] === "yes";
        const operation = ["CashierDetail", "ShiftDetail", "DayDetail"]
          .filter((k) => raw[k])
          .map((k) => `${k}:${raw[k]["@_detailType"] || ""}`)
          .join("; ");
        const closing = raw.OtherEventExtension?.EndOfCashierDetails;
        const data = {
          key,
          type,
          id,
          storeId,
          register,
          till,
          cashier: text(raw.CashierID),
          date: day,
          timezone: site.timezone,
          businessDate: text(raw.BusinessDate),
          endDate: date,
          endTime: time,
          excluded,
          gross,
          total,
          tax,
          fees,
          rounding,
          items,
          tenders,
          operation,
          drop: cents(raw.FinancialEventDetail?.SafeDropDetail?.DropAmount),
          closingCash: closing ? cents(closing.ClosingCash) : null,
          openingCash: closing ? cents(closing.OpeningCash) : null,
          issues,
        };
        events.push({ key, date: day, hash: hash(raw), data });
      }
    }
  }
  if (!events.length) throw error("No supported journal events found.");
  return events;
}
function summarize(events) {
  const totals = {
    sales: 0,
    voids: 0,
    gross: 0,
    tax: 0,
    fees: 0,
    rounding: 0,
    total: 0,
    quantity: 0,
    taxableSales: 0,
    untaxedSales: 0,
    discounts: 0,
    discountLines: 0,
    cash: 0,
    otherPayments: 0,
    safeDrops: 0,
  };
  const issues = [],
    payments = {},
    departments = {};
  for (const event of events) {
    const e = event.data || event;
    if (e.excluded) continue;
    issues.push(...e.issues.map((i) => ({ ...i, transactionId: e.id })));
    if (e.type === "VoidEvent") totals.voids++;
    if (e.type === "FinancialEvent") totals.safeDrops += e.drop;
    if (e.type !== "SaleEvent") continue;
    totals.sales++;
    for (const key of ["gross", "tax", "fees", "rounding", "total"])
      totals[key] += e[key];
    for (const item of e.items.filter((i) => i.active)) {
      totals.quantity += item.quantity;
      totals[item.taxes.length ? "taxableSales" : "untaxedSales"] +=
        item.amount;
      const discount = [...item.promotions, ...item.discounts].reduce(
        (s, d) => s + d.amount,
        0,
      );
      totals.discounts += discount;
      if (item.promotions.length || item.discounts.length)
        totals.discountLines++;
      departments[item.department] =
        (departments[item.department] || 0) + item.amount;
    }
    for (const tender of e.tenders.filter((t) => t.active)) {
      const key = `${tender.code}/${tender.subCode}`;
      payments[key] = (payments[key] || 0) + tender.amount;
      totals[tender.code === "Cash" ? "cash" : "otherPayments"] +=
        tender.amount;
    }
  }
  return { totals, issues, payments, departments };
}
module.exports = {
  parseJournal,
  summarize,
  completionDay,
  validateTimezone,
  validDate,
  cents,
  hash,
  error,
};
