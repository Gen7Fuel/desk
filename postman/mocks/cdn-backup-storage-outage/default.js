// Deliberately models only a dependency outage, not Azure's successful storage behavior.
const http = require('node:http');
http.createServer((req, res) => {
  req.resume();
  res.writeHead(503, { 'Content-Type': 'application/xml', 'x-ms-request-id': 'cdn-outage-test', 'x-ms-error-code': 'ServerBusy' });
  res.end('<?xml version="1.0" encoding="utf-8"?><Error><Code>ServerBusy</Code><Message>Simulated storage outage</Message></Error>');
}).listen(process.env.PORT || 4019);
