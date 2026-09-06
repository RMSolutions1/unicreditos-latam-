import './load-env.ts'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import cors from 'cors'
import express from 'express'
import { validateBankAccount } from './integrations/argenapi.ts'
import { getCotizaciones, getDeudas, isValidCuit } from './integrations/bcra.ts'
import { createDiditSession, diditStatus, mapDiditStatus, validateDiditWebhook } from './integrations/didit.ts'
import { emailStatus, sendEmail } from './integrations/email.ts'
import { createCheckout, getPayment, mpStatus, validateWebhookSignature } from './integrations/mercadopago.ts'
import { formatDate, quote, splitName } from './lib.ts'
import { adminStories, publicStories, reviewStory, submitStory, userStories } from './stories.ts'
import {
  accountSnapshot,
  attachCheckout,
  authenticate,
  catalog,
  createApplication,
  createSession,
  createUser,
  destroySession,
  findProduct,
  findUser,
  findUserByDiditSession,
  findUserByEmail,
  issueResetToken,
  listProducts,
  markNoticesRead,
  payNext,
  resetPassword,
  sessionUser,
  setUserKyc,
  settleByExternalRef,
  settleCredit,
} from './store.ts'

const app = express()
const port = Number(process.env.PORT || process.env.API_PORT || 3001)
const dist = resolve(process.cwd(), 'dist')

app.use(cors({ origin: process.env.WEB_ORIGIN || true, credentials: true }))
app.use(express.json({
  verify: (request, _response, buffer) => {
    (request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8')
  },
}))

function bearer(request: express.Request) {
  const header = request.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7) : String(request.headers['x-demo-token'] || '')
}

function requireUser(request: express.Request, response: express.Response) {
  const user = sessionUser(bearer(request))
  if (!user) {
    response.status(401).json({ message: 'Iniciá sesión para continuar' })
    return null
  }
  return user
}

function requireAdmin(request: express.Request, response: express.Response) {
  const user = requireUser(request, response)
  if (!user) return null
  if (user.role !== 'admin') {
    response.status(403).json({ message: 'Solo la mesa de UNICRÉDITOS puede publicar historias' })
    return null
  }
  return user
}

function resources() {
  return {
    mercadopago: mpStatus,
    didit: diditStatus,
    resend: emailStatus,
    argenapi: { configured: Boolean(process.env.ARGENAPI_API_KEY?.trim()) },
    bcra: { configured: true },
    neon: { configured: Boolean(process.env.DATABASE_URL?.trim()) },
  }
}

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    mode: 'live-resources',
    service: 'unicreditos',
    market: 'AR',
    time: new Date().toISOString(),
    resources: resources(),
  })
})

app.get('/api/products', (_request, response) => {
  response.json(listProducts())
})

app.post('/api/simulate', (request, response) => {
  const amount = Number(request.body?.amount)
  const months = Number(request.body?.months)
  const productId = String(request.body?.productId || 'personal')
  const product = findProduct(productId)
  if (!product || !amount || !months) {
    response.status(400).json({ message: 'Monto, plazo y producto son obligatorios' })
    return
  }
  response.json({ productId: product.id, product: product.name, ...quote(amount, months, product.monthlyRate) })
})

app.get('/api/bcra/fx', async (_request, response) => {
  try {
    const fx = await getCotizaciones()
    response.json({ ok: true, fx: fx.filter((row) => ['USD', 'EUR', 'BRL', 'CLP'].includes(row.moneda) || row.descripcion?.includes('Dólar')).slice(0, 8) })
  } catch (error) {
    response.status(502).json({ ok: false, message: error instanceof Error ? error.message : 'BCRA no disponible' })
  }
})

app.post('/api/bcra/deudores', async (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  const cuit = String(request.body?.cuit || user.cuil || '')
  if (!isValidCuit(cuit)) {
    response.status(400).json({ message: 'CUIL/CUIT inválido' })
    return
  }
  try {
    response.json({ ok: true, ...await getDeudas(cuit) })
  } catch (error) {
    response.status(502).json({ message: error instanceof Error ? error.message : 'No se pudo consultar el BCRA' })
  }
})

app.post('/api/cbu/validate', async (request, response) => {
  try {
    response.json(await validateBankAccount(String(request.body?.cbu || request.body?.alias || '')))
  } catch (error) {
    response.status(502).json({ ok: false, message: error instanceof Error ? error.message : 'ArgenAPI no disponible' })
  }
})

app.post('/api/kyc/start', async (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  try {
    const session = await createDiditSession({
      vendorData: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      dni: user.dni,
    })
    setUserKyc(user.id, 'reviewing', session.sessionId)
    response.json({ url: session.url, sessionId: session.sessionId, account: accountSnapshot(user) })
  } catch (error) {
    response.status(502).json({ message: error instanceof Error ? error.message : 'No se pudo iniciar Didit' })
  }
})

app.post('/api/webhooks/didit', (request, response) => {
  const raw = (request as express.Request & { rawBody?: string }).rawBody || JSON.stringify(request.body || {})
  const signature = String(request.headers['x-signature'] || request.headers['x-didit-signature'] || '')
  if (process.env.DIDIT_WEBHOOK_SECRET && !validateDiditWebhook(raw, signature)) {
    response.status(401).json({ ok: false })
    return
  }
  const body = request.body as { vendor_data?: string; session_id?: string; status?: string }
  const target = findUser(String(body.vendor_data || '')) || findUserByDiditSession(String(body.session_id || ''))
  if (target && body.status) setUserKyc(target.id, mapDiditStatus(body.status), body.session_id)
  response.json({ ok: true, service: 'didit' })
})

app.get('/api/webhooks/didit', (_request, response) => {
  response.json({ ok: true, service: 'didit' })
})

app.post('/api/auth/register', (request, response) => {
  const { name, email, password, phone, income, dni, cuil, cbu } = request.body as Record<string, string | undefined>
  if (!name || !email || !password || password.length < 6) {
    response.status(400).json({ message: 'Nombre, correo y una contraseña de al menos 6 caracteres son obligatorios' })
    return
  }
  if (findUserByEmail(email)) {
    response.status(409).json({ message: 'Ese correo ya tiene una cuenta. Iniciá sesión.' })
    return
  }
  const { firstName, lastName } = splitName(name)
  const user = createUser({
    firstName,
    lastName,
    email,
    phone: phone || '',
    income: Number(income) || 0,
    dni: dni || '',
    cuil: cuil || '',
    cbu: cbu || '',
    province: 'Argentina',
    password,
  })
  const session = authenticate(user.email, password)
  void sendEmail({
    to: user.email,
    subject: 'Tu cuenta UNICRÉDITOS',
    text: `Hola ${user.firstName}, tu cuenta ya está lista. Completá Didit y pedí tu crédito desde ${process.env.PUBLIC_SITE_URL || 'http://localhost:5173'}.`,
  })
  response.status(201).json({ token: session?.token, user: accountSnapshot(user).user })
})

app.post('/api/auth/login', (request, response) => {
  const { email, password } = request.body as Record<string, string | undefined>
  const session = authenticate(email || '', password || '')
  if (!session) {
    response.status(401).json({ message: 'Correo o contraseña incorrectos' })
    return
  }
  response.json({ token: session.token, user: accountSnapshot(session.user).user })
})

app.post('/api/auth/logout', (request, response) => {
  destroySession(bearer(request))
  response.json({ ok: true })
})

app.post('/api/auth/forgot', async (request, response) => {
  const email = String(request.body?.email || '')
  const issued = issueResetToken(email)
  if (issued) {
    const site = (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '')
    await sendEmail({
      to: issued.user.email,
      subject: 'Recuperá tu clave UNICRÉDITOS',
      text: `Usá este enlace para elegir una clave nueva: ${site}/?reset=${issued.token}`,
    })
  }
  response.json({ ok: true, message: 'Si el correo existe, te mandamos el enlace.' })
})

app.post('/api/auth/reset', (request, response) => {
  const user = resetPassword(String(request.body?.token || ''), String(request.body?.password || ''))
  if (!user || String(request.body?.password || '').length < 6) {
    response.status(400).json({ message: 'El enlace no es válido o la clave es corta' })
    return
  }
  response.json({ ok: true })
})

app.get('/api/account', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  response.json(accountSnapshot(user))
})

app.post('/api/account/notices/read', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  markNoticesRead(user.id)
  response.json(accountSnapshot(user))
})

app.post('/api/applications', (request, response) => {
  const body = request.body as {
    name?: string
    email?: string
    password?: string
    phone?: string
    income?: number
    productId?: string
    amount?: number
    months?: number
    dni?: string
    cuil?: string
    cbu?: string
  }
  let user = sessionUser(bearer(request))
  if (!user) {
    if (!body.name || !body.email || !body.password) {
      response.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios para crear tu cuenta' })
      return
    }
    const existing = findUserByEmail(body.email)
    if (existing) {
      const session = authenticate(body.email, body.password)
      if (!session) {
        response.status(409).json({ message: 'Ese correo ya existe. Iniciá sesión con tu contraseña.' })
        return
      }
      user = session.user
    } else {
      const { firstName, lastName } = splitName(body.name)
      user = createUser({
        firstName,
        lastName,
        email: body.email,
        phone: body.phone || '',
        income: Number(body.income) || 0,
        dni: body.dni || '',
        cuil: body.cuil || '',
        cbu: body.cbu || '',
        province: 'Argentina',
        password: body.password,
      })
    }
  } else {
    if (body.income) user.income = Number(body.income)
    if (body.phone) user.phone = body.phone
    if (body.dni) user.dni = body.dni
    if (body.cuil) user.cuil = body.cuil
    if (body.cbu) user.cbu = body.cbu
  }

  try {
    const application = createApplication({
      user,
      productId: body.productId || 'personal',
      amount: Number(body.amount),
      months: Number(body.months),
      dni: body.dni,
      cuil: body.cuil,
      cbu: body.cbu,
      phone: body.phone,
      income: body.income,
    })
    const sessionToken = bearer(request) && sessionUser(bearer(request)) ? bearer(request) : createSession(user.id)
    response.status(201).json({ application, account: accountSnapshot(user), token: sessionToken, user: accountSnapshot(user).user })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo crear la solicitud' })
  }
})

app.post('/api/account/pay', async (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  const method = String(request.body?.method || 'mercadopago')
  const count = Number(request.body?.count || 1)
  try {
    if (method === 'mercadopago' || method === 'rapipago') {
      const snapshot = accountSnapshot(user)
      if (!snapshot.nextPayment) throw new Error('No hay cuotas pendientes')
      const checkout = await createCheckout({
        amount: snapshot.nextPayment.amount * Math.max(1, count),
        userId: user.id,
        description: `Cuota ${snapshot.nextPayment.publicId} · UNICRÉDITOS`,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dni: user.dni,
        channel: method === 'rapipago' ? 'ticket' : 'all',
      })
      attachCheckout(user.id, checkout.preferenceId, checkout.externalReference)
      response.json({
        message: 'Link de Mercado Pago listo',
        checkout,
        account: accountSnapshot(user),
      })
      return
    }
    const result = payNext(user.id, method, count)
    response.json({ message: 'Pago registrado', payment: result.payment, paid: result.paid, account: accountSnapshot(user) })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo registrar el pago' })
  }
})

app.post('/api/account/prepay', async (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  const method = String(request.body?.method || 'homebanking')
  try {
    if (method === 'mercadopago') {
      const snapshot = accountSnapshot(user)
      const pending = snapshot.payments.filter((item) => item.status === 'Pendiente')
      if (!pending.length) throw new Error('No hay saldo pendiente')
      const amount = pending.reduce((sum, item) => sum + item.amount, 0)
      const checkout = await createCheckout({
        amount,
        userId: user.id,
        description: `Liquidación ${snapshot.credit?.publicId || ''} · UNICRÉDITOS`,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        dni: user.dni,
      })
      attachCheckout(user.id, checkout.preferenceId, checkout.externalReference)
      response.json({ message: 'Link de liquidación listo', checkout, account: accountSnapshot(user) })
      return
    }
    const result = settleCredit(user.id, method)
    response.json({ message: 'Liquidación registrada', paid: result.paid, account: accountSnapshot(user) })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo liquidar' })
  }
})

app.get('/api/webhooks/mercadopago', (_request, response) => {
  response.json({ ok: true, service: 'mercadopago', webhook: true })
})

app.post('/api/webhooks/mercadopago', async (request, response) => {
  const signed = validateWebhookSignature(
    {
      'x-signature': String(request.headers['x-signature'] || ''),
      'x-request-id': String(request.headers['x-request-id'] || ''),
    },
    request.body,
  )
  if (process.env.MERCADO_PAGO_WEBHOOK_SECRET && !signed) {
    response.status(401).json({ ok: false })
    return
  }
  const paymentId = String(request.body?.data?.id || request.query.id || '')
  if (!paymentId) {
    response.json({ ok: true })
    return
  }
  try {
    const payment = await getPayment(paymentId)
    const status = String((payment as { status?: string }).status || '')
    const external = String((payment as { external_reference?: string }).external_reference || '')
    if (status === 'approved' && external) settleByExternalRef(external)
    response.json({ ok: true, service: 'mercadopago' })
  } catch (error) {
    response.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'webhook' })
  }
})

app.get('/api/stories', (_request, response) => {
  response.json(publicStories())
})

app.get('/api/account/stories', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  response.json(userStories(user.id))
})

app.post('/api/account/stories', (request, response) => {
  const user = requireUser(request, response)
  if (!user) return
  try {
    const story = submitStory(user.id, { body: String(request.body?.body || ''), stars: Number(request.body?.stars) })
    response.status(201).json({ story, stories: userStories(user.id) })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo enviar la historia' })
  }
})

app.get('/api/admin/stories', (request, response) => {
  const admin = requireAdmin(request, response)
  if (!admin) return
  response.json(adminStories())
})

app.post('/api/admin/stories/:id/review', (request, response) => {
  const admin = requireAdmin(request, response)
  if (!admin) return
  const action = String(request.body?.action || '')
  if (action !== 'approve' && action !== 'reject') {
    response.status(400).json({ message: 'Indicá approve o reject' })
    return
  }
  try {
    const story = reviewStory(admin.id, String(request.params.id), action)
    response.json({ story, stories: adminStories() })
  } catch (error) {
    response.status(400).json({ message: error instanceof Error ? error.message : 'No se pudo revisar' })
  }
})

app.get('/api/demo', (_request, response) => {
  response.json({
    ...catalog.demo,
    alias: 'ana@unicreditos.mx',
    hint: 'Cuenta demo con crédito activo, línea disponible y calendario de pagos.',
    datesNote: formatDate('2026-09-22'),
  })
})

if (existsSync(dist)) {
  app.use(express.static(dist))
  app.use((request, response, next) => {
    if (request.path.startsWith('/api')) { next(); return }
    response.sendFile(resolve(dist, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Unicréditos listo en http://localhost:${port}`)
  console.log(`Demo: ${catalog.demo.email} / ${catalog.demo.password}`)
  console.log('Recursos', resources())
})
