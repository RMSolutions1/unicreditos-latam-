import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import './style.css'
import { AccountPage } from './account'
import { AdminPage } from './admin'
import { api, getToken, setToken } from './api'
import { ArgentineFlagMark } from './identity'
import { AboutPage, ApplyPage, CreditsPage, HelpPage, HomePage, HowPage, InstallmentsPage, LinePage, PrivacyPage, RatesPage, SimulatorPage, TermsPage } from './pages'
import { routes, viewFromPath, type Page, type SessionUser, type View } from './types'

const nav: { label: string; page: Page }[] = [
  { label: 'Inicio', page: 'inicio' },
  { label: 'Créditos', page: 'creditos' },
  { label: 'Línea', page: 'linea' },
  { label: 'Cuotas', page: 'cuotas' },
  { label: 'Simulador', page: 'simulador' },
  { label: 'Ayuda', page: 'ayuda' },
]

type Preset = { amount?: number; months?: number; productId?: string }

function readPreset(): Preset | undefined {
  const params = new URLSearchParams(window.location.search)
  const amount = Number(params.get('monto'))
  const months = Number(params.get('plazo'))
  const productId = params.get('producto') || undefined
  if (amount || months || productId) return { amount: amount || undefined, months: months || undefined, productId }
  return undefined
}

function App() {
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname))
  const [menu, setMenu] = useState(false)
  const [auth, setAuth] = useState<'login' | 'register' | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [preset, setPreset] = useState(readPreset)
  const [loginName, setLoginName] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [demo, setDemo] = useState<{ email: string; password: string } | null>(null)
  const [hideDemo, setHideDemo] = useState(false)

  useEffect(() => {
    function sync() {
      setView(viewFromPath(window.location.pathname))
      setPreset(readPreset())
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])

  useEffect(() => {
    void api.demo()
      .then((next) => setDemo(next.email && next.password ? next : { email: 'ana@unicreditos.com.ar', password: 'demo1234' }))
      .catch(() => setDemo({ email: 'ana@unicreditos.com.ar', password: 'demo1234' }))
    if (!getToken()) return
    void api.account().then((account) => setUser(account.user)).catch(() => setToken(null))
  }, [])

  function go(page: Page, extras?: Preset) {
    setPreset(extras)
    setView(page)
    setMenu(false)
    const params = new URLSearchParams()
    if (extras?.amount) params.set('monto', String(extras.amount))
    if (extras?.months) params.set('plazo', String(extras.months))
    if (extras?.productId) params.set('producto', extras.productId)
    const query = params.toString()
    window.history.pushState({}, '', query ? `${routes[page]}?${query}` : routes[page])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openAccount(next?: SessionUser) {
    if (next) setUser(next)
    setAuth(null)
    setView('cuenta')
    setMenu(false)
    window.history.pushState({}, '', routes.cuenta)
    window.scrollTo({ top: 0 })
  }

  async function submitAuth() {
    setAuthError('')
    setAuthLoading(true)
    try {
      const result = auth === 'register'
        ? await api.register({ name: loginName, email: loginEmail, password: loginPassword })
        : await api.login(loginEmail, loginPassword)
      setToken(result.token)
      openAccount(result.user)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'No se pudo entrar')
    } finally {
      setAuthLoading(false)
    }
  }

  async function logout() {
    try { await api.logout() } catch { /* demo */ }
    setToken(null)
    setUser(null)
    go('inicio')
  }

  const page = (
    view === 'inicio' ? <HomePage go={go} />
    : view === 'creditos' ? <CreditsPage go={go} />
    : view === 'linea' ? <LinePage go={go} />
    : view === 'cuotas' ? <InstallmentsPage go={go} />
    : view === 'como-funciona' ? <HowPage />
    : view === 'simulador' ? <SimulatorPage go={go} />
    : view === 'solicitar' ? <ApplyPage key={`${preset?.amount}-${preset?.months}-${preset?.productId}-${user?.id || 'guest'}`} preset={preset} loggedIn={Boolean(user)} onDone={(next) => { setToken(getToken()); openAccount(next) }} />
    : view === 'tasas' ? <RatesPage />
    : view === 'nosotros' ? <AboutPage />
    : view === 'ayuda' ? <HelpPage />
    : view === 'privacidad' ? <PrivacyPage />
    : view === 'terminos' ? <TermsPage />
    : view === 'admin' ? <AdminPage />
    : <AccountPage user={user} onLogout={() => void logout()} onApply={() => go('solicitar')} />
  )

  return (
    <div className={`public-page ${view === 'inicio' ? 'is-home' : ''} ${view === 'cuenta' ? 'is-account' : ''}`}>
      {demo && !hideDemo && (
        <div className="demo-banner">
          <span>Modo demo · {demo.email} / {demo.password}</span>
          <button onClick={() => setHideDemo(true)}>Cerrar</button>
        </div>
      )}
      <header className="public-nav">
        <button className="public-brand" onClick={() => go('inicio')}>
          <span className="public-mark">U</span>
          <b>UNICRÉDITOS</b>
        </button>
        <nav className={menu ? 'open' : ''}>
          {nav.map((item) => (
            <button key={item.page} className={view === item.page ? 'current' : ''} onClick={() => go(item.page)}>{item.label}</button>
          ))}
        </nav>
        <div className="public-actions">
          {user
            ? (
              <>
                {user.role === 'admin' && <button className="public-login" onClick={() => { setView('admin'); window.history.pushState({}, '', routes.admin) }}>Mesa</button>}
                <button className="public-login" onClick={() => openAccount(user)}>Mi cuenta</button>
              </>
            )
            : <button className="public-login" onClick={() => { setAuth('login'); setAuthError('') }}>Iniciar sesión</button>}
          <button className="public-register" onClick={() => go('solicitar')}>Solicitar crédito <ArrowUpRight size={15} /></button>
          <button className="nav-burger" aria-label="Menú" onClick={() => setMenu(!menu)}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      <main>{page}</main>

      {view !== 'cuenta' && (
        <footer className="site-footer">
          <div className="footer-brand">
            <div className="public-brand"><span className="public-mark">U</span><b>UNICRÉDITOS</b><ArgentineFlagMark /></div>
            <p>Crédito digital para personas en Argentina. Efectivo, línea y cuotas, con CFT a la vista.</p>
          </div>
          <div>
            <small>Créditos</small>
            <button onClick={() => go('creditos')}>Efectivo</button>
            <button onClick={() => go('linea')}>Línea Unicréditos</button>
            <button onClick={() => go('cuotas')}>Cuotas sin tarjeta</button>
            <button onClick={() => go('tasas')}>Tasas y CFT</button>
          </div>
          <div>
            <small>Personas</small>
            <button onClick={() => go('como-funciona')}>Cómo funciona</button>
            <button onClick={() => go('simulador')}>Simulador</button>
            <button onClick={() => go('solicitar')}>Pedir crédito</button>
          </div>
          <div>
            <small>Unicréditos</small>
            <button onClick={() => go('nosotros')}>Nosotros</button>
            <button onClick={() => go('ayuda')}>Ayuda</button>
            <button onClick={() => go('privacidad')}>Aviso de privacidad</button>
            <button onClick={() => go('terminos')}>Términos</button>
          </div>
          <div className="footer-legal">
            <span>© 2026 Unicréditos. Crédito digital 100% online en Argentina.</span>
            <span>Consultá TNA, TEA y CFT en tu oferta. Sujeto a evaluación crediticia.</span>
          </div>
        </footer>
      )}

      {auth && (
        <div className="overlay" onClick={() => setAuth(null)}>
          <div className="public-auth" onClick={(event) => event.stopPropagation()}>
            <button className="close auth-close" onClick={() => setAuth(null)}><X size={18} /></button>
            <div className="public-brand"><span className="public-mark">U</span><b>UNICRÉDITOS</b></div>
            <h2>{auth === 'login' ? 'Hola de nuevo' : 'Crea tu cuenta'}</h2>
            <p>{auth === 'login' ? 'Entra a tu crédito personal.' : 'Empieza tu solicitud de crédito hoy.'}</p>
            {authError && <p className="form-error">{authError}</p>}
            {auth === 'register' && <input placeholder="Nombre completo" value={loginName} onChange={(event) => setLoginName(event.target.value)} autoFocus />}
            <input placeholder="Correo electrónico" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} autoFocus={auth === 'login'} />
            <input type="password" placeholder="Contraseña" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} />
            {auth === 'login' && demo && <small>Prueba {demo.email} / {demo.password}</small>}
            {auth === 'login' && (
              <button className="hero-secondary auth-switch" type="button" onClick={() => {
                if (!loginEmail) { setAuthError('Ingresá tu correo'); return }
                void api.forgot(loginEmail).then((result) => setAuthError(result.message)).catch((err) => setAuthError(err instanceof Error ? err.message : 'No se pudo enviar'))
              }}>Olvidé mi contraseña</button>
            )}
            <button className="hero-primary auth-button" onClick={() => void submitAuth()} disabled={authLoading}>
              {authLoading ? 'Entrando…' : auth === 'login' ? 'Iniciar sesión' : 'Crear cuenta'} <ArrowUpRight size={16} />
            </button>
            <button className="hero-secondary auth-switch" onClick={() => { setAuth(auth === 'login' ? 'register' : 'login'); setAuthError('') }}>
              {auth === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
            </button>
            <small>Al continuar aceptas el aviso de privacidad de Unicréditos.</small>
          </div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('app')!).render(<App />)
