const sql = require('mssql')

let pool = null

async function getPool() {
  if (pool && pool.connected) return pool
  if (pool) {
    try { await pool.close() } catch {}
  }
  pool = await sql.connect({
    server: '4pointment-management.database.windows.net',
    database: '4POINTMANAGEMENT',
    user: process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    requestTimeout: 30000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
  })
  pool.on('error', (err) => {
    console.error('Narrative SQL pool error:', err)
    pool = null
  })
  return pool
}

async function saveStationNarrative(csoCode, legalName, reportDate, narrativeText, suggestion) {
  const p = await getPool()
  const req = p.request()
  const now = new Date()
  req.input('Station_SK', sql.VarChar, String(csoCode))
  req.input('Station', sql.NVarChar, legalName)
  req.input('ReportDate', sql.Date, reportDate)
  req.input('NarrativeText', sql.NVarChar(sql.MAX), narrativeText)
  req.input('Suggestion', sql.NVarChar(sql.MAX), suggestion || null)
  req.input('Now', sql.DateTime, now)
  await req.query(`
    MERGE INTO [FIN].[StationNarrativeSummary] AS target
    USING (SELECT @Station_SK AS Station_SK, @Station AS Station, @ReportDate AS ReportDate,
                  @NarrativeText AS NarrativeText, @Suggestion AS Suggestion, @Now AS Now) AS source
    ON target.Station_SK = source.Station_SK AND target.ReportDate = source.ReportDate
    WHEN MATCHED THEN
      UPDATE SET NarrativeText = source.NarrativeText, Suggestion = source.Suggestion, UpdatedAt = source.Now
    WHEN NOT MATCHED THEN
      INSERT (Station_SK, Station, ReportDate, NarrativeText, Suggestion, CreatedAt, UpdatedAt)
      VALUES (source.Station_SK, source.Station, source.ReportDate, source.NarrativeText, source.Suggestion, source.Now, source.Now);
  `)
}

async function getStationNarrative(csoCode, reportDate) {
  const p = await getPool()
  const req = p.request()
  req.input('Station_SK', sql.VarChar, String(csoCode))
  req.input('ReportDate', sql.Date, reportDate)
  const result = await req.query(`
    SELECT Station_SK, Station, ReportDate, NarrativeText, Suggestion, CreatedAt, UpdatedAt
    FROM [FIN].[StationNarrativeSummary]
    WHERE Station_SK = @Station_SK AND ReportDate = @ReportDate
  `)
  return result.recordset[0] || null
}

async function getStationNarratives(csoCode) {
  const p = await getPool()
  const req = p.request()
  req.input('Station_SK', sql.VarChar, String(csoCode))
  const result = await req.query(`
    SELECT Station_SK, Station, ReportDate, NarrativeText, CreatedAt, UpdatedAt
    FROM [FIN].[StationNarrativeSummary]
    WHERE Station_SK = @Station_SK
    ORDER BY ReportDate DESC
  `)
  return result.recordset
}

module.exports = { saveStationNarrative, getStationNarrative, getStationNarratives }
