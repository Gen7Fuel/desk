const express = require('express')
const router = express.Router()
const multer = require('multer')
const XLSX = require('xlsx')

const upload = multer({ storage: multer.memoryStorage() })

function isoUtcNowMs() {
	const iso = new Date().toISOString()
	// Ensure millisecond precision with Z suffix
	return iso.replace(/(\.\d{3})\d*Z$/, '$1Z')
}

function readItemsFromSheet(wb, sheetName) {
	const ws = wb.Sheets[sheetName]
	if (!ws) throw new Error(`Sheet '${sheetName}' not found`)

	// raw: false returns formatted cell values (preserves zero-padded UPC strings)
	const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null })

	// Columns (0-based):
	// D = 3  (UPC)
	// E = 4  (SKU)
	// L = 11 (Qty — regular case)
	// M = 12 (Broken Case flag ✔)
	// N = 13 (Qty — broken case)
	const UPC_COL = 3
	const SKU_COL = 4
	const BC_COL  = 12
	const N_COL   = 13

	const items = []

	// Row 0 is the header; start at index 1
	for (let i = 1; i < rows.length; i++) {
		const row = rows[i]
		if (!row || row.length === 0) continue

		const upcRaw = row[UPC_COL]
		const skuRaw = row[SKU_COL]
		const bcVal  = row[BC_COL]
		const nVal   = row[N_COL]

		const upc = upcRaw != null ? String(upcRaw).trim() : null
		if (!upc) continue

		const sku   = skuRaw != null ? String(skuRaw).trim() : ''
		const bcStr = bcVal  != null ? String(bcVal).trim()  : ''
		const isBc  = bcStr === '✔'

		let qty
		if (isBc) {
			if (nVal == null || String(nVal).trim() === '') {
				qty = null
			} else {
				const parsed = parseFloat(String(nVal))
				qty = isNaN(parsed) ? null : Math.round(parsed)
			}
		} else {
			qty = 1
		}

		if (qty == null || qty <= 0) continue

		items.push({
			QuantityOrdered: qty,
			ItemId: null,
			IsBc: isBc,
			Sku: sku,
			Upc: upc,
			Upc2: null,
		})
	}

	return items
}

function buildOrderPayload(items) {
	return {
		Version: '3.0',
		ModifiedDate: isoUtcNowMs(),
		Data: {
			Items: items,
			OrderType: 1,
			PurchaseOrderNo: '',
			Sic1: '',
			Sic2: '',
			Notes: '',
			SeparateInvoice: false,
		},
	}
}

router.post('/inventory/coremark/process', upload.single('file'), (req, res) => {
	if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

	let wb
	try {
		wb = XLSX.read(req.file.buffer, { type: 'buffer' })
	} catch (err) {
		return res.status(400).json({ error: 'Failed to parse Excel file: ' + err.message })
	}

	const results = []
	const errors  = []

	for (const sheetName of wb.SheetNames) {
		try {
			const items   = readItemsFromSheet(wb, sheetName)
			const payload = buildOrderPayload(items)
			results.push({
				name:      sheetName,
				filename:  `${sheetName}.order`,
				itemCount: items.length,
				content:   JSON.stringify(payload, null, 2),
			})
		} catch (err) {
			errors.push({ sheet: sheetName, error: err.message })
		}
	}

	res.json({ results, errors })
})

module.exports = router
