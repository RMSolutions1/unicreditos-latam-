const base = process.env.SMOKE_URL || `http://localhost:${process.env.API_PORT || 3001}`

async function call(path: string, init?: RequestInit) {
  const response = await fetch(`${base}${path}`, init)
  const data = await response.json()
  if (!response.ok) throw new Error(`${path} → ${data.message || response.status}`)
  return data
}

const health = await call('/api/health')
if (health.status !== 'ok') throw new Error('health failed')

const products = await call('/api/products')
if (!Array.isArray(products) || !products.length) throw new Error('products failed')

const fx = await call('/api/bcra/fx')
if (!fx.ok) throw new Error('bcra fx failed')

const login = await call('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'ana@unicreditos.com.ar', password: 'demo1234' }),
}).catch(() => call('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'ana@unicreditos.mx', password: 'demo1234' }),
}))
if (!login.token) throw new Error('login failed')

const account = await call('/api/account', { headers: { Authorization: `Bearer ${login.token}` } })
if (!account.credit) throw new Error('demo credit missing')

const pay = await call('/api/account/pay', {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ method: 'homebanking', count: 1 }),
})
if (!pay.account) throw new Error('pay failed')

console.log('Smoke OK', {
  health: health.status,
  resources: health.resources,
  product: products[0]?.name,
  fx: fx.fx?.length ?? 0,
  user: account.user.email,
  next: pay.account.nextPayment?.dueDate || 'sin pendiente inmediato',
})
