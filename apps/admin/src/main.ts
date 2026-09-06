import './style.css'
import { api, getToken, setToken, type CollectionCase, type Credit, type CreditApplication, type SessionUser } from './api'

const root = document.getElementById('app')!

function money(value: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value))
}

function dateFmt(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

/**
 * Este shell construye el DOM con innerHTML por simplicidad (no hay framework todavía) — cualquier
 * valor que pueda originarse en input de usuario (nombre, email, mensajes de error) DEBE pasar por
 * acá antes de interpolarse. Hallazgo de auditoría: firstName no tenía límite de caracteres
 * permitidos en el registro, así que sin esto un nombre con HTML se ejecutaría en la sesión del
 * admin que lo mire.
 */
function escapeHtml(value: string | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Enviada',
  PRE_APPROVED: 'Pre-aprobada',
  MANUAL_REVIEW: 'Revisión manual',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  READY_FOR_DISBURSEMENT: 'Lista para desembolso',
  DISBURSED: 'Desembolsada',
  CANCELLED: 'Cancelada',
  ACTIVE: 'Activo',
  PAID_OFF: 'Cancelado',
  CURRENT: 'Al día',
  GRACE_PERIOD: 'Período de gracia',
  OVERDUE: 'Vencido',
  INTENSIVE_COLLECTION: 'Cobranza intensiva',
  LEGAL_REVIEW: 'Revisión legal',
  RECOVERED: 'Recuperado',
  DEFAULTED: 'Incobrable',
}

function statusBadge(status: string) {
  return `<span class="status-badge status-${escapeHtml(status.toLowerCase())}">${escapeHtml(STATUS_LABEL[status] ?? status)}</span>`
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { hash: '#/dashboard', label: 'Dashboard' },
  { hash: '#/solicitudes', label: 'Solicitudes' },
  { hash: '#/creditos', label: 'Créditos' },
  { hash: '#/cobranzas', label: 'Cobranzas' },
  { hash: '#/tesoreria', label: 'Tesorería' },
]

function renderShell(user: SessionUser, activeHash: string, bodyHtml: string) {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-brand">UNI<span>CRÉDITOS</span></div>
        <nav class="sidebar-nav">
          ${NAV_ITEMS.map((item) => `<a href="${item.hash}" class="sidebar-link ${activeHash.startsWith(item.hash) ? 'active' : ''}">${item.label}</a>`).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <span class="badge">${escapeHtml(user.role)}</span>
            <div class="sidebar-user-name">${escapeHtml(user.firstName)}</div>
            <div class="sidebar-user-email">${escapeHtml(user.email)}</div>
          </div>
          <button class="secondary" id="logout-btn">Cerrar sesión</button>
        </div>
      </aside>
      <main class="main-content" id="page-content">${bodyHtml}</main>
    </div>
  `
  document.getElementById('logout-btn')?.addEventListener('click', () => {
    setToken(null)
    location.hash = ''
    renderLogin()
  })
}

function setBody(html: string) {
  const el = document.getElementById('page-content')
  if (el) el.innerHTML = html
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function renderLogin(errorMessage?: string) {
  root.innerHTML = `
    <div class="topbar"><div class="brand">UNI<span>CRÉDITOS</span> · Admin</div></div>
    <div class="center-screen">
      <form class="card" id="login-form">
        <h1>Iniciar sesión</h1>
        <p class="subtitle">Backoffice — acceso interno</p>
        ${errorMessage ? `<div class="error-box">${escapeHtml(errorMessage)}</div>` : ''}
        <label for="email">Correo</label>
        <input id="email" name="email" type="email" required autocomplete="username" />
        <label for="password">Contraseña</label>
        <input id="password" name="password" type="password" required autocomplete="current-password" />
        <button type="submit" id="submit-btn">Ingresar</button>
      </form>
    </div>
  `

  const form = document.getElementById('login-form') as HTMLFormElement
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const button = document.getElementById('submit-btn') as HTMLButtonElement
    const email = (document.getElementById('email') as HTMLInputElement).value.trim()
    const password = (document.getElementById('password') as HTMLInputElement).value
    button.disabled = true
    button.textContent = 'Ingresando…'
    try {
      const { accessToken } = await api.login(email, password)
      setToken(accessToken)
      location.hash = '#/dashboard'
      await boot()
    } catch (error) {
      renderLogin(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    }
  })
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function renderDashboard() {
  setBody(`<div class="loading">Cargando…</div>`)
  const [treasury, queue, readyForDisbursement, cases, products] = await Promise.allSettled([
    api.treasuryDashboard(),
    api.applicationsQueue(),
    api.applicationsReadyForDisbursement(),
    api.collectionCases(),
    api.creditProducts(),
  ])

  const t = treasury.status === 'fulfilled' ? treasury.value : null
  const queueCount = queue.status === 'fulfilled' ? queue.value.length : '—'
  const disbCount = readyForDisbursement.status === 'fulfilled' ? readyForDisbursement.value.length : '—'
  const overdueCount = cases.status === 'fulfilled' ? cases.value.filter((c) => c.status !== 'CURRENT').length : '—'
  const productCount = products.status === 'fulfilled' ? products.value.length : '—'

  setBody(`
    <h1 class="page-title">Dashboard</h1>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Fondos netos de tesorería</div>
        <div class="metric-value">${t ? money(t.treasuryNetBalance) : 'N/D'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total desembolsado</div>
        <div class="metric-value">${t ? money(t.totalDisbursed) : 'N/D'}</div>
        <div class="metric-sub">${t ? t.disbursementCount : 0} desembolsos</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total cobrado</div>
        <div class="metric-value">${t ? money(t.totalCollected) : 'N/D'}</div>
        <div class="metric-sub">${t ? t.repaymentCount : 0} pagos</div>
      </div>
      <div class="metric-card metric-warn">
        <div class="metric-label">Solicitudes en cola</div>
        <div class="metric-value">${queueCount}</div>
        <a href="#/solicitudes" class="metric-link">Revisar →</a>
      </div>
      <div class="metric-card metric-warn">
        <div class="metric-label">Listas para desembolso</div>
        <div class="metric-value">${disbCount}</div>
        <a href="#/solicitudes" class="metric-link">Ver →</a>
      </div>
      <div class="metric-card metric-danger">
        <div class="metric-label">Casos de cobranza activos</div>
        <div class="metric-value">${overdueCount}</div>
        <a href="#/cobranzas" class="metric-link">Ver →</a>
      </div>
      <div class="metric-card">
        <div class="metric-label">Productos de crédito activos</div>
        <div class="metric-value">${productCount}</div>
      </div>
    </div>
    <p class="note">
      Backoffice real (Fase 9 en construcción) — Dashboard, Solicitudes, Créditos, Cobranzas y
      Tesorería funcionan contra los servicios reales. Usuarios/Clientes/Inversores/Comercios/
      Compliance/Fraude/Documentos/Contratos/Reportes/Configuración/Auditoría quedan para
      siguientes incrementos (ver <code>docs/ROADMAP.md</code>).
    </p>
  `)
}

// ---------------------------------------------------------------------------
// Solicitudes
// ---------------------------------------------------------------------------

function applicationRow(app: CreditApplication, showActions: boolean) {
  const lastDecision = app.decisions?.[0]
  return `
    <tr>
      <td><a href="#/solicitudes/${app.id}">${escapeHtml(app.publicId)}</a></td>
      <td>${escapeHtml(app.user ? `${app.user.firstName} ${app.user.lastName}` : app.userId)}</td>
      <td>${escapeHtml(app.product?.name)}</td>
      <td>${money(app.amount)} · ${app.months}m</td>
      <td>${lastDecision ? `${lastDecision.riskScore} (${escapeHtml(lastDecision.riskLevel)})` : '—'}</td>
      <td>${statusBadge(app.status)}</td>
      <td>${dateFmt(app.createdAt)}</td>
      ${
        showActions
          ? `<td><button class="btn-approve" data-approve="${app.id}">Aprobar</button> <button class="btn-reject" data-reject="${app.id}">Rechazar</button></td>`
          : `<td><button class="btn-disburse" data-disburse="${app.id}">Desembolsar</button></td>`
      }
    </tr>
  `
}

async function renderApplications() {
  setBody(`<div class="loading">Cargando…</div>`)
  const [queueResult, readyResult] = await Promise.allSettled([api.applicationsQueue(), api.applicationsReadyForDisbursement()])
  const queue = queueResult.status === 'fulfilled' ? queueResult.value : []
  const ready = readyResult.status === 'fulfilled' ? readyResult.value : []
  const queueError = queueResult.status === 'rejected' ? (queueResult.reason as Error).message : ''
  const readyError = readyResult.status === 'rejected' ? (readyResult.reason as Error).message : ''

  setBody(`
    <h1 class="page-title">Solicitudes de crédito</h1>

    <div class="section-title">Pendientes de revisión (${queue.length})</div>
    ${queueError ? `<div class="error-box">${escapeHtml(queueError)}</div>` : ''}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Folio</th><th>Cliente</th><th>Producto</th><th>Monto</th><th>Score</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead>
        <tbody>${queue.length ? queue.map((a) => applicationRow(a, true)).join('') : '<tr><td colspan="8" class="empty">Sin solicitudes pendientes.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="section-title">Listas para desembolso (${ready.length})</div>
    ${readyError ? `<div class="error-box">${escapeHtml(readyError)}</div>` : ''}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Folio</th><th>Cliente</th><th>Producto</th><th>Monto</th><th>Score</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead>
        <tbody>${ready.length ? ready.map((a) => applicationRow(a, false)).join('') : '<tr><td colspan="8" class="empty">Nada esperando desembolso.</td></tr>'}</tbody>
      </table>
    </div>
  `)

  document.querySelectorAll<HTMLButtonElement>('[data-approve]').forEach((btn) =>
    btn.addEventListener('click', () => runAction(btn, () => api.reviewApplication(btn.dataset.approve!, 'approve'), renderApplications)),
  )
  document.querySelectorAll<HTMLButtonElement>('[data-reject]').forEach((btn) =>
    btn.addEventListener('click', () => runAction(btn, () => api.reviewApplication(btn.dataset.reject!, 'reject'), renderApplications)),
  )
  document.querySelectorAll<HTMLButtonElement>('[data-disburse]').forEach((btn) =>
    btn.addEventListener('click', () => runAction(btn, () => api.disburseApplication(btn.dataset.disburse!), renderApplications)),
  )
}

async function runAction(button: HTMLButtonElement, action: () => Promise<unknown>, refresh: () => void) {
  const original = button.textContent
  button.disabled = true
  button.textContent = '…'
  try {
    await action()
    refresh()
  } catch (error) {
    alert(error instanceof Error ? error.message : 'No se pudo completar la acción.')
    button.disabled = false
    button.textContent = original
  }
}

async function renderApplicationDetail(id: string) {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const app = await api.applicationDetail(id)
    setBody(`
      <a href="#/solicitudes" class="back-link">← Volver a solicitudes</a>
      <h1 class="page-title">Solicitud ${escapeHtml(app.publicId)}</h1>
      <div class="detail-grid">
        <div><strong>Cliente:</strong> ${escapeHtml(app.user ? `${app.user.firstName} ${app.user.lastName} (${app.user.email})` : app.userId)}</div>
        <div><strong>Producto:</strong> ${escapeHtml(app.product?.name)}</div>
        <div><strong>Monto:</strong> ${money(app.amount)} en ${app.months} meses</div>
        <div><strong>Cuota:</strong> ${money(app.monthlyPayment)}</div>
        <div><strong>Estado:</strong> ${statusBadge(app.status)}</div>
        <div><strong>Contrato:</strong> ${app.contract ? `Aceptado ${dateFmt(app.contract.acceptedAt)}` : 'Sin aceptar'}</div>
      </div>

      <div class="section-title">Historial de decisiones</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Decisión</th><th>Score</th><th>Nivel</th><th>Fecha</th></tr></thead>
          <tbody>
            ${(app.decisions ?? [])
              .map((d) => `<tr><td>${escapeHtml(d.decision)}</td><td>${d.riskScore}</td><td>${escapeHtml(d.riskLevel)}</td><td>${dateFmt(d.decidedAt)}</td></tr>`)
              .join('') || '<tr><td colspan="4" class="empty">Sin decisiones.</td></tr>'}
          </tbody>
        </table>
      </div>

      ${
        app.credit
          ? `
        <div class="section-title">Cuotas del crédito ${escapeHtml(app.credit.publicId)}</div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Vencimiento</th><th>Capital</th><th>Interés</th><th>Total</th><th>Pagado</th><th>Estado</th></tr></thead>
            <tbody>
              ${app.credit.installments
                .map((i) => `<tr><td>${i.number}</td><td>${dateFmt(i.dueDate)}</td><td>${money(i.principal)}</td><td>${money(i.interest)}</td><td>${money(i.totalDue)}</td><td>${money(i.amountPaid)}</td><td>${statusBadge(i.status)}</td></tr>`)
                .join('')}
            </tbody>
          </table>
        </div>
      `
          : ''
      }
    `)
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudo cargar la solicitud.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// Créditos
// ---------------------------------------------------------------------------

function creditRow(credit: Credit) {
  return `
    <tr>
      <td>${escapeHtml(credit.publicId)}</td>
      <td>${escapeHtml(credit.application ? `${credit.application.user.firstName} ${credit.application.user.lastName}` : credit.userId)}</td>
      <td>${money(credit.amount)}</td>
      <td>${money(credit.balance)}</td>
      <td>${credit.months}m</td>
      <td>${statusBadge(credit.status)}</td>
      <td>${dateFmt(credit.createdAt)}</td>
      <td><a href="#/creditos/${credit.id}">Ver cuotas →</a></td>
    </tr>
  `
}

async function renderCredits() {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const credits = await api.creditsAll()
    setBody(`
      <h1 class="page-title">Créditos (${credits.length})</h1>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Folio</th><th>Cliente</th><th>Monto</th><th>Saldo</th><th>Plazo</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
          <tbody>${credits.length ? credits.map(creditRow).join('') : '<tr><td colspan="8" class="empty">Todavía no hay créditos.</td></tr>'}</tbody>
        </table>
      </div>
    `)
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudieron cargar los créditos.')}</div>`)
  }
}

async function renderCreditDetail(id: string) {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const installments = await api.creditInstallments(id)
    setBody(`
      <a href="#/creditos" class="back-link">← Volver a créditos</a>
      <h1 class="page-title">Cuotas del crédito</h1>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Vencimiento</th><th>Capital</th><th>Interés</th><th>Total</th><th>Pagado</th><th>Estado</th></tr></thead>
          <tbody>
            ${installments
              .map((i) => `<tr><td>${i.number}</td><td>${dateFmt(i.dueDate)}</td><td>${money(i.principal)}</td><td>${money(i.interest)}</td><td>${money(i.totalDue)}</td><td>${money(i.amountPaid)}</td><td>${statusBadge(i.status)}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </div>
    `)
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudieron cargar las cuotas.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// Cobranzas
// ---------------------------------------------------------------------------

function collectionRow(c: CollectionCase) {
  return `
    <tr>
      <td>${escapeHtml(c.credit.publicId)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.maxDaysOverdue} días</td>
      <td>${money(c.credit.balance)}</td>
      <td>${dateFmt(c.lastScanAt)}</td>
      <td>
        <button class="secondary" data-action="CONTACT_ATTEMPT" data-case="${c.id}">Registrar contacto</button>
        <button class="secondary" data-action="PROMISE_TO_PAY" data-case="${c.id}">Promesa de pago</button>
        <button class="btn-approve" data-action="MARK_RECOVERED" data-case="${c.id}">Marcar recuperado</button>
      </td>
    </tr>
  `
}

async function renderCollections() {
  setBody(`<div class="loading">Cargando…</div>`)
  try {
    const cases = await api.collectionCases()
    setBody(`
      <div class="page-header-row">
        <h1 class="page-title">Cobranzas (${cases.length} casos activos)</h1>
        <button id="scan-btn">Correr escaneo de mora</button>
      </div>
      <p class="note">El escaneo es manual por ahora (pendiente de Redis/BullMQ para un cron real, ver docs/ROADMAP.md).</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Crédito</th><th>Estado</th><th>Días de atraso</th><th>Saldo</th><th>Último escaneo</th><th>Acciones</th></tr></thead>
          <tbody>${cases.length ? cases.map(collectionRow).join('') : '<tr><td colspan="6" class="empty">Sin casos activos.</td></tr>'}</tbody>
        </table>
      </div>
    `)

    document.getElementById('scan-btn')?.addEventListener('click', (e) => runAction(e.target as HTMLButtonElement, () => api.collectionScan(), renderCollections))
    document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const action = btn.dataset.action as 'CONTACT_ATTEMPT' | 'PROMISE_TO_PAY' | 'MARK_RECOVERED'
        const notes = action !== 'MARK_RECOVERED' ? prompt('Notas (opcional):') ?? undefined : undefined
        runAction(btn, () => api.collectionAction(btn.dataset.case!, action, notes), renderCollections)
      }),
    )
  } catch (error) {
    setBody(`<div class="error-box">${escapeHtml(error instanceof Error ? error.message : 'No se pudieron cargar los casos de cobranza.')}</div>`)
  }
}

// ---------------------------------------------------------------------------
// Tesorería
// ---------------------------------------------------------------------------

async function renderTreasury() {
  setBody(`<div class="loading">Cargando…</div>`)
  const [dashResult, reconResult] = await Promise.allSettled([api.treasuryDashboard(), api.treasuryReconciliation()])
  const dash = dashResult.status === 'fulfilled' ? dashResult.value : null
  const recon = reconResult.status === 'fulfilled' ? reconResult.value : null

  setBody(`
    <h1 class="page-title">Tesorería</h1>
    ${
      dash
        ? `
      <div class="metrics-grid">
        <div class="metric-card"><div class="metric-label">Fondos netos</div><div class="metric-value">${money(dash.treasuryNetBalance)}</div></div>
        <div class="metric-card"><div class="metric-label">Total desembolsado</div><div class="metric-value">${money(dash.totalDisbursed)}</div></div>
        <div class="metric-card"><div class="metric-label">Total cobrado</div><div class="metric-value">${money(dash.totalCollected)}</div></div>
      </div>
    `
        : '<div class="error-box">No se pudo cargar el dashboard de tesorería.</div>'
    }

    <div class="section-title">Reconciliación (Credit.balance cacheado vs. ledger) ${recon ? (recon.allMatch ? '✅ todo coincide' : '⚠️ hay diferencias') : ''}</div>
    ${
      recon
        ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Crédito</th><th>Saldo cacheado</th><th>Saldo según ledger</th><th>¿Coincide?</th></tr></thead>
          <tbody>
            ${recon.credits
              .map(
                (c) =>
                  `<tr class="${c.match ? '' : 'row-mismatch'}"><td>${escapeHtml(c.publicId)}</td><td>${money(c.cachedBalance)}</td><td>${money(c.ledgerImpliedBalance)}</td><td>${c.match ? '✅' : '❌'}</td></tr>`,
              )
              .join('') || '<tr><td colspan="4" class="empty">Sin créditos.</td></tr>'}
          </tbody>
        </table>
      </div>
    `
        : '<div class="error-box">No se pudo cargar la reconciliación.</div>'
    }
  `)
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function renderRoute() {
  const user = await api.me().catch(() => null)
  if (!user) {
    setToken(null)
    renderLogin('Tu sesión expiró. Iniciá sesión de nuevo.')
    return
  }

  const hash = location.hash || '#/dashboard'
  renderShell(user, hash, '<div class="loading">Cargando…</div>')

  const appMatch = hash.match(/^#\/solicitudes\/(.+)$/)
  const creditMatch = hash.match(/^#\/creditos\/(.+)$/)

  if (appMatch) await renderApplicationDetail(appMatch[1])
  else if (creditMatch) await renderCreditDetail(creditMatch[1])
  else if (hash.startsWith('#/solicitudes')) await renderApplications()
  else if (hash.startsWith('#/creditos')) await renderCredits()
  else if (hash.startsWith('#/cobranzas')) await renderCollections()
  else if (hash.startsWith('#/tesoreria')) await renderTreasury()
  else await renderDashboard()
}

async function boot() {
  if (!getToken()) {
    renderLogin()
    return
  }
  await renderRoute()
}

window.addEventListener('hashchange', () => {
  if (getToken()) renderRoute()
})

boot()
