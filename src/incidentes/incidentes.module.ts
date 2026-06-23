import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentesService } from './incidentes.service';
import { IncidentesController } from './incidentes.controller';
import { PublicIncidentesController } from './public-incidentes.controller';
import { CertificadoService } from './certificado.service';
import { IncidenteMapaEntity } from './entities/incidente.entity';
import { User } from '../users/entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IncidenteMapaEntity, User]),
    AuthModule,
    BlockchainModule,
    UploadModule,
  ],
  controllers: [IncidentesController, PublicIncidentesController],
  providers: [IncidentesService, CertificadoService],
  exports: [IncidentesService, CertificadoService, TypeOrmModule],
})
export class IncidentesModule {}