const { createHash } = require('node:crypto')
const service = require('./tradogram.service')
const { resolveVendor } = require('./tradogram.vendor')
const { getSettings } = require('./tradogram.settings')
const { configuredSage } = require('./tradogram.sage')
const error = service.error
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')
const blocked = (draft) =>
  ['creating', 'created', 'uncertain'].includes(draft.intacctCreationState) ||
  !!draft.intacctBillKey

function date(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    throw error('Enter a valid invoice date and due date.')
  }
  return value
}
function cents(value) {
  const result = Math.round(value * 100)
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(result) ||
    value < 0 ||
    Math.abs(result - value * 100) > 0.00001
  )
    throw error('The delivery contains an invalid monetary amount.', 422)
  return result
}
function buildBill(preview) {
  return {
    state: 'draft',
    billNumber: preview.billNumber,
    vendor: { id: preview.vendor.id },
    description: `Tradogram ${preview.poNumber}; delivery ${preview.deliveryCode}. Subtotal only; review tax, fees and discounts before posting.`,
    referenceNumber: `Tradogram ${preview.deliveryCode}`,
    createdDate: preview.invoiceDate,
    postingDate: preview.invoiceDate,
    dueDate: preview.dueDate,
    currency: { baseCurrency: 'CAD', txnCurrency: 'CAD' },
    lines: preview.lines.map((line) => ({
      glAccount: { id: line.accountId },
      txnAmount: (line.amountCents / 100).toFixed(2),
      memo: `${preview.site}: ${line.name}; received ${line.quantity}. ${preview.notes}`.slice(
        0,
        1000,
      ),
      hasForm1099: 'false',
      dimensions: {
        location: { id: preview.entityId },
        vendor: { id: preview.vendor.id },
      },
    })),
  }
}

const repository = {
  getDraft: (code) =>
    require('./tradogram.model')
      .DeliveryDraft.findOne({ deliveryCode: code })
      .lean(),
  getSite: (site) =>
    require('./tradogram.model').SiteAccount.findOne({ site }).lean(),
  async claim(code, preview, actor) {
    const { DeliveryDraft } = require('./tradogram.model')
    await DeliveryDraft.init()
    try {
      return await DeliveryDraft.findOneAndUpdate(
        {
          deliveryCode: code,
          revision: preview.revision,
          sourceHash: preview.sourceHash,
          configHash: preview.configHash,
          status: 'ready',
          intacctBillKey: '',
          intacctCreationState: { $nin: ['creating', 'created', 'uncertain'] },
        },
        {
          $set: {
            intacctCreationState: 'creating',
            intacctPreviewHash: preview.hash,
            intacctEntityId: preview.entityId,
            intacctVendorId: preview.vendor.id,
            intacctBillNumber: preview.billNumber,
            intacctBillNumberKey: preview.billNumber.toLowerCase(),
            intacctCreatedBy: actor,
          },
        },
        { returnDocument: 'after', runValidators: true },
      ).lean()
    } catch (err) {
      if (err.code === 11000)
        throw error(
          'This vendor and bill number are already reserved by another delivery. Review that bill or use a distinct bill number for this receipt.',
          409,
        )
      throw err
    }
  },
  async finish(code, previewHash, values) {
    const result = await require('./tradogram.model').DeliveryDraft.updateOne(
      {
        deliveryCode: code,
        intacctPreviewHash: previewHash,
        intacctCreationState: 'creating',
      },
      { $set: values },
    )
    if (result.matchedCount !== 1)
      throw error('Desk could not save the Intacct creation result.', 502)
  },
}

function createIntegration({
  repo = repository,
  sourceApi = service,
  vendorLookup = resolveVendor,
  sageFactory = configuredSage,
  settings = getSettings,
} = {}) {
  async function preview(code, input = {}) {
    if (!/^[A-Za-z0-9]{12}$/.test(code))
      throw error('Invalid Tradogram delivery code.')
    if (!input || typeof input !== 'object')
      throw error('Enter the bill fields.')
    const draft = await repo.getDraft(code)
    if (!draft || draft.status !== 'ready')
      throw error(
        'Save and mark this delivery ready before previewing an Intacct draft.',
        409,
      )
    if (blocked(draft))
      throw error(
        'This delivery already has a creation attempt. Check its Intacct reference before retrying.',
        409,
      )
    const source = await sourceApi.loadDelivery(code)
    const config = await repo.getSite(draft.site)
    const prepared = sourceApi.prepare(
      source,
      draft,
      config,
      await sourceApi.listGLAccounts(),
    )
    if (
      draft.sourceHash !== source.sourceHash ||
      draft.configHash !== prepared.configHash
    )
      throw error(
        'The delivery or account settings changed. Reload, review and mark ready again.',
        409,
      )
    const reference = await vendorLookup(source)
    const company = settings()
    if (
      reference.issue ||
      !reference.vendor ||
      reference.vendor.entityId !== company.entityId
    )
      throw error(
        reference.issue ||
          'The Intacct vendor company does not match this integration.',
        422,
      )
    if (prepared.issues.length) throw error(prepared.issues.join(' '), 422)
    if (source.currency !== 'CAD')
      throw error(
        'Only CAD deliveries are supported for Intacct draft creation.',
        422,
      )
    const billNumber =
      typeof input.billNumber === 'string' ? input.billNumber.trim() : ''
    if (
      !billNumber ||
      billNumber.length > 100 ||
      /[\x00-\x1f]/.test(billNumber)
    )
      throw error(
        'Enter a bill number of up to 100 characters; use a distinct number for each partial receipt.',
      )
    const invoiceDate = date(input.invoiceDate),
      dueDate = date(input.dueDate)
    if (dueDate < invoiceDate)
      throw error('The due date cannot precede the invoice date.')
    const lines = prepared.lines.map((line) => ({
      id: line.id,
      name: line.name,
      quantity: line.quantity,
      accountId: line.accountId,
      accountName: line.accountName,
      amountCents: cents(line.amount),
    }))
    const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0)
    if (
      !Number.isSafeInteger(totalCents) ||
      totalCents <= 0 ||
      totalCents !== cents(source.subtotal)
    )
      throw error(
        'The delivery amounts do not reconcile to a positive subtotal.',
        422,
      )
    const result = {
      ...company,
      deliveryCode: code,
      poNumber: source.poNumber,
      site: draft.site,
      vendor: reference.vendor,
      billNumber,
      invoiceDate,
      postingDate: invoiceDate,
      dueDate,
      currency: 'CAD',
      totalCents,
      lines,
      notes: draft.notes || '',
      subtotalOnly: true,
      revision: draft.revision,
      sourceHash: source.sourceHash,
      configHash: prepared.configHash,
    }
    return { ...result, hash: hash(result) }
  }
  return {
    preview,
    async createDraft(code, input = {}, actor) {
      if (!/^[A-Za-z0-9]{12}$/.test(code))
        throw error('Invalid Tradogram delivery code.')
      if (!input || typeof input !== 'object')
        throw error('Preview the Intacct draft before creating it.')
      if (input.subtotalAcknowledged !== true)
        throw error(
          'Confirm that tax, fees and discounts must be reviewed in Intacct before posting.',
        )
      if (!/^[a-f0-9]{64}$/.test(input.previewHash || ''))
        throw error('Preview the Intacct draft before creating it.')
      const saved = await repo.getDraft(code)
      if (saved?.intacctBillKey)
        return {
          billKey: saved.intacctBillKey,
          billNumber: saved.intacctBillNumber,
          entityId: saved.intacctEntityId,
          state: 'draft',
          alreadyCreated: true,
        }
      const expected = await preview(code, input)
      if (expected.hash !== input.previewHash)
        throw error(
          'The delivery, vendor or bill fields changed. Review a fresh preview.',
          409,
        )
      if (!(await repo.claim(code, expected, actor)))
        throw error(
          'This delivery changed or a creation attempt is already in progress. Reload before continuing.',
          409,
        )
      let sent = false,
        billKey
      try {
        const sage = sageFactory(expected.entityId)
        if (await sage.findBill(expected.vendor.id, expected.billNumber))
          throw error(
            'This vendor and bill number already exist in Intacct. Review the existing bill.',
            409,
          )
        sent = true
        billKey = await sage.createBill(buildBill(expected))
        await repo.finish(code, expected.hash, {
          intacctCreationState: 'created',
          intacctBillKey: billKey,
        })
        return {
          billKey,
          billNumber: expected.billNumber,
          entityId: expected.entityId,
          state: 'draft',
          alreadyCreated: false,
        }
      } catch (err) {
        const uncertain = sent && (!err.safeToRetry || !!billKey)
        await repo
          .finish(code, expected.hash, {
            intacctCreationState: uncertain ? 'uncertain' : 'failed',
            ...(billKey ? { intacctBillKey: billKey } : {}),
          })
          .catch(() => {})
        if (billKey)
          throw error(
            `Intacct created draft ${billKey}, but Desk could not save its reference. Check Intacct before retrying.`,
            502,
          )
        if (uncertain)
          throw error(
            'The Intacct creation result is uncertain. Check Intacct before retrying to avoid a duplicate bill.',
            502,
          )
        throw err
      }
    },
  }
}
module.exports = { createIntegration, buildBill }
