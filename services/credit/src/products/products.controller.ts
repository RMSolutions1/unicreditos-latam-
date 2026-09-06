import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { DomainError } from '../common/errors/domain-error'
import { FinancialCalculationService } from '../finance/financial-calculation.service'
import { SimulateDto } from './dto/simulate.dto'

@Controller()
export class ProductsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinancialCalculationService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('simulate')
  async simulate(@Body() dto: SimulateDto) {
    const product = await this.prisma.client.creditProduct.findUnique({ where: { id: dto.productId, active: true } })
    if (!product) throw new DomainError('PRODUCT_NOT_FOUND', 'Producto no disponible.')
    if (dto.amount < Number(product.minAmount) || dto.amount > Number(product.maxAmount)) {
      throw new DomainError('AMOUNT_OUT_OF_RANGE', `El monto debe estar entre ${product.minAmount} y ${product.maxAmount}.`)
    }
    if (dto.months < product.minTermMonths || dto.months > product.maxTermMonths) {
      throw new DomainError('TERM_OUT_OF_RANGE', `El plazo debe estar entre ${product.minTermMonths} y ${product.maxTermMonths} meses.`)
    }
    return { productId: product.id, product: product.name, ...this.finance.quote(dto.amount, dto.months, Number(product.monthlyRate)) }
  }

  @Get('credit-products')
  async list() {
    const products = await this.prisma.client.creditProduct.findMany({ where: { active: true } })
    return products.map((product) => ({
      ...product,
      sampleQuote: this.finance.quote(Number(product.minAmount), product.minTermMonths, Number(product.monthlyRate)),
    }))
  }

  @Get('credit-products/:id')
  async get(@Param('id') id: string) {
    const product = await this.prisma.client.creditProduct.findUnique({ where: { id } })
    if (!product) throw new DomainError('PRODUCT_NOT_FOUND', 'Producto no encontrado.')
    return product
  }
}
