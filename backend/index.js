const express = require('express')
const rateLimit = require('express-rate-limit')
const { connectToMongo } = require('./config/db')
const cipherRoutes = require('./apps/cipher/cipher.routes')
const authRoutes = require('./apps/auth/auth.routes')
const subscriptionsRoutes = require('./apps/subscriptions/subscription.routes')
const categoryRoutes = require('./apps/subscriptions/category.routes')
const credentialCategoryRoutes = require('./apps/credentials/credentialCategory.routes')
const credentialRoutes = require('./apps/credentials/credential.routes')
const personnelRoutes = require('./apps/personnel/personnel.routes')
const resourceKindRoutes = require('./apps/access/resourceKind.routes')
const deviceKindRoutes = require('./apps/assets/deviceKind.routes')
const locationRoutes = require('./apps/assets/location.routes')
const coremarkRoutes = require('./apps/inventory/coremark.routes')
const fuelInvoicingRoutes = require('./apps/fuel-invoicing/fuel-invoicing.routes')
const roleRoutes = require('./apps/roles/role.routes')
const userRoutes = require('./apps/users/user.routes')
const sageRoutes = require('./apps/sage/sage.routes')
const cdnRoutes = require('./apps/cdn/cdn.routes')
const logRoutes = require('./apps/logs/log.routes')
const issueRoutes = require('./apps/issues/issue.routes')
const siteAssetsRoutes = require('./apps/site-assets/site-assets.routes')
const academyRoutes = require('./apps/academy/course.routes')
const employeeRoutes = require('./apps/academy/employee.routes')
const completionRoutes = require('./apps/academy/completion.routes')
const academyMediaRoutes = require('./apps/academy/media.routes')
const narrativeRoutes = require('./apps/narrative/narrative.routes')

const app = express()
const port = 5000
app.set('trust proxy', 1) // Express is behind Caddy reverse proxy
app.use(express.json({ limit: '50mb' }))

const apiRouter = express.Router()
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute
  message: 'Too many requests, please try again later.'
})

apiRouter.use('/auth', authLimiter)
apiRouter.use('/seed', authLimiter)
apiRouter.use(authRoutes)
apiRouter.use(cipherRoutes)
apiRouter.use(categoryRoutes)
apiRouter.use(subscriptionsRoutes)
apiRouter.use(credentialCategoryRoutes)
apiRouter.use(credentialRoutes)
apiRouter.use('/personnel', personnelRoutes)
apiRouter.use('/access/resource-kinds', resourceKindRoutes)
apiRouter.use('/assets/device-kinds', deviceKindRoutes)
apiRouter.use('/assets/locations', locationRoutes)
apiRouter.use(coremarkRoutes)
apiRouter.use(fuelInvoicingRoutes)
apiRouter.use('/roles', roleRoutes)
apiRouter.use('/users', userRoutes)
apiRouter.use('/sage', sageRoutes)
apiRouter.use(cdnRoutes)
apiRouter.use(logRoutes)
apiRouter.use(issueRoutes)
apiRouter.use(siteAssetsRoutes)
apiRouter.use('/academy', academyRoutes)
apiRouter.use('/academy', employeeRoutes)
apiRouter.use('/academy', completionRoutes)
apiRouter.use('/academy', academyMediaRoutes)
apiRouter.use(narrativeRoutes)

app.use('/api', apiRouter)

app.get('/', (_, res) => {
  res.send('Hello World!')
})

// Health check — verify which version is deployed
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', started: new Date().toISOString() })
})

connectToMongo().then(() => {
  app.listen(port, () => {
    console.log(`API listening on port ${port}`)
  })
})
