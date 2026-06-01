const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL ?? 'http://email-service:2525'
const EMAIL_SERVICE_API_KEY = process.env.EMAIL_SERVICE_API_KEY

/**
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} [opts.html]
 * @param {string} [opts.text]
 * @param {string|string[]} [opts.cc]
 * @param {string|string[]} [opts.bcc]
 * @param {string} [opts.from]
 * @param {Array<{filename:string,content:string,encoding?:string,contentType?:string}>} [opts.attachments]
 */
export async function sendEmail(opts) {
  const res = await fetch(`${EMAIL_SERVICE_URL}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': EMAIL_SERVICE_API_KEY,
    },
    body: JSON.stringify(opts),
  })

  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error ?? `email-service responded ${res.status}`)
  return data
}
