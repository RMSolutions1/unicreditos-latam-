import { Injectable } from '@nestjs/common'
import { DomainError } from '../../common/errors/domain-error'

/**
 * TaxIdentityService / ARCAAdapter (master prompt §28). ARCA (ex-AFIP) no tiene credenciales
 * configuradas en este proyecto todavía — la interfaz queda lista, pero **nunca se inventa**
 * una respuesta fiscal (docs/SECURITY.md, regla "no inventar respuestas de organismos").
 * Se activa el día que exista un ARCA_API_KEY real.
 */
@Injectable()
export class ArcaAdapter {
  isConfigured() {
    return Boolean(process.env.ARCA_API_KEY?.trim())
  }

  async validateTaxId(_kind: 'DNI' | 'CUIL' | 'CUIT', _value: string): Promise<never> {
    throw new DomainError('TAX_PROVIDER_NOT_CONFIGURED', 'La validación fiscal con ARCA todavía no está configurada.')
  }
}
