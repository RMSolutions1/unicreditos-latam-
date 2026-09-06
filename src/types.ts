export type Page = 'inicio' | 'creditos' | 'linea' | 'cuotas' | 'como-funciona' | 'simulador' | 'solicitar' | 'tasas' | 'nosotros' | 'ayuda' | 'privacidad' | 'terminos'
export type View = Page | 'cuenta' | 'admin'

export type SessionUser = {
  id: string
  name: string
  firstName: string
  email: string
  phone: string
  income: number
  dni?: string
  cuil?: string
  cbu?: string
  score?: number
  kycStatus?: 'pending' | 'reviewing' | 'approved' | 'rejected'
  role?: 'customer' | 'admin'
}

export type AccountData = {
  user: SessionUser
  line: { limit: number; used: number; available: number }
  credit: {
    publicId: string
    product: string
    amount: number
    balance: number
    months: number
    monthlyPayment: number
    status: 'active' | 'paid_off'
    progress: number
    tna: number
    disbursedTo: string
  } | null
  quote: { tna: string; tea: string; cft: string } | null
  nextPayment: { publicId: string; amount: number; dueDate: string } | null
  paidThisYear: number
  paidCount: number
  pendingCount: number
  payments: { publicId: string; amount: number; dueDate: string; status: string; method: string | null }[]
  documents: { name: string; status: string }[]
  notices: { id: string; title: string; body: string; at: string; read: boolean }[]
  application: {
    publicId: string
    amount: number
    months: number
    monthlyPayment: number
    status: 'under_review' | 'approved' | 'rejected'
    tna: number
    tea: number
    cft: number
    score: number
  } | null
}

export type Quote = {
  productId: string
  product?: string
  amount: number
  months: number
  monthlyPayment: number
  total: number
  tna: number
  tea: number
  cft: number
  tnaLabel: string
  teaLabel: string
  cftLabel: string
}

export const routes: Record<View, string> = {
  inicio: '/',
  creditos: '/creditos',
  linea: '/linea',
  cuotas: '/cuotas',
  'como-funciona': '/como-funciona',
  simulador: '/simulador',
  solicitar: '/solicitar',
  tasas: '/tasas',
  nosotros: '/nosotros',
  ayuda: '/ayuda',
  privacidad: '/privacidad',
  terminos: '/terminos',
  cuenta: '/cuenta',
  admin: '/admin',
}

export function viewFromPath(pathname: string): View {
  const match = (Object.entries(routes) as [View, string][]).find(([, path]) => path === pathname)
  return match?.[0] || 'inicio'
}
