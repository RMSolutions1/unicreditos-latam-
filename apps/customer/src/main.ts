import './style.css'
import {
  api,
  getAccessToken,
  setTokens,
  type CreditApplication,
  type Installment,
  type Quote,
  type SessionUser,
} from './api'

const root = document.getElementById('app')!

function money(value: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value))
}

function dateFmt(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

/**
 * Todo el DOM se arma con innerHTML por simplicidad (mismo criterio que apps/admin) -- cualquier
 * valor que pueda originarse en input de usuario DEBE pasar por acá antes de interpolarse.
 */
function escapeHtml(value: string | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Enviada',
  PRE_APPROVED: 'Pre-aprobada',
  MANUAL_REVIEW: 'En revisión',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  READY_FOR_DISBURSEMENT: 'Lista para desembolso',
  DISBURSED: 'Desembolsada',
  CANCELLED: 'Cancelada',
  ACTIVE: 'Activo',
  PAID_OFF: 'Cancelado',
  PENDING: 'Pendiente',
  PARTIALLY_PAID: 'Pago parcial',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  EXPIRED: 'Expirado',
  CREATED: 'Creado',
  IN_PROGRESS: 'En progreso',
}

function statusBadge(status: string) {
  return `<span class="status-badge status-${escapeHtml(status.toLowerCase())}">${escapeHtml(STATUS_LABEL[status] ?? status)}</span>`
}

function setBody(html: string) {
  const el = document.getElementById('page-content')
  if (el) el.innerHTML = html
  else root.innerHTML = html
}

async function runAction(button: HTMLButtonElement, action: () => Promise<unknown>, onDone: () => void) {
  const original = button.textContent
  button.disabled = true
  button.textContent = '…'
  try {
    await action()
    onDone()
  } catch (error) {
    alert(error instanceof Error ? error.message : 'No se pudo completar la acción.')
    button.disabled = false
    button.textContent = original
  }
}

// ---------------------------------------------------------------------------
// Layout público (antes de iniciar sesión)
// ---------------------------------------------------------------------------

function renderPublicShell(activeHash: string, bodyHtml: string) {
  root.innerHTML = `
    <div class="topbar">
      <a href="#/" class="brand">UNI<span>CRÉDITOS</span></a>
      <nav class="topbar-nav">
        <a href="#/productos" class="navlink ${activeHash.startsWith('#/productos') ? 'active' : ''}">Productos</a>
        <a href="#/login" class="navlink ${activeHash.startsWith('#/login') ? 'active' : ''}">Ingresar</a>
        <a href="#/registro" class="navlink ${activeHash.startsWith('#/registro') ? 'active' : ''}">Registrarme</a>
      </nav>
    </div>
    <div id="page-content" style="flex:1;display:flex;flex-direction:column;">${bodyHtml}</div>
  `
}

function renderLanding() {
  renderPublicShell('#/', `
    <div class="hero">
      <h1>Crédito online, <span>simple y transparente</span></h1>
      <p>Simulá tu crédito, pedilo online y seguí cada paso: revisión humana, contrato claro y pagos con Mercado Pago o AstroPay.</p>
      <div class="hero-actions">
        <a href="#/productos"><button class="auto">Ver productos</button></a>
        <a href="#/registro"><button class="auto secondary">Crear cuenta</button></a>
      </div>
    </div>
  `)
}

async function renderPublicProducts() {
  renderPublicShell('#/productos', `<div class="page-wrap"><div class="loading">Cargando…</div></div>`)
  try {
    const products = await api.creditProducts()
    setBody(`
      <div class="page-wrap wide">
        <h1 class="page-title">Productos de crédito</h1>
        <p class="page-subtitle">Tasas y montos reales de cada producto activo.</p>
        <div class="grid">
          ${products
            .map(
              (p) => `
            <div class="product-card">
              <h3>${escapeHtml(p.name)}</h3>
              <div class="rate">${Number(p.monthlyRate).toFixed(2)}% TNM</div>
              <div class="meta">Desde ${money(p.minAmount)} hasta ${money(p.maxAmount)}</div>
              <div class="meta">${p.minTermMonths} a ${p.maxTermMonths} meses</div>
              <div class="meta">Cuota de ejemplo (monto mínimo): ${money(p.sampleQuote.monthlyPayment)}</div>
            </div>
          `,
            )
            .join('') || '<div class="empty">No hay productos activos por el momento.</div>'}
        </div>
        <p class="page-subtitle" style="margin-top:24px;">¿Ya sabés cuánto necesitás? <a href="#/registro">Creá tu cuenta</a> para solicitar un crédito.</p>
      </div>
    `)
  } catch (error) {
    setBody(`<div class="page-wrap"><div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudieron cargar los productos.')}</div></div>`)
  }
}

function renderLogin(errorMessage?: string) {
  renderPublicShell('#/login', `
    <div class="center-screen">
      <form class="card" id="login-form">
        <h1>Iniciar sesión</h1>
        <p class="subtitle">Ingresá con tu cuenta de UNICRÉDITOS</p>
        ${errorMessage ? `<div class="error-box">${escapeHtml(errorMessage)}</div>` : ''}
        <label for="email">Correo</label>
        <input id="email" name="email" type="email" required autocomplete="username" />
        <label for="password">Contraseña</label>
        <input id="password" name="password" type="password" required autocomplete="current-password" />
        <button type="submit" id="submit-btn">Ingresar</button>
        <p class="card-footer-link">¿No tenés cuenta? <a href="#/registro">Registrate</a></p>
      </form>
    </div>
  `)

  const form = document.getElementById('login-form') as HTMLFormElement
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = document.getElementById('submit-btn') as HTMLButtonElement
    const email = (document.getElementById('email') as HTMLInputElement).value.trim()
    const password = (document.getElementById('password') as HTMLInputElement).value
    button.disabled = true
    button.textContent = 'Ingresando…'
    try {
      const { accessToken, refreshToken } = await api.login(email, password)
      setTokens(accessToken, refreshToken)
      location.hash = '#/cuenta'
      await boot()
    } catch (error) {
      renderLogin(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    }
  })
}

function renderRegister(errorMessage?: string) {
  renderPublicShell('#/registro', `
    <div class="center-screen">
      <form class="card" id="register-form">
        <h1>Crear cuenta</h1>
        <p class="subtitle">Empezá tu solicitud de crédito en minutos</p>
        ${errorMessage ? `<div class="error-box">${escapeHtml(errorMessage)}</div>` : ''}
        <label for="firstName">Nombre</label>
        <input id="firstName" required minlength="2" />
        <label for="lastName">Apellido</label>
        <input id="lastName" required minlength="2" />
        <label for="email">Correo</label>
        <input id="email" type="email" required autocomplete="username" />
        <label for="phone">Teléfono (opcional)</label>
        <input id="phone" />
        <label for="password">Contraseña</label>
        <input id="password" type="password" required minlength="12" autocomplete="new-password" />
        <p class="field-hint">Mínimo 12 caracteres.</p>
        <button type="submit" id="submit-btn">Crear cuenta</button>
        <p class="card-footer-link">¿Ya tenés cuenta? <a href="#/login">Iniciá sesión</a></p>
      </form>
    </div>
  `)

  const form = document.getElementById('register-form') as HTMLFormElement
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = document.getElementById('submit-btn') as HTMLButtonElement
    const firstName = (document.getElementById('firstName') as HTMLInputElement).value.trim()
    const lastName = (document.getElementById('lastName') as HTMLInputElement).value.trim()
    const email = (document.getElementById('email') as HTMLInputElement).value.trim()
    const phone = (document.getElementById('phone') as HTMLInputElement).value.trim()
    const password = (document.getElementById('password') as HTMLInputElement).value
    button.disabled = true
    button.textContent = 'Creando…'
    try {
      const { accessToken, refreshToken } = await api.register({ firstName, lastName, email, phone: phone || undefined, password })
      setTokens(accessToken, refreshToken)
      location.hash = '#/cuenta'
      await boot()
    } catch (error) {
      renderRegister(error instanceof Error ? error.message : 'No se pudo crear la cuenta.')
      button.disabled = false
    }
  })
}

// ---------------------------------------------------------------------------
// Layout de cuenta (autenticado)
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { hash: '#/cuenta', label: 'Inicio' },
  { hash: '#/cuenta/solicitar', label: 'Solicitar crédito' },
  { hash: '#/cuenta/solicitudes', label: 'Mis solicitudes' },
  { hash: '#/cuenta/creditos', label: 'Mis créditos' },
  { hash: '#/cuenta/kyc', label: 'Verificación de identidad' },
  { hash: '#/cuenta/perfil', label: 'Mi perfil' },
]

function renderAccountShell(user: SessionUser, activeHash: string, bodyHtml: string) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <a href="#/cuenta" class="sidebar-brand" style="text-decoration:none;color:inherit;">UNI<span>CRÉDITOS</span></a>
        <nav class="sidebar-nav">
          ${NAV_ITEMS.map((item) => `<a href="${item.hash}" class="sidebar-link ${activeHash === item.hash ? 'active' : ''}">${item.label}</a>`).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user-name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</div>
          <div class="sidebar-user-email">${escapeHtml(user.email)}</div>
          <button class="secondary" id="logout-btn">Cerrar sesión</button>
        </div>
      </aside>
      <main class="main-content" id="page-content">${bodyHtml}</main>
    </div>
  `
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await api.logout()
    } catch {
      // si el logout server-side falla igual limpiamos la sesión local
    }
    setTokens(null, null)
    location.hash = '#/'
    await boot()
  })
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

let paymentReturnBanner: { provider: string; status: string } | null = null

async function renderDashboard() {
  setBody(`<div class="loading">Cargando…</div>`)
  const [profileResult, appsResult, creditsResult, kycResult] = await Promise.allSettled([api.me(), api.applications(), api.credits(), api.kycLatest()])
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null
  const apps = appsResult.status === 'fulfilled' ? appsResult.value : []
  const credits = creditsResult.status === 'fulfilled' ? creditsResult.value : []
  const kyc = kycResult.status === 'fulfilled' ? kycResult.value : null

  const profileComplete = Boolean(profile?.dni && profile?.cuil && profile?.income && Number(profile.income) > 0)
  const activeApp = apps.find((a) => !['REJECTED', 'CANCELLED', 'DISBURSED'].includes(a.status))
  const activeCredits = credits.filter((c) => c.status === 'ACTIVE')

  const banner = paymentReturnBanner
  paymentReturnBanner = null

  setBody(`
    <h1 class="page-title">Hola, ${escapeHtml(profile?.firstName ?? '')}</h1>
    <p class="page-subtitle">Este es el estado real de tu cuenta.</p>

    ${
      banner
        ? banner.status === 'success'
          ? `<div class="success-box">Volviste de ${escapeHtml(banner.provider)}. El pago se confirma por webhook — puede tardar unos segundos en reflejarse en "Mis créditos".</div>`
          : `<div class="error-box">El pago con ${escapeHtml(banner.provider)} no se completó o fue cancelado.</div>`
        : ''
    }

    ${
      !profileComplete
        ? `<div class="info-box">Completá tu <a href="#/cuenta/perfil">perfil</a> (DNI, CUIL e ingreso mensual) para poder solicitar un crédito.</div>`
        : ''
    }
    ${
      !kyc || kyc.status !== 'APPROVED'
        ? `<div class="info-box">Tu <a href="#/cuenta/kyc">verificación de identidad</a> está ${kyc ? escapeHtml(STATUS_LABEL[kyc.status] ?? kyc.status).toLowerCase() : 'pendiente de iniciar'}.</div>`
        : ''
    }

    <div class="section-title">Solicitudes</div>
    ${
      activeApp
        ? `<div class="detail-grid"><div><strong>Folio</strong>${escapeHtml(activeApp.publicId)}</div><div><strong>Estado</strong>${statusBadge(activeApp.status)}</div><div><strong>Monto</strong>${money(activeApp.amount)}</div><div><a href="#/cuenta/solicitudes/${activeApp.id}">Ver detalle →</a></div></div>`
        : `<div class="empty">No tenés solicitudes en curso. <a href="#/cuenta/solicitar">Solicitá un crédito →</a></div>`
    }

    <div class="section-title">Créditos activos</div>
    ${
      activeCredits.length
        ? `<div class="grid">${activeCredits.map((c) => `<div class="product-card"><h3>${escapeHtml(c.publicId)}</h3><div class="rate">${money(c.balance)}</div><div class="meta">Saldo pendiente de ${money(c.amount)}</div><div class="meta"><a href="#/cuenta/creditos/${c.id}">Ver cuotas →</a></div></div>`).join('')}</div>`
        : `<div class="empty">No tenés créditos activos todavía.</div>`
    }
  `)
}

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

async function renderProfile() {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const profile = await api.me()
    setBody(`
      <h1 class="page-title">Mi perfil</h1>
      <p class="page-subtitle">Estos datos son necesarios para evaluar tu solicitud de crédito.</p>
      <form id="profile-form" class="card" style="max-width:480px;">
        <label for="firstName">Nombre</label>
        <input id="firstName" value="${escapeHtml(profile.firstName)}" disabled />
        <label for="email">Correo</label>
        <input id="email" value="${escapeHtml(profile.email)}" disabled />
        <label for="phone">Teléfono</label>
        <input id="phone" value="${escapeHtml(profile.phone)}" />
        <label for="dni">DNI</label>
        <input id="dni" value="${escapeHtml(profile.dni)}" />
        <label for="cuil">CUIL</label>
        <input id="cuil" value="${escapeHtml(profile.cuil)}" />
        <label for="income">Ingreso mensual (ARS)</label>
        <input id="income" type="number" min="0" step="1" value="${profile.income ?? ''}" />
        <button type="submit" id="submit-btn">Guardar</button>
      </form>
    `)

    document.getElementById('profile-form')?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = document.getElementById('submit-btn') as HTMLButtonElement
      const phone = (document.getElementById('phone') as HTMLInputElement).value.trim()
      const dni = (document.getElementById('dni') as HTMLInputElement).value.trim()
      const cuil = (document.getElementById('cuil') as HTMLInputElement).value.trim()
      const incomeRaw = (document.getElementById('income') as HTMLInputElement).value
      await runAction(
        button,
        () => api.updateProfile({ phone: phone || undefined, dni: dni || undefined, cuil: cuil || undefined, income: incomeRaw ? Number(incomeRaw) : undefined }),
        () => {
          button.disabled = false
          button.textContent = 'Guardar'
          alert('Perfil actualizado.')
        },
      )
    })
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudo cargar el perfil.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// KYC
// ---------------------------------------------------------------------------

async function renderKyc() {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const session = await api.kycLatest()
    setBody(`
      <h1 class="page-title">Verificación de identidad</h1>
      <p class="page-subtitle">Usamos Didit para verificar tu identidad de forma segura.</p>
      ${
        session
          ? `<div class="detail-grid">
              <div><strong>Estado</strong>${statusBadge(session.status)}</div>
              <div><strong>Iniciada</strong>${dateFmt(session.requestedAt)}</div>
              ${session.resolvedAt ? `<div><strong>Resuelta</strong>${dateFmt(session.resolvedAt)}</div>` : ''}
            </div>`
          : `<div class="empty">Todavía no iniciaste tu verificación de identidad.</div>`
      }
      ${session && session.status === 'APPROVED' ? '' : `<button class="auto" id="start-kyc-btn">${session ? 'Iniciar una nueva verificación' : 'Iniciar verificación'}</button>`}
    `)

    document.getElementById('start-kyc-btn')?.addEventListener('click', async (e) => {
      const button = e.target as HTMLButtonElement
      await runAction(
        button,
        async () => {
          const { url } = await api.kycStart()
          location.href = url
        },
        () => {},
      )
    })
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudo cargar tu verificación.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// Solicitar crédito
// ---------------------------------------------------------------------------

async function renderApplyForCredit() {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const [products, profile] = await Promise.all([api.creditProducts(), api.me()])
    if (!profile.income || Number(profile.income) <= 0) {
      setBody(`<div class="info-box">Necesitás declarar tu ingreso mensual antes de solicitar un crédito. <a href="#/cuenta/perfil">Completar perfil →</a></div>`)
      return
    }
    if (!products.length) {
      setBody(`<div class="empty">No hay productos de crédito activos por el momento.</div>`)
      return
    }

    setBody(`
      <h1 class="page-title">Solicitar crédito</h1>
      <form id="quote-form" class="card" style="max-width:480px;">
        <label for="productId">Producto</label>
        <select id="productId">
          ${products.map((p) => `<option value="${p.id}" data-min="${p.minAmount}" data-max="${p.maxAmount}" data-min-months="${p.minTermMonths}" data-max-months="${p.maxTermMonths}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
        <label for="amount">Monto (ARS)</label>
        <input id="amount" type="number" min="1" required />
        <label for="months">Plazo (meses)</label>
        <input id="months" type="number" min="1" required />
        <button type="submit" id="quote-btn">Cotizar</button>
      </form>
      <div id="quote-box"></div>
    `)

    let lastQuote: Quote | null = null

    document.getElementById('quote-form')?.addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = document.getElementById('quote-btn') as HTMLButtonElement
      const productId = (document.getElementById('productId') as HTMLSelectElement).value
      const amount = Number((document.getElementById('amount') as HTMLInputElement).value)
      const months = Number((document.getElementById('months') as HTMLInputElement).value)
      await runAction(
        button,
        async () => {
          lastQuote = await api.simulate(productId, amount, months)
        },
        () => {
          button.disabled = false
          button.textContent = 'Cotizar'
          const box = document.getElementById('quote-box')!
          const q = lastQuote!
          box.innerHTML = `
            <div class="quote-result">
              <div class="big">${money(q.monthlyPayment)}/mes</div>
              <div class="row"><span>Total a pagar</span><span>${money(q.total)}</span></div>
              <div class="row"><span>Interés total</span><span>${money(q.totalInterest)}</span></div>
              <div class="row"><span>TNA</span><span>${q.tna.toFixed(2)}%</span></div>
              <div class="row"><span>CFT</span><span>${q.cft.toFixed(2)}%</span></div>
            </div>
            <button id="confirm-btn" class="auto">Confirmar solicitud</button>
          `
          document.getElementById('confirm-btn')?.addEventListener('click', async (e) => {
            const confirmBtn = e.target as HTMLButtonElement
            let created: CreditApplication
            await runAction(
              confirmBtn,
              async () => {
                created = await api.applyForCredit(productId, amount, months)
              },
              () => {
                location.hash = `#/cuenta/solicitudes/${created.id}`
                renderRoute()
              },
            )
          })
        },
      )
    })
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudo cargar el formulario.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// Solicitudes
// ---------------------------------------------------------------------------

async function renderApplications() {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const apps = await api.applications()
    setBody(`
      <h1 class="page-title">Mis solicitudes</h1>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Folio</th><th>Producto</th><th>Monto</th><th>Estado</th><th>Fecha</th></tr></thead>
          <tbody>
            ${
              apps.length
                ? apps
                    .map(
                      (a) => `
              <tr>
                <td><a href="#/cuenta/solicitudes/${a.id}">${escapeHtml(a.publicId)}</a></td>
                <td>${escapeHtml(a.product?.name)}</td>
                <td>${money(a.amount)} · ${a.months}m</td>
                <td>${statusBadge(a.status)}</td>
                <td>${dateFmt(a.createdAt)}</td>
              </tr>
            `,
                    )
                    .join('')
                : '<tr><td colspan="5" class="empty">Todavía no hiciste ninguna solicitud.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `)
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudieron cargar tus solicitudes.')}</div>`)
  }
}

function decisionRow(d: NonNullable<CreditApplication['decisions']>[number]) {
  return `<tr><td>${escapeHtml(d.decision)}</td><td>${d.riskScore}</td><td>${escapeHtml(d.riskLevel)}</td><td>${dateFmt(d.decidedAt)}</td></tr>`
}

async function renderApplicationDetail(id: string) {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const app = await api.applicationDetail(id)
    setBody(`
      <a href="#/cuenta/solicitudes" class="back-link">← Volver a mis solicitudes</a>
      <h1 class="page-title">Solicitud ${escapeHtml(app.publicId)}</h1>
      <div class="detail-grid">
        <div><strong>Producto</strong>${escapeHtml(app.product?.name)}</div>
        <div><strong>Monto</strong>${money(app.amount)} en ${app.months} meses</div>
        <div><strong>Cuota</strong>${money(app.monthlyPayment)}</div>
        <div><strong>Estado</strong>${statusBadge(app.status)}</div>
      </div>

      ${
        app.status === 'APPROVED' && !app.contract
          ? `<div class="info-box">Tu solicitud fue aprobada. Aceptá el contrato para continuar con el desembolso.</div><button class="auto" id="accept-btn">Aceptar contrato</button>`
          : ''
      }
      ${app.contract ? `<div class="success-box">Contrato aceptado el ${dateFmt(app.contract.acceptedAt)}.</div>` : ''}
      ${app.status === 'REJECTED' ? `<div class="error-box">Esta solicitud fue rechazada.</div>` : ''}

      <div class="section-title">Historial de decisiones</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Decisión</th><th>Score</th><th>Nivel</th><th>Fecha</th></tr></thead>
          <tbody>${(app.decisions ?? []).map(decisionRow).join('') || '<tr><td colspan="4" class="empty">Sin decisiones.</td></tr>'}</tbody>
        </table>
      </div>

      ${
        app.credit
          ? `<div class="section-title">Tu crédito</div><div class="empty" style="background:var(--color-surface);"><a href="#/cuenta/creditos/${app.credit.id}">Ver crédito y cuotas →</a></div>`
          : ''
      }
    `)

    document.getElementById('accept-btn')?.addEventListener('click', async (e) => {
      const button = e.target as HTMLButtonElement
      await runAction(button, () => api.acceptContract(app.id), () => renderApplicationDetail(id))
    })
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudo cargar la solicitud.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// Créditos
// ---------------------------------------------------------------------------

async function renderCredits() {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const credits = await api.credits()
    setBody(`
      <h1 class="page-title">Mis créditos</h1>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Folio</th><th>Monto</th><th>Saldo</th><th>Plazo</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${
              credits.length
                ? credits
                    .map(
                      (c) => `
              <tr>
                <td>${escapeHtml(c.publicId)}</td>
                <td>${money(c.amount)}</td>
                <td>${money(c.balance)}</td>
                <td>${c.months}m</td>
                <td>${statusBadge(c.status)}</td>
                <td><a href="#/cuenta/creditos/${c.id}">Ver cuotas →</a></td>
              </tr>
            `,
                    )
                    .join('')
                : '<tr><td colspan="6" class="empty">Todavía no tenés créditos.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `)
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudieron cargar tus créditos.')}</div>`)
  }
}

function installmentRow(i: Installment) {
  const payable = i.status === 'PENDING' || i.status === 'PARTIALLY_PAID' || i.status === 'OVERDUE'
  return `
    <tr>
      <td>${i.number}</td>
      <td>${dateFmt(i.dueDate)}</td>
      <td>${money(i.totalDue)}</td>
      <td>${money(i.amountPaid)}</td>
      <td>${statusBadge(i.status)}</td>
      <td>${payable ? `<button class="small auto" data-pay="${i.id}">Pagar</button>` : '—'}</td>
    </tr>
  `
}

async function renderCreditDetail(id: string) {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const [installments, quote] = await Promise.all([api.creditInstallments(id), api.earlySettlementQuote(id).catch(() => null)])
    setBody(`
      <a href="#/cuenta/creditos" class="back-link">← Volver a mis créditos</a>
      <h1 class="page-title">Cuotas del crédito</h1>
      ${
        quote
          ? `<div class="detail-grid"><div><strong>Capital pendiente</strong>${money(quote.outstandingPrincipal)}</div><div><strong>Cuotas restantes</strong>${quote.remainingInstallments}</div></div><p class="page-subtitle">${escapeHtml(quote.note)}</p>`
          : ''
      }
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Vencimiento</th><th>Total</th><th>Pagado</th><th>Estado</th><th></th></tr></thead>
          <tbody>${installments.map(installmentRow).join('') || '<tr><td colspan="6" class="empty">Sin cuotas.</td></tr>'}</tbody>
        </table>
      </div>
    `)

    document.querySelectorAll<HTMLButtonElement>('[data-pay]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const provider = confirm('Aceptar = pagar con Mercado Pago. Cancelar = pagar con AstroPay.') ? 'mercadopago' : 'astropay'
        await runAction(
          btn,
          async () => {
            const result = await api.createPaymentIntent(btn.dataset.pay!, provider)
            location.href = result.checkoutUrl
          },
          () => {},
        )
      }),
    )
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudieron cargar las cuotas.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

/**
 * Mercado Pago/AstroPay redirigen a una URL real (`/cuenta?mp_status=...`), no a nuestra ruta con
 * hash -- Vite sirve index.html igual (SPA fallback) así que llegamos acá, pero hay que traducir
 * esos query params a la ruta con hash y mostrar el aviso una sola vez.
 */
function consumePaymentReturnParams(): boolean {
  const params = new URLSearchParams(location.search)
  const mpStatus = params.get('mp_status')
  const astroStatus = params.get('astropay_status')
  if (mpStatus) paymentReturnBanner = { provider: 'Mercado Pago', status: mpStatus === 'success' ? 'success' : 'error' }
  else if (astroStatus) paymentReturnBanner = { provider: 'AstroPay', status: astroStatus === 'success' ? 'success' : 'error' }
  const hadParams = Boolean(mpStatus || astroStatus)
  if (hadParams || location.pathname !== '/') history.replaceState(null, '', '/')
  return hadParams
}

async function renderRoute() {
  const hash = location.hash || '#/'
  const isAccountRoute = hash.startsWith('#/cuenta')

  if (!isAccountRoute) {
    if (hash.startsWith('#/login')) renderLogin()
    else if (hash.startsWith('#/registro')) renderRegister()
    else if (hash.startsWith('#/productos')) await renderPublicProducts()
    else renderLanding()
    return
  }

  const user = await api.me().catch(() => null)
  if (!user) {
    setTokens(null, null)
    renderLogin('Tu sesión expiró. Iniciá sesión de nuevo.')
    return
  }

  const appDetailMatch = hash.match(/^#\/cuenta\/solicitudes\/(.+)$/)
  const creditDetailMatch = hash.match(/^#\/cuenta\/creditos\/(.+)$/)
  const activeHash = appDetailMatch ? '#/cuenta/solicitudes' : creditDetailMatch ? '#/cuenta/creditos' : hash
  renderAccountShell(user, activeHash, '<div class="loading">Cargando…</div>')

  if (appDetailMatch) await renderApplicationDetail(appDetailMatch[1])
  else if (creditDetailMatch) await renderCreditDetail(creditDetailMatch[1])
  else if (hash.startsWith('#/cuenta/solicitar')) await renderApplyForCredit()
  else if (hash.startsWith('#/cuenta/solicitudes')) await renderApplications()
  else if (hash.startsWith('#/cuenta/creditos')) await renderCredits()
  else if (hash.startsWith('#/cuenta/kyc')) await renderKyc()
  else if (hash.startsWith('#/cuenta/perfil')) await renderProfile()
  else await renderDashboard()
}

async function boot() {
  const cameFromPaymentReturn = consumePaymentReturnParams()
  if (cameFromPaymentReturn) location.hash = '#/cuenta'

  if (!getAccessToken() && (location.hash || '#/').startsWith('#/cuenta')) {
    renderLogin()
    return
  }
  await renderRoute()
}

window.addEventListener('hashchange', () => {
  renderRoute()
})

boot()
