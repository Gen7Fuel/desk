export interface PurchaseOrderLike {
  _id: string
  customerName: string
  quantity: number
  amount: number
}

export interface CustomerRow<T extends PurchaseOrderLike = PurchaseOrderLike> {
  customerName: string
  entries: number
  totalQty: number
  totalAmount: number
  orders: Array<T>
}

export function normalizeKey(name: string): string {
  return (name || 'Unknown').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function buildCustomerRows<T extends PurchaseOrderLike>(
  orders: Array<T>,
): Array<CustomerRow<T>> {
  const map = new Map<
    string,
    { row: CustomerRow<T>; nameCounts: Map<string, number> }
  >()

  for (const o of orders) {
    const key = normalizeKey(o.customerName)
    const displayCandidate = (o.customerName || 'Unknown')
      .trim()
      .replace(/\s+/g, ' ')

    let entry = map.get(key)
    if (!entry) {
      entry = {
        row: {
          customerName: displayCandidate,
          entries: 0,
          totalQty: 0,
          totalAmount: 0,
          orders: [],
        },
        nameCounts: new Map(),
      }
      map.set(key, entry)
    }
    entry.row.entries += 1
    entry.row.totalQty += o.quantity || 0
    entry.row.totalAmount += o.amount || 0
    entry.row.orders.push(o)
    entry.nameCounts.set(
      displayCandidate,
      (entry.nameCounts.get(displayCandidate) || 0) + 1,
    )
  }

  return [...map.values()]
    .map(({ row, nameCounts }) => ({
      ...row,
      customerName: [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount)
}
