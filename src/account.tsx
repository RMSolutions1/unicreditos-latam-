import { useEffect, useState } from 'react'
import { ArrowUpRight, Bell, CalendarDays, CheckCircle2, CreditCard, FileText, Landmark, LogOut, QrCode, ShieldCheck, Smartphone, UserRound, WalletCards } from 'lucide-react'
import { api, day, money, moneyExact } from './api'
import type { AccountData, SessionUser } from './types'

type Tab = 'resumen' | 'linea' | 'pagos' | 'documentos' | 'avisos' | 'historia' | 'perfil'
type MyStory = { id: string; product: string; body: string; stars: number; status: 'pending' | 'approved' | 'rejected'; createdAt: string }

const methods = [
  { id: 'mercadopago', label: 'Mercado Pago' },
  { id: 'homebanking', label: 'Homebanking / PMC' },
  { id: 'rapipago', label: 'Rapipago / Pago Fácil' },
  { id: 'debito', label: 'Débito automático' },
]

export function AccountPage({ user, onLogout, onApply }: { user: SessionUser | null; onLogout: () => void; onApply: () => void }) {
  const [tab, setTab] = useState<Tab>('resumen')
  const [data, setData] = useState<AccountData | null>(null)
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [method, setMethod] = useState('mercadopago')
  const [kycBusy, setKycBusy] = useState(false)
  const [bcra, setBcra] = useState<{ worstSituation: number | null; entitiesCount: number; unavailable?: boolean } | null>(null)
  const [stories, setStories] = useState<MyStory[]>([])
  const [storyBody, setStoryBody] = useState('')
  const [storyBusy, setStoryBusy] = useState(false)
  const first = data?.user.firstName || user?.firstName || 'vos'

  async function load() {
    try {
      setData(await api.account())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar tu cuenta')
    }
  }

  useEffect(() => { void load() }, [])
  useEffect(() => { void api.myStories().then(setStories).catch(() => setStories([])) }, [])
  useEffect(() => {
    if (data?.user.cuil) void api.bcraDeudores(data.user.cuil).then(setBcra).catch(() => setBcra(null))
  }, [data?.user.cuil])

  async function pay(count = 1) {
    setPaying(true)
    try {
      const result = await api.pay(method, count)
      if (result.checkout?.initPoint) {
        window.location.href = result.checkout.initPoint
        return
      }
      setData(result.account)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago')
    } finally {
      setPaying(false)
    }
  }

  async function settle() {
    setPaying(true)
    try {
      const result = await api.prepay(method)
      if (result.checkout?.initPoint) {
        window.location.href = result.checkout.initPoint
        return
      }
      setData(result.account)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo liquidar')
    } finally {
      setPaying(false)
    }
  }

  async function startKyc() {
    setKycBusy(true)
    try {
      const result = await api.startKyc()
      setData(result.account)
      window.open(result.url, '_blank', 'noopener')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir Didit')
    } finally {
      setKycBusy(false)
    }
  }

  const unread = data?.notices.filter((item) => !item.read).length || 0

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <div className="public-eyebrow">MI CUENTA</div>
          <h1>Hola, {first}</h1>
          <p>Tu línea, tus cuotas y tus documentos. Todo el crédito en un solo lugar.</p>
        </div>
        <button className="ghost-button" onClick={onLogout}><LogOut size={15} /> Cerrar sesión</button>
      </header>

      <nav className="account-tabs">
        {([['resumen', 'Resumen'], ['linea', 'Línea'], ['pagos', 'Pagos'], ['documentos', 'Documentos'], ['avisos', unread ? `Avisos (${unread})` : 'Avisos'], ['historia', 'Historia'], ['perfil', 'Perfil']] as const).map(([key, label]) => (
          <button key={key} className={tab === key ? 'on' : ''} onClick={() => { setTab(key); if (key === 'avisos') void api.readNotices().then(setData) }}>{label}</button>
        ))}
      </nav>

      {error && <p className="form-error">{error}</p>}
      {!data && !error && <p className="apply-hint">Cargando tu cuenta…</p>}

      {data && tab === 'resumen' && (
        <div className="account-grid">
          <article className="account-card featured">
            <small>{data.credit ? `${data.credit.product} · ${data.credit.publicId}` : 'Sin crédito activo'}</small>
            <strong>{data.credit ? money.format(data.credit.balance) : '—'}</strong>
            <p>{data.credit ? `Saldo · ${data.credit.months} meses · ${data.credit.status === 'paid_off' ? 'Liquidado' : 'Activo'}` : data.application ? `Solicitud ${data.application.publicId}` : 'Todavía no pediste un crédito.'}</p>
            {data.credit && <div className="account-progress"><i style={{ width: `${data.credit.progress}%` }} /></div>}
            {data.quote && <span>TNA {data.quote.tna} · TEA {data.quote.tea} · CFT {data.quote.cft}</span>}
          </article>
          <article className="account-card">
            <span className="account-icon"><CalendarDays size={18} /></span>
            <small>Próxima cuota</small>
            <strong>{data.nextPayment ? moneyExact.format(data.nextPayment.amount) : '—'}</strong>
            <p>{data.nextPayment ? day.format(new Date(`${data.nextPayment.dueDate}T12:00:00`)) : 'Sin vencimientos'}</p>
            <label className="pay-method">Medio de pago
              <select value={method} onChange={(event) => setMethod(event.target.value)}>
                {methods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {data.nextPayment && (
              <div className="pay-actions">
                <button className="hero-primary" onClick={() => void pay(1)} disabled={paying}>{paying ? 'Abriendo…' : method === 'mercadopago' || method === 'rapipago' ? 'Pagar con Mercado Pago' : 'Pagar 1 cuota'}</button>
                <button className="ghost-button" onClick={() => void settle()} disabled={paying}>Liquidar</button>
              </div>
            )}
          </article>
          <article className="account-card">
            <span className="account-icon"><WalletCards size={18} /></span>
            <small>Línea disponible</small>
            <strong>{money.format(data.line.available)}</strong>
            <p>Límite {money.format(data.line.limit)} · usado {money.format(data.line.used)}</p>
            <div className="line-meter"><i style={{ width: `${Math.min(100, (data.line.used / Math.max(data.line.limit, 1)) * 100)}%` }} /></div>
          </article>
          <article className="account-card cta">
            <CreditCard size={20} />
            <h3>¿Necesitás más crédito?</h3>
            <p>Pedí efectivo, usá tu línea o financiá una compra en cuotas. La evaluación demo es inmediata.</p>
            <button className="hero-primary" onClick={onApply}>Nueva solicitud <ArrowUpRight size={15} /></button>
          </article>
        </div>
      )}

      {data && tab === 'linea' && (
        <div className="account-grid">
          <article className="account-card featured">
            <small>Línea Unicréditos</small>
            <strong>{money.format(data.line.available)}</strong>
            <p>Disponible de un límite de {money.format(data.line.limit)}</p>
            <div className="account-progress"><i style={{ width: `${Math.min(100, (data.line.available / Math.max(data.line.limit, 1)) * 100)}%` }} /></div>
            <span>Score {data.user.score || '—'} · cuanto más al día, más tope</span>
          </article>
          <article className="account-card">
            <h3>Cómo usarla</h3>
            <p>Pedí un desembolso desde Solicitar, eligiendo Línea Unicréditos. El monto se acredita en tu CBU y descuenta del disponible.</p>
            <button className="hero-primary" style={{ marginTop: 16 }} onClick={onApply}>Usar mi línea <ArrowUpRight size={15} /></button>
          </article>
        </div>
      )}

      {data && tab === 'pagos' && (
        <div className="account-table">
          <div className="table-line table-head"><span>REFERENCIA</span><span>FECHA</span><span>MONTO</span><span>MEDIO / ESTADO</span></div>
          {data.payments.map((row) => (
            <div className="table-line" key={row.publicId}>
              <b>{row.publicId}</b>
              <span className="muted">{day.format(new Date(`${row.dueDate}T12:00:00`))}</span>
              <b>{moneyExact.format(row.amount)}</b>
              <span className={`status ${row.status === 'Pagado' ? 'ok' : 'warning'}`}><i />{row.status}{row.method ? ` · ${row.method}` : ''}</span>
            </div>
          ))}
          {data.payments.length === 0 && <div className="empty-state">Todavía no hay un calendario de pagos.</div>}
        </div>
      )}

      {data && tab === 'documentos' && (
        <div className="account-docs">
          {data.documents.map((doc) => (
            <article key={doc.name}>
              <FileText size={18} />
              <div><b>{doc.name}</b><small>{doc.status}</small></div>
              <span className={`status ${doc.status.includes('Pendiente') ? 'warning' : 'ok'}`}><i />{doc.status}</span>
            </article>
          ))}
        </div>
      )}

      {data && tab === 'avisos' && (
        <div className="notice-list">
          {data.notices.map((item) => (
            <article key={item.id} className={item.read ? '' : 'fresh'}>
              <Bell size={16} />
              <div>
                <b>{item.title}</b>
                <p>{item.body}</p>
                <small>{day.format(new Date(item.at))}</small>
              </div>
            </article>
          ))}
          {data.notices.length === 0 && <div className="empty-state">No hay avisos todavía.</div>}
        </div>
      )}

      {data && tab === 'historia' && (
        <div className="account-card" style={{ maxWidth: 640 }}>
          <h3>Tu historia</h3>
          <p>Solo clientes con crédito o solicitud aprobada. Se publica con tu nombre de pila y la inicial del apellido, después de que UNICRÉDITOS la apruebe.</p>
          {(!data.credit && data.application?.status !== 'approved') ? (
            <p className="apply-hint">Todavía no hay un crédito o una solicitud aprobada en tu cuenta. Pedí tu crédito para poder contar la experiencia.</p>
          ) : (
            <form className="apply-form" onSubmit={(event) => {
              event.preventDefault()
              setStoryBusy(true)
              void api.submitStory(storyBody, 5)
                .then((result) => { setStories(result.stories); setStoryBody(''); setError('') })
                .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo enviar'))
                .finally(() => setStoryBusy(false))
            }}>
              <label>Contá tu experiencia
                <textarea value={storyBody} onChange={(event) => setStoryBody(event.target.value)} minLength={40} maxLength={280} rows={4} placeholder="Qué pediste, para qué y cómo te fue. Sin datos de terceros ni links." required />
              </label>
              <small className="apply-hint">{storyBody.length}/280 · En revisión hasta que lo apruebe la mesa.</small>
              <button className="hero-primary auth-button" type="submit" disabled={storyBusy || storyBody.trim().length < 40}>{storyBusy ? 'Enviando…' : 'Enviar a revisión'}</button>
            </form>
          )}
          {stories.map((item) => (
            <article key={item.id} className="notice-list" style={{ marginTop: 16 }}>
              <b>{item.product}</b>
              <p>“{item.body}”</p>
              <small>{item.status === 'approved' ? 'Publicada' : item.status === 'rejected' ? 'No publicada' : 'En revisión'} · {day.format(new Date(item.createdAt))}</small>
            </article>
          ))}
        </div>
      )}

      {data && tab === 'perfil' && (
        <div className="account-profile">
          <div className="profile-pic large">{first.slice(0, 1)}</div>
          <div>
            <h3>{data.user.name}</h3>
            <p>Persona · score {data.user.score || '—'} · {data.user.email}</p>
            <ul>
              <li><UserRound size={14} /> DNI {data.user.dni || 'pendiente'} · CUIL {data.user.cuil || 'pendiente'}</li>
              <li><Landmark size={14} /> CBU/CVU {data.user.cbu || 'pendiente'}</li>
              <li><Smartphone size={14} /> {data.user.phone || 'Celular por confirmar'}</li>
              <li><CheckCircle2 size={14} /> {data.user.income ? `Ingreso declarado ${money.format(data.user.income)}` : 'Ingreso por confirmar'}</li>
              <li><QrCode size={14} /> {data.credit ? data.credit.product : 'Sin crédito activo'}</li>
              <li><ShieldCheck size={14} /> KYC {data.user.kycStatus || 'pending'}{bcra ? ` · BCRA sit. ${bcra.unavailable ? 's/d' : bcra.worstSituation ?? 'sin deuda'} · ${bcra.entitiesCount} ent.` : ''}</li>
            </ul>
            {data.user.kycStatus !== 'approved' && (
              <button className="hero-primary" style={{ marginTop: 16 }} onClick={() => void startKyc()} disabled={kycBusy}>{kycBusy ? 'Abriendo Didit…' : 'Verificar identidad con Didit'}</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
