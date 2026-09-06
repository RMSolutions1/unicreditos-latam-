import { useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { api, day } from './api'

type AdminStory = {
  id: string
  displayName: string
  email: string
  product: string
  body: string
  stars: number
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export function AdminPage() {
  const [stories, setStories] = useState<AdminStory[]>([])
  const [error, setError] = useState('')

  function load() {
    void api.adminStories().then(setStories).catch((err) => setError(err instanceof Error ? err.message : 'Sin acceso a la mesa'))
  }

  useEffect(() => { load() }, [])

  async function review(id: string, action: 'approve' | 'reject') {
    try {
      const result = await api.reviewStory(id, action)
      setStories(result.stories)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revisar')
    }
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <div className="public-eyebrow">MESA UNICRÉDITOS</div>
          <h1>Historias para publicar</h1>
          <p>Solo acá se aprueba lo que aparece en la home. Nada se publica solo.</p>
        </div>
      </header>
      {error && <p className="form-error">{error}</p>}
      <div className="account-table">
        <div className="table-line table-head"><span>CLIENTE</span><span>PRODUCTO</span><span>HISTORIA</span><span>ESTADO</span></div>
        {stories.map((item) => (
          <div className="table-line" key={item.id} style={{ alignItems: 'start' }}>
            <div>
              <b>{item.displayName}</b>
              <small className="muted">{item.email}</small>
              <small className="muted">{day.format(new Date(item.createdAt))}</small>
            </div>
            <span>{item.product}</span>
            <p style={{ margin: 0 }}>“{item.body}”</p>
            <div>
              <span className={`status ${item.status === 'approved' ? 'ok' : item.status === 'rejected' ? 'warning' : ''}`}><i />{item.status === 'approved' ? 'Publicada' : item.status === 'rejected' ? 'Rechazada' : 'Pendiente'}</span>
              {item.status === 'pending' && (
                <div className="pay-actions" style={{ marginTop: 8 }}>
                  <button className="hero-primary" type="button" onClick={() => void review(item.id, 'approve')}><CheckCircle2 size={14} /> Publicar</button>
                  <button className="ghost-button" type="button" onClick={() => void review(item.id, 'reject')}><X size={14} /> Rechazar</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {stories.length === 0 && !error && <div className="empty-state">No hay historias enviadas.</div>}
      </div>
    </div>
  )
}
