import './style.css'
import { api, getToken, setToken, type CreditProduct, type SessionUser } from './api'

const root = document.getElementById('app')!

function money(value: string | number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value))
}

/**
 * Este shell construye el DOM con innerHTML por simplicidad (no hay framework todavía) — cualquier
 * valor que pueda originarse en input de usuario (nombre, email, mensajes de error) DEBE pasar por
 * acá antes de interpolarse. Hallazgo de auditoría: firstName no tenía límite de caracteres
 * permitidos en el registro, así que sin esto un nombre con HTML se ejecutaría en la sesión del
 * admin que lo mire (self-XSS hoy; XSS real contra staff en cuanto Fase 9 liste otros clientes).
 */
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

function renderTopbar() {
  return `<div class="topbar"><div class="brand">UNI<span>CRÉDITOS</span> · Admin</div></div>`
}

function renderLogin(errorMessage?: string) {
  root.innerHTML = `
    ${renderTopbar()}
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
      await renderDashboard()
    } catch (error) {
      renderLogin(error instanceof Error ? error.message : 'No se pudo iniciar sesión.')
    }
  })
}

async function renderDashboard() {
  let user: SessionUser
  try {
    user = await api.me()
  } catch {
    setToken(null)
    renderLogin('Tu sesión expiró. Iniciá sesión de nuevo.')
    return
  }

  let products: CreditProduct[] = []
  let productsError = ''
  try {
    products = await api.creditProducts()
  } catch (error) {
    productsError = error instanceof Error ? error.message : 'No se pudieron cargar los productos.'
  }

  root.innerHTML = `
    ${renderTopbar()}
    <div class="dashboard">
      <div class="welcome">
        <span class="badge">${escapeHtml(user.role)}</span>
        <h1>Hola, ${escapeHtml(user.firstName)}</h1>
        <p>${escapeHtml(user.email)} · estado de cuenta: ${escapeHtml(user.status)}</p>
        <button class="secondary" id="logout-btn" style="width:auto;margin-top:12px;">Cerrar sesión</button>
      </div>

      <div class="section-title">Productos de crédito (en vivo, services/credit)</div>
      ${productsError ? `<div class="error-box">${escapeHtml(productsError)}</div>` : ''}
      <div class="grid">
        ${products
          .map(
            (p) => `
          <div class="product-card">
            <h3>${escapeHtml(p.name)}</h3>
            <div class="rate">${Number(p.monthlyRate).toFixed(1)}% TEM</div>
            <div class="meta">${money(p.minAmount)} — ${money(p.maxAmount)} · ${p.minTermMonths} a ${p.maxTermMonths} meses</div>
          </div>
        `,
          )
          .join('')}
      </div>

      <p class="note">
        Este es el shell mínimo del Admin Backoffice (Fase 9 en <code>docs/ROADMAP.md</code> es la versión completa:
        riesgo, compliance, tesorería, cobranzas). Por ahora confirma que el login, RBAC y los servicios reales
        (identity/kyc/credit) funcionan de punta a punta desde un navegador.
      </p>
    </div>
  `

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    setToken(null)
    renderLogin()
  })
}

async function bootstrap() {
  if (getToken()) {
    await renderDashboard()
  } else {
    renderLogin()
  }
}

bootstrap()
