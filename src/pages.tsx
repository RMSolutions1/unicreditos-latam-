import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock3, FileCheck2, HeartPulse, Home, Landmark, Plane, GraduationCap, ShieldCheck, Smartphone, Star, Wallet, Car, BadgePercent, Banknote } from 'lucide-react'
import { api, money, moneyExact } from './api'
import { products } from './catalog'
import { ArgentineFlagMark, IdentityBand } from './identity'
import type { Page, Quote, SessionUser } from './types'

const uses = [
  { icon: Plane, title: 'Viajes', text: 'Ese destino que querés vivir ahora, no en dos años.' },
  { icon: GraduationCap, title: 'Estudios', text: 'Cursos, certificaciones o material para seguir creciendo.' },
  { icon: HeartPulse, title: 'Salud', text: 'Tratamientos, estudios o gastos médicos que no pueden esperar.' },
  { icon: Home, title: 'Hogar', text: 'Muebles, reparaciones o esa mejora que hace más tuya tu casa.' },
  { icon: Car, title: 'Auto', text: 'Mantenimiento, seguro o un ajuste para moverte con tranquilidad.' },
  { icon: Wallet, title: 'Deudas', text: 'Juntá varios pagos en una sola cuota más clara.' },
]

const faqs = [
  { q: '¿Quién puede pedir un crédito?', a: 'Personas mayores de 18 años, con DNI argentino, CUIL, un CBU o CVU a tu nombre y un ingreso demostrable.' },
  { q: '¿En cuánto tiempo tengo respuesta?', a: 'En la mayoría de los casos, en minutos. Si hay que validar DNI o CBU, te avisamos en tu cuenta.' },
  { q: '¿A dónde llega el dinero?', a: 'A tu CBU o CVU. Si se aprueba, lo acreditamos el mismo día hábil.' },
  { q: '¿Puedo pagar antes?', a: 'Sí. Podés adelantar cuotas o liquidar sin comisión por prepago.' },
  { q: '¿Cómo se informa el costo?', a: 'Antes de aceptar ves TNA, TEA y CFT con IVA. El ejemplo es orientativo; la oferta final depende de tu perfil.' },
  { q: '¿Hay sucursales?', a: 'No. Unicréditos es 100% online. Pedís, firmás y pagás desde el celular.' },
]

export function Simulator({ onApply, productId = 'personal' }: { onApply: (amount: number, months: number, productId: string) => void; productId?: string }) {
  const [amount, setAmount] = useState(200000)
  const [months, setMonths] = useState(12)
  const [selected, setSelected] = useState(productId)
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void api.simulate({ amount, months, productId: selected }).then(setQuote).catch(() => setQuote(null))
    }, 180)
    return () => window.clearTimeout(timer)
  }, [amount, months, selected])

  const product = products.find((item) => item.id === selected) || products[0]

  return (
    <div className="simulator">
      <div className="simulator-controls">
        <label>Producto
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>¿Cuánto necesitás?</span>
          <strong>{money.format(amount)}</strong>
          <input type="range" min={product.id === 'express' ? 10000 : 50000} max={product.id === 'express' ? 1000000 : product.id === 'cuotas' ? 800000 : product.id === 'linea' ? 1500000 : 3000000} step={10000} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
        </label>
        <label>
          <span>¿En cuántas cuotas?</span>
          <strong>{months} meses</strong>
          <input type="range" min={3} max={product.id === 'express' || product.id === 'cuotas' ? 24 : product.id === 'linea' ? 24 : 48} step={1} value={months} onChange={(event) => setMonths(Number(event.target.value))} />
        </label>
      </div>
      <div className="simulator-result">
        <small>Tu cuota mensual estimada</small>
        <b>{quote ? moneyExact.format(quote.monthlyPayment) : '…'}</b>
        <p>Total {quote ? moneyExact.format(quote.total) : '—'}. TNA {quote?.tnaLabel || '—'} · TEA {quote?.teaLabel || '—'} · CFT {quote?.cftLabel || '—'} (IVA incl.). Orientativo y sujeto a evaluación.</p>
        <button className="hero-primary" onClick={() => onApply(amount, months, selected)}>Pedir este crédito <ArrowUpRight size={16} /></button>
      </div>
    </div>
  )
}

function StoriesSection() {
  const [stories, setStories] = useState<Array<{ id: string; displayName: string; initials: string; product: string; body: string; stars: number }>>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    void api.publicStories().then(setStories).catch(() => setStories([])).finally(() => setLoaded(true))
  }, [])
  return (
    <section className="public-section quotes-section">
      <div className="section-intro">
        <div className="public-eyebrow">QUIENES YA LO USARON</div>
        <h2>Historias de clientes reales.</h2>
        <p>Solo se publican relatos enviados desde la cuenta de un cliente, y después de la aprobación de UNICRÉDITOS. No hay testimonios inventados.</p>
      </div>
      {!loaded ? (
        <div className="quotes-empty"><p>Cargando historias publicadas…</p></div>
      ) : stories.length === 0 ? (
        <div className="quotes-empty">
          <p>Todavía no hay historias publicadas. Si ya tenés un crédito, podés escribir la tuya en Mi cuenta. UNICRÉDITOS la revisa antes de mostrarla acá.</p>
        </div>
      ) : (
        <div className="quotes-grid">
          {stories.map((story) => (
            <blockquote key={story.id}>
              <div className="quote-head"><span>{story.initials}</span><cite>{story.displayName}<small>{story.product}</small></cite></div>
              <div className="quote-stars" aria-label={`${story.stars} de 5`}>
                {Array.from({ length: story.stars }, (_, index) => <Star key={index} size={13} />)}
              </div>
              <p>“{story.body}”</p>
            </blockquote>
          ))}
        </div>
      )}
    </section>
  )
}

export function HomePage({ go }: { go: (page: Page, extras?: { amount: number; months: number; productId?: string }) => void }) {
  return (
    <>
      <section className="hero-band">
        <div className="public-hero">
          <div className="hero-copy">
            <div className="public-eyebrow"><span /> CRÉDITO DIGITAL ARGENTINO</div>
            <h1>Pedilo online. <em>Lo tenés en tu cuenta.</em></h1>
            <p>Préstamo personal y consumo con sistema francés. KYC Didit, Central de Deudores BCRA y CFT a la vista. El dinero va a tu CBU o CVU.</p>
            <div className="hero-actions">
              <button className="hero-primary" onClick={() => go('solicitar')}>Pedir mi crédito <ArrowUpRight size={17} /></button>
              <button className="hero-secondary" onClick={() => go('simulador')}>Simular mi cuota <ChevronDown size={16} /></button>
            </div>
            <div className="hero-trust">
              <span><CheckCircle2 size={16} /> DNI + selfie</span>
              <span><ShieldCheck size={16} /> CFT informado</span>
              <span><Smartphone size={16} /> 100% online</span>
              <span className="hero-flag-chip"><ArgentineFlagMark /> Hecho en Argentina</span>
            </div>
          </div>
          <div className="hero-art">
            <div className="hero-panel">
              <div className="hero-panel-top"><i /><i /><i /><b>Mi línea</b></div>
              <small>DISPONIBLE HOY</small>
              <strong>$850.000</strong>
              <div className="hero-panel-bar"><em style={{ width: '47%' }} /></div>
              <div className="hero-panel-row"><span>Usado</span><b>$450.000</b></div>
              <div className="hero-panel-row"><span>Cuota ejemplo</span><b>$52.410</b></div>
            </div>
            <div className="floating-stat">
              <span className="floating-icon"><Clock3 size={17} /></span>
              <span><b>Minutos</b><small>para conocer tu oferta</small></span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-trust">
        <div><b>+48.000</b><span>Personas</span></div>
        <div><b>Minutos</b><span>Para tu oferta</span></div>
        <div><b>CBU</b><span>Acreditación el mismo día</span></div>
        <div><b>0</b><span>Sucursales</span></div>
      </section>

      <section className="public-section">
        <div className="section-intro">
          <div className="public-eyebrow">SUITE DE CRÉDITO</div>
          <h2>Cuatro formas de financiarte.</h2>
          <p>Como en las plataformas que ya conocés, pero solo para personas y con el costo a la vista.</p>
        </div>
        <div className="product-grid four">
          {products.map((product) => {
            const Icon = product.icon
            return (
              <article className={`public-product ${product.tone}`} key={product.id}>
                <span className="product-icon"><Icon size={21} /></span>
                <small>100% ONLINE</small>
                <h3>{product.name}</h3>
                <p>{product.summary}</p>
                <b>{product.amount} <ArrowUpRight size={14} /></b>
              </article>
            )
          })}
        </div>
        <div className="section-cta">
          <button className="hero-secondary" onClick={() => go('creditos')}>Ver condiciones de cada producto <ArrowUpRight size={15} /></button>
        </div>
      </section>

      <section className="public-section uses-section">
        <div className="section-intro">
          <div className="public-eyebrow">ÚSALO COMO QUIERAS</div>
          <h2>Tu crédito, tus planes.</h2>
        </div>
        <div className="uses-grid">
          {uses.map((use) => {
            const Icon = use.icon
            return <article key={use.title}><span><Icon size={20} /></span><h3>{use.title}</h3><p>{use.text}</p></article>
          })}
        </div>
      </section>

      <IdentityBand />

      <section className="public-process">
        <div className="section-intro">
          <div className="public-eyebrow">ASÍ DE SENCILLO</div>
          <h2>De la selfie al CBU.</h2>
        </div>
        <div className="process-grid">
          <div><span>01</span><h3>Simulá</h3><p>Elegí monto y plazo. Ves TNA, TEA y CFT antes de pedir.</p></div>
          <div><span>02</span><h3>Validá tu identidad</h3><p>DNI, selfie y CBU o CVU a tu nombre. Todo desde el celular.</p></div>
          <div><span>03</span><h3>Aceptá la oferta</h3><p>Si da, te mostramos la cuota y el costo total. Vos decidís.</p></div>
          <div><span>04</span><h3>Recibí el dinero</h3><p>Lo acreditamos en tu cuenta. Después pagás por Mercado Pago, homebanking o Rapipago.</p></div>
        </div>
      </section>

      <section className="public-section">
        <div className="section-intro">
          <div className="public-eyebrow">CALCULÁ ANTES DE PEDIR</div>
          <h2>Simulá tu crédito.</h2>
          <p>Sin compromiso y sin consultar el buró hasta que envíes la solicitud.</p>
        </div>
        <Simulator onApply={(amount, months, productId) => go('solicitar', { amount, months, productId })} />
      </section>

      <StoriesSection />

      <section className="public-banner">
        <div>
          <div className="public-eyebrow">EMPEZÁ HOY</div>
          <h2>Tu oferta está a unos minutos.</h2>
          <p>Simulá, validá tu DNI y recibí el dinero en tu CBU. Pagá con el medio que ya usás.</p>
        </div>
        <button className="hero-secondary" onClick={() => go('solicitar')}>Pedir ahora <ArrowUpRight size={16} /></button>
      </section>
    </>
  )
}

export function CreditsPage({ go }: { go: (page: Page, extras?: { productId?: string }) => void }) {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">PRODUCTOS</div>
        <h2>Crédito digital para personas.</h2>
        <p>Efectivo, express, línea revolvente y cuotas sin tarjeta. Todas con CFT informado.</p>
      </div>
      <div className="detail-products">
        {products.map((product) => {
          const Icon = product.icon
          return (
            <article key={product.id}>
              <span className="product-icon light-icon"><Icon size={22} /></span>
              <div>
                <h3>{product.name}</h3>
                <p>{product.detail}</p>
              </div>
              <ul>
                <li>{product.amount}</li>
                <li>{product.term}</li>
                <li>{product.rate}</li>
              </ul>
              <button className="hero-primary" onClick={() => go('solicitar', { productId: product.id })}>Pedir <ArrowUpRight size={15} /></button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function LinePage({ go }: { go: (page: Page, extras?: { productId?: string }) => void }) {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">LÍNEA UNICRÉDITOS</div>
        <h2>Usá solo lo que necesitás.</h2>
        <p>Una línea revolvente: se aprueba una vez y la usás cuando quieras. Pagás por lo que usás.</p>
      </div>
      <div className="how-grid">
        <article><CreditIcon /><h3>Sin tarjeta física</h3><p>La línea vive en tu cuenta. No hay plástico ni sucursal.</p></article>
        <article><BadgePercent size={22} /><h3>Disponible que crece</h3><p>Si pagás al día, tu límite puede subir en la próxima evaluación.</p></article>
        <article><Banknote size={22} /><h3>Desembolso a CBU</h3><p>Cada uso se acredita en tu cuenta bancaria o virtual.</p></article>
        <article><ShieldCheck size={22} /><h3>Costo por uso</h3><p>No pagás intereses sobre el disponible que no usaste.</p></article>
      </div>
      <div className="section-cta"><button className="hero-primary" onClick={() => go('solicitar', { productId: 'linea' })}>Activar mi línea <ArrowUpRight size={16} /></button></div>
    </section>
  )
}

function CreditIcon() {
  return <CreditCardIcon />
}

function CreditCardIcon() {
  return <Landmark size={22} />
}

export function InstallmentsPage({ go }: { go: (page: Page, extras?: { productId?: string }) => void }) {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">CUOTAS SIN TARJETA</div>
        <h2>Comprá ahora, pagá en cuotas fijas.</h2>
        <p>Financiá una compra en tiendas o comercios. Sin tarjeta de crédito. Con Unicréditos.</p>
      </div>
      <div className="how-grid">
        <article><Building2 size={22} /><h3>Comercios y online</h3><p>Usá el monto para una compra puntual: electro, hogar o lo que necesites.</p></article>
        <article><CalendarDays size={22} /><h3>3 a 24 cuotas</h3><p>Elegís el plazo. La cuota queda fija desde el primer día.</p></article>
        <article><Smartphone size={22} /><h3>Todo en la app web</h3><p>Pedís, ves el CFT y pagás las cuotas desde tu cuenta.</p></article>
        <article><CheckCircle2 size={22} /><h3>Sin plástico</h3><p>No hace falta tarjeta. La financiación es el crédito.</p></article>
      </div>
      <div className="section-cta"><button className="hero-primary" onClick={() => go('solicitar', { productId: 'cuotas' })}>Financiar una compra <ArrowUpRight size={16} /></button></div>
    </section>
  )
}

export function HowPage() {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">CÓMO FUNCIONA</div>
        <h2>De la solicitud al depósito.</h2>
      </div>
      <div className="how-grid">
        <article><FileCheck2 size={22} /><h3>1. Datos y DNI</h3><p>Nombre, CUIL, selfie y CBU o CVU. Menos de cinco minutos.</p></article>
        <article><ShieldCheck size={22} /><h3>2. Evaluación</h3><p>Score interno + perfil de ingresos. Te mostramos TNA, TEA y CFT.</p></article>
        <article><CalendarDays size={22} /><h3>3. Aceptás</h3><p>Ves la cuota antes de firmar. Sin letra chica escondida.</p></article>
        <article><Wallet size={22} /><h3>4. Plata en tu cuenta</h3><p>Transferencia a tu CBU/CVU. Después pagás por el medio que elijas.</p></article>
      </div>
      <div className="requirements">
        <h3>Lo que necesitás</h3>
        <ul>
          <li>Ser mayor de 18 años y vivir en Argentina</li>
          <li>DNI argentino vigente y una selfie</li>
          <li>CUIL y un ingreso mensual</li>
          <li>CBU o CVU a tu nombre</li>
          <li>Celular y correo electrónico</li>
        </ul>
      </div>
    </section>
  )
}

export function SimulatorPage({ go }: { go: (page: Page, extras?: { amount: number; months: number; productId?: string }) => void }) {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">SIMULADOR</div>
        <h2>Armá tu crédito a medida.</h2>
        <p>Esta simulación es informativa. La oferta se confirma al evaluar tu solicitud.</p>
      </div>
      <Simulator onApply={(amount, months, productId) => go('solicitar', { amount, months, productId })} />
    </section>
  )
}

export function RatesPage() {
  const [rows, setRows] = useState<Array<{ name: string; tnaLabel: string; teaLabel: string; cftLabel: string }>>([])
  const [fx, setFx] = useState<Array<{ moneda: string; tipoCotizacion: number | null }>>([])
  useEffect(() => {
    void api.products().then((list) => setRows(list.map((item) => ({ name: item.name, tnaLabel: item.tnaLabel, teaLabel: item.teaLabel, cftLabel: item.cftLabel })))).catch(() => setRows([]))
    void api.bcraFx().then((result) => setFx(result.fx || [])).catch(() => setFx([]))
  }, [])
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">TASAS Y CFT</div>
        <h2>El costo, sin letra chica.</h2>
        <p>Catálogo operativo UNICRÉDITOS: TNA, TEA y CFT = TEA × 1,21 (IVA sobre intereses). Referencia $500.000 a 12 meses.</p>
      </div>
      <div className="rate-table">
        <div className="table-line table-head"><span>PRODUCTO</span><span>TNA</span><span>TEA</span><span>CFT</span></div>
        {rows.map((row) => (
          <div className="table-line" key={row.name}><b>{row.name}</b><span>{row.tnaLabel}</span><span>{row.teaLabel}</span><span>{row.cftLabel}</span></div>
        ))}
      </div>
      {fx.length > 0 && (
        <p className="about-copy">Cotizaciones BCRA: {fx.map((row) => `${row.moneda} ${row.tipoCotizacion ?? '—'}`).join(' · ')}</p>
      )}
      <p className="about-copy">No somos un banco ni afirmamos inscripción PNFC. La oferta final se confirma en contrato.</p>
    </section>
  )
}

export function ApplyPage({ preset, loggedIn, onDone }: { preset?: { amount?: number; months?: number; productId?: string }; loggedIn?: boolean; onDone: (user: SessionUser) => void }) {
  const [step, setStep] = useState(1)
  const [productId, setProductId] = useState(preset?.productId ?? 'personal')
  const [amount, setAmount] = useState(preset?.amount ?? 200000)
  const [months, setMonths] = useState(preset?.months ?? 12)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [dni, setDni] = useState('')
  const [cuil, setCuil] = useState('')
  const [cbu, setCbu] = useState('')
  const [income, setIncome] = useState('')
  const [folio, setFolio] = useState('')
  const [status, setStatus] = useState('')
  const [offer, setOffer] = useState<{ payment: number; tna: number; tea: number; cft: number; score: number } | null>(null)
  const [createdUser, setCreatedUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quoteData, setQuoteData] = useState<Quote | null>(null)
  const [cbuHint, setCbuHint] = useState('')

  useEffect(() => {
    void api.simulate({ amount, months, productId }).then(setQuoteData).catch(() => setQuoteData(null))
  }, [amount, months, productId])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (step === 1) { setStep(2); return }
    if (step !== 2) return
    setLoading(true)
    try {
      const result = await api.apply({
        name,
        email,
        password: password || 'demo1234',
        phone,
        dni,
        cuil,
        cbu,
        income: Number(String(income).replace(/[^\d.]/g, '')) || 0,
        productId,
        amount,
        months,
      })
      if (result.token) localStorage.setItem('unicreditos_token', result.token)
      setFolio(result.application.publicId)
      setStatus(result.application.status)
      setOffer({
        payment: result.application.monthlyPayment,
        tna: result.application.tna,
        tea: result.application.tea,
        cft: result.application.cft,
        score: result.application.score,
      })
      setCreatedUser(result.user)
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  const resultCopy = status === 'approved'
    ? 'Tu crédito fue preaprobado y el desembolso quedó registrado en tu CBU/CVU.'
    : status === 'rejected'
      ? 'Por ahora no podemos ofrecerte este monto. Probá un plazo más largo o un monto menor.'
      : 'Vamos a validar tu DNI y CBU. Te avisamos en tu cuenta.'

  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">SOLICITUD DIGITAL</div>
        <h2>{step < 3 ? 'Pedí tu crédito en línea.' : 'Solicitud enviada.'}</h2>
        <p>{step < 3 ? 'En modo demo la evaluación es inmediata y ves TNA, TEA y CFT.' : resultCopy}</p>
      </div>
      <form className="apply-form" onSubmit={submit}>
        <div className="apply-steps"><span className={step >= 1 ? 'on' : ''}>1 Monto</span><span className={step >= 2 ? 'on' : ''}>2 Identidad</span><span className={step >= 3 ? 'on' : ''}>3 Oferta</span></div>
        {error && <p className="form-error">{error}</p>}
        {step === 1 && (
          <>
            <label>Producto
              <select value={productId} onChange={(event) => setProductId(event.target.value)}>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <label>Monto solicitado
              <select value={amount} onChange={(event) => setAmount(Number(event.target.value))}>
                {[50000, 100000, 200000, 350000, 400000, 500000, 800000, 1200000, 2500000, 3000000].filter((value) => productId !== 'express' || value <= 1000000).filter((value) => productId !== 'cuotas' || value <= 800000).filter((value) => productId !== 'linea' || value <= 1500000).map((value) => <option key={value} value={value}>{money.format(value)}</option>)}
              </select>
            </label>
            <label>Plazo
              <select value={months} onChange={(event) => setMonths(Number(event.target.value))}>
                {[3, 6, 9, 12, 18, 24, 36, 48].filter((value) => (productId !== 'express' && productId !== 'cuotas' && productId !== 'linea') || value <= 24).map((value) => <option key={value} value={value}>{value} meses</option>)}
              </select>
            </label>
            <p className="apply-hint">Cuota estimada: <b>{quoteData ? moneyExact.format(quoteData.monthlyPayment) : '…'}</b> · CFT {quoteData?.cftLabel || '—'}</p>
            <button className="hero-primary auth-button" type="submit">Continuar <ArrowUpRight size={16} /></button>
          </>
        )}
        {step === 2 && (
          <>
            {!loggedIn && (
              <>
                <label>Nombre completo<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como figura en tu DNI" required /></label>
                <label>Correo electrónico<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tucorreo@email.com" required /></label>
                <label>Contraseña<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} /></label>
              </>
            )}
            <label>DNI<input value={dni} onChange={(event) => setDni(event.target.value)} placeholder="32333444" required /></label>
            <label>CUIL<input value={cuil} onChange={(event) => setCuil(event.target.value)} placeholder="20-32333444-8" required /></label>
            <label>CBU, CVU o alias
              <input value={cbu} onChange={(event) => setCbu(event.target.value)} onBlur={() => { if (cbu.trim().length >= 6) void api.validateCbu(cbu).then((result) => setCbuHint(result.ok ? `${result.data?.titular || 'Titular ok'} · ${result.data?.entidad || 'cuenta validada'}` : result.message || 'No se pudo validar')).catch(() => setCbuHint('')) }} placeholder="22 dígitos o alias Coelsa" required minLength={6} />
            </label>
            {cbuHint && <p className="apply-hint">{cbuHint}</p>}
            <label>Celular<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="11 1234-5678" required /></label>
            <label>Ingreso mensual<input value={income} onChange={(event) => setIncome(event.target.value)} placeholder="350000" required /></label>
            <small className="apply-legal">Al enviar autorizás KYC Didit, la consulta a la Central de Deudores del BCRA y la validación de tu CBU/CVU.</small>
            <button className="hero-primary auth-button" type="submit" disabled={loading}>{loading ? 'Evaluando…' : 'Ver mi oferta'} <ArrowUpRight size={16} /></button>
          </>
        )}
        {step === 3 && (
          <div className="apply-done">
            <CheckCircle2 size={36} />
            <h3>{status === 'approved' ? 'Oferta preaprobada' : status === 'rejected' ? 'Solicitud no aprobada' : 'Estamos revisando'}</h3>
            <p>Folio {folio}. {resultCopy}</p>
            {offer && status !== 'rejected' && (
              <div className="offer-card">
                <span>Score {offer.score}</span>
                <b>{moneyExact.format(offer.payment)} / mes</b>
                <small>TNA {offer.tna.toFixed(1)}% · TEA {offer.tea.toFixed(2)}% · CFT {offer.cft.toFixed(2)}%</small>
              </div>
            )}
            <button className="hero-primary" type="button" onClick={() => onDone(createdUser || { id: '', name, firstName: name.split(' ')[0] || 'Hola', email, phone, income: 0 })}>Ir a mi cuenta <ArrowUpRight size={16} /></button>
          </div>
        )}
      </form>
    </section>
  )
}

export function AboutPage() {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">NOSOTROS</div>
        <h2>Crédito digital, hecho en Argentina.</h2>
      </div>
      <div className="about-copy">
        <p>Unicréditos es una plataforma de crédito para personas: efectivo, línea revolvente y cuotas sin tarjeta. Nacimos para que pedir plata sea tan simple como hacerlo desde el celular.</p>
        <p>Mostramos TNA, TEA y CFT antes de que aceptes. El dinero va a tu CBU o CVU. Vos pagás por Mercado Pago, homebanking o Rapipago.</p>
        <p>La evaluación usa el catálogo operativo de UNICRÉDITOS (TEM, TNA, TEA, CFT), Didit, ArgenAPI y la Central de Deudores del BCRA.</p>
      </div>
    </section>
  )
}

export function HelpPage() {
  const [open, setOpen] = useState(0)
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">AYUDA</div>
        <h2>Preguntas frecuentes.</h2>
        <p>Si no encontrás lo que buscás, escribinos a hola@unicreditos.com.ar</p>
      </div>
      <div className="faq-list">
        {faqs.map((item, index) => (
          <button key={item.q} className={`faq-item ${open === index ? 'open' : ''}`} onClick={() => setOpen(open === index ? -1 : index)}>
            <span>{item.q}<ChevronDown size={16} /></span>
            {open === index && <p>{item.a}</p>}
          </button>
        ))}
      </div>
    </section>
  )
}

export function TermsPage() {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">TÉRMINOS</div>
        <h2>Condiciones del crédito.</h2>
      </div>
      <div className="about-copy">
        <p>Unicréditos ofrece crédito personal en línea sujeto a evaluación. El CFT, la TNA, la TEA y la cuota se confirman antes de que aceptes. Sistema de amortización francés, cuotas fijas.</p>
        <p>Podés adelantar cuotas o liquidar sin comisión por prepago. El dinero se deposita solo en un CBU o CVU a tu nombre.</p>
        <p>Esta versión es una demostración: las decisiones son automáticas y no constituyen una oferta vinculante de una entidad financiera.</p>
      </div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <section className="public-section page-block">
      <div className="section-intro">
        <div className="public-eyebrow">AVISO DE PRIVACIDAD</div>
        <h2>Cuidamos tus datos.</h2>
      </div>
      <div className="about-copy">
        <p>Recabamos nombre, DNI, CUIL, CBU/CVU, correo, teléfono e ingresos únicamente para evaluar y administrar tu crédito.</p>
        <p>No vendemos tus datos. Ley 25.326. Podés pedir acceso, corrección o cancelación a privacidad@unicreditos.com.ar.</p>
      </div>
    </section>
  )
}
