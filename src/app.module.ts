import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ConsultasModule } from './consultas/consultas.module';
import { IncidentesModule } from './incidentes/incidentes.module';
import { PublicacionesModule } from './publicaciones/publicaciones.module';
import { ComentariosModule } from './comentarios/comentarios.module';
import { NotificationsGateway } from './notifications/notifications.gateway';
import { UploadModule } from './upload/upload.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EmergencyModule } from './emergency/emergency.module';
import { BlockchainModule } from './blockchain/blockchain.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que las variables de entorno estén disponibles en todo el proyecto
      envFilePath: '.env', // Especificar explícitamente el archivo .env
      cache: false, // Deshabilitar cache para desarrollo
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT) || 5432,
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'Admin',
      database: process.env.DATABASE_NAME || 'diagnostico',
      autoLoadEntities: true, // carga automaticamente las emtidades
      synchronize: true, // Solo para desarrollo; en producción usa migraciones
      ssl: process.env.DATABASE_SSL === 'true' ? {
        rejectUnauthorized: false // Necesario para Render y otros servicios en la nube
      } : false,
      logging: true, // Habilitar logging para debug
      retryAttempts: 3, // Intentos de reconexión
      retryDelay: 3000, // Delay entre intentos
    }),
    UsersModule,
    AuthModule,
    ConsultasModule,
    IncidentesModule,
    PublicacionesModule,
    ComentariosModule,
    UploadModule,
    NotificationsModule,
    EmergencyModule,
    BlockchainModule,
  ],
  controllers: [AppController],
  providers: [AppService, NotificationsGateway],
})
export class AppModule {}