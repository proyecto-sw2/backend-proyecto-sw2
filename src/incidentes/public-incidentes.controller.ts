import { Controller, Get, Param, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IncidenteMapaEntity } from './entities/incidente.entity';
import { EmergencyAlert } from '../emergency/entities/emergency-alert.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

@Controller('public/incidentes')
export class PublicIncidentesController {
  constructor(
    @InjectRepository(IncidenteMapaEntity)
    private readonly incidenteRepo: Repository<IncidenteMapaEntity>,
    @InjectRepository(EmergencyAlert)
    private readonly emergencyRepo: Repository<EmergencyAlert>,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Get('verificar/:txHash')
  async verificarTransaccion(@Param('txHash') txHash: string) {
    if (!txHash) throw new BadRequestException('txHash requerido');
    
    let record: any = await this.incidenteRepo.findOne({
      where: { tx_hash: txHash }
    });

    let isEmergency = false;
    if (!record) {
      record = await this.emergencyRepo.findOne({
        where: { tx_hash: txHash }
      });
      if (record) isEmergency = true;
    }

    if (!record) {
      throw new NotFoundException('El txHash no existe en nuestros registros (Ni incidente, ni emergencia)');
    }

    try {
      // Verificar on-chain
      const status = await this.blockchainService.consultarTransaccion(txHash);
      
      return {
        hash_reporte: record.doc_hash,
        descripcion: isEmergency ? record.description : record.descripcion,
        gps: isEmergency ? `${record.latitude}, ${record.longitude}` : record.latitud_longitud,
        timestamp_bd: isEmergency ? record.createdAt : record.fecha_incidente,
        video_url: isEmergency ? record.videoUrl : record.evidencia_url,
        estado_confirmacion: status.estado,
        etherscan_url: status.etherscan,
        blockchain_timestamp: isEmergency ? record.createdAt : record.fecha_incidente,
      };
    } catch (e) {
      return {
        error: 'No se pudo conectar a Sepolia',
        hash_reporte: record.doc_hash,
        descripcion: isEmergency ? record.description : record.descripcion,
        gps: isEmergency ? `${record.latitude}, ${record.longitude}` : record.latitud_longitud,
        timestamp_bd: isEmergency ? record.createdAt : record.fecha_incidente,
        video_url: isEmergency ? record.videoUrl : record.evidencia_url,
        estado_confirmacion: 'No disponible temporalmente',
        etherscan_url: `https://sepolia.etherscan.io/tx/${txHash}`,
      };
    }
  }
}
