import { Controller, Get, Param, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidenteMapaEntity } from './entities/incidente.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Controller('public/incidentes')
export class PublicIncidentesController {
  constructor(
    @InjectRepository(IncidenteMapaEntity)
    private readonly incidenteRepo: Repository<IncidenteMapaEntity>,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Get('verificar/:txHash')
  async verificarTransaccion(@Param('txHash') txHash: string) {
    if (!txHash) throw new BadRequestException('txHash requerido');
    
    const incidente = await this.incidenteRepo.findOne({
      where: { tx_hash: txHash }
    });

    if (!incidente) {
      throw new NotFoundException('El txHash no existe en nuestros registros');
    }

    try {
      // Verificar on-chain
      const status = await this.blockchainService.consultarTransaccion(txHash);
      
      return {
        hash_reporte: incidente.doc_hash,
        descripcion: incidente.descripcion,
        gps: incidente.latitud_longitud,
        timestamp_bd: incidente.fecha_incidente,
        estado_confirmacion: status.estado,
        etherscan_url: status.etherscan,
        blockchain_timestamp: incidente.fecha_incidente, // we use DB or contract if we need
      };
    } catch (e) {
      return {
        error: 'No se pudo conectar a Sepolia',
        hash_reporte: incidente.doc_hash,
        descripcion: incidente.descripcion,
        gps: incidente.latitud_longitud,
        timestamp_bd: incidente.fecha_incidente,
        estado_confirmacion: 'No disponible temporalmente',
        etherscan_url: `https://sepolia.etherscan.io/tx/${txHash}`,
      };
    }
  }
}
