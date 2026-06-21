import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

class VerificarDto {
  @IsString()
  @IsNotEmpty()
  hash: string;
}

class FirmarDto {
  @IsString()
  @IsNotEmpty()
  contenido: string;

  @IsString()
  @IsIn(['INCIDENTE', 'EMERGENCIA'])
  tipo: 'INCIDENTE' | 'EMERGENCIA';
}

@UseGuards(JwtAuthGuard)
@Controller('blockchain')
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  /** Verifica si un hash SHA-256 existe en el contrato Sepolia. */
  @Post('verificar')
  async verificar(@Body() body: VerificarDto) {
    return this.blockchainService.verificar(body.hash);
  }

  /** Consulta el estado on-chain de una transacción. */
  @Get('transaccion/:txHash')
  async consultarTransaccion(@Param('txHash') txHash: string) {
    return this.blockchainService.consultarTransaccion(txHash);
  }

  /** Registra contenido en Sepolia (uso interno/admin). */
  @Post('firmar')
  @HttpCode(HttpStatus.CREATED)
  async firmar(@Body() body: FirmarDto) {
    return this.blockchainService.firmar(body.contenido, body.tipo);
  }
}
