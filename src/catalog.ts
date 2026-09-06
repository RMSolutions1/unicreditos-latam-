import { Clock3, CreditCard, QrCode, WalletCards } from 'lucide-react'

export const products = [
  { id: 'personal', name: 'Préstamo personal', amount: 'Hasta $3.000.000', term: '3 a 48 meses', rate: 'TEM 7,5% · CFT a la vista', tone: 'product-blue', icon: WalletCards, summary: 'Cuota fija francesa. Primer crédito acotado a $400.000.', detail: 'Hasta $3.000.000. Acreditación en tu CBU o CVU cuando tesorería confirma el desembolso.' },
  { id: 'express', name: 'Crédito de consumo', amount: 'Hasta $1.000.000', term: '3 a 24 meses', rate: 'TEM 8,2%', tone: 'product-cyan', icon: Clock3, summary: 'Para un gasto puntual. Misma evaluación KYC + BCRA.', detail: 'Hasta $1.000.000. El primer crédito también respeta el tope de $400.000.' },
  { id: 'linea', name: 'Línea Unicréditos', amount: 'Hasta $1.500.000', term: 'Usá lo que necesités', rate: 'TEM 7,5%', tone: 'product-blue', icon: CreditCard, summary: 'Una línea revolvente. Más al día, más disponible.', detail: 'Activá tu línea y usala cuando quieras. Sin tarjeta física.' },
  { id: 'cuotas', name: 'Cuotas sin tarjeta', amount: 'Hasta $800.000', term: '3 a 24 meses', rate: 'TEM 8,2%', tone: 'product-light', icon: QrCode, summary: 'Financiá una compra en comercios o tiendas online.', detail: 'Elegí el monto y el plazo. Pagás desde tu cuenta Unicréditos.' },
]
