import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { EmergencyService } from './emergency.service';
import { CreateEmergencyContactDto } from './dto/create-emergency-contact.dto';
import { UpdateEmergencyContactDto } from './dto/update-emergency-contact.dto';
import { CreateEmergencyAlertDto } from './dto/create-emergency-alert.dto';
import { EmergencyContactResponseDto } from './dto/emergency-contact-response.dto';
import { EmergencyAlertResponseDto } from './dto/emergency-alert-response.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ActiveUser } from 'src/common/decorators/active-user.decorator';
import { UserActiveInterface } from 'src/common/interfaces/user-active.interface';

@ApiTags('emergency')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  // ===== CONTACTOS DE EMERGENCIA =====

  @Post('contacts')
  async createEmergencyContact(
    @ActiveUser() user: UserActiveInterface,
    @Body() createEmergencyContactDto: CreateEmergencyContactDto,
  ): Promise<EmergencyContactResponseDto> {
    return this.emergencyService.createEmergencyContact(
      user.id,
      createEmergencyContactDto,
    );
  }

  @Get('contacts')
  async findAllEmergencyContacts(
    @ActiveUser() user: UserActiveInterface,
  ): Promise<EmergencyContactResponseDto[]> {
    return this.emergencyService.findAllEmergencyContacts(user.id);
  }

  @Get('contacts/:id')
  async findOneEmergencyContact(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
  ): Promise<EmergencyContactResponseDto> {
    return this.emergencyService.findOneEmergencyContact(+id, user.id);
  }

  @Patch('contacts/:id')
  async updateEmergencyContact(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
    @Body() updateEmergencyContactDto: UpdateEmergencyContactDto,
  ): Promise<EmergencyContactResponseDto> {
    return this.emergencyService.updateEmergencyContact(
      +id,
      user.id,
      updateEmergencyContactDto,
    );
  }

  @Patch('contacts/:id/fcm-token')
  async updateContactFCMToken(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
    @Body() body: { fcmToken: string },
  ): Promise<EmergencyContactResponseDto> {
    return this.emergencyService.updateEmergencyContact(
      +id,
      user.id,
      { fcmToken: body.fcmToken },
    );
  }

  @Delete('contacts/:id')
  async removeEmergencyContact(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
  ): Promise<{ message: string }> {
    await this.emergencyService.removeEmergencyContact(+id, user.id);
    return { message: 'Contacto de emergencia eliminado exitosamente' };
  }

  // ===== ALERTAS DE EMERGENCIA =====

  @Post('alerts')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        location: { type: 'string' },
        type: { type: 'string', enum: ['panic_button', 'automatic_detection', 'manual_trigger'] },
        metadata: { type: 'string' },
        video: {
          type: 'string',
          format: 'binary',
        },
        audio: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async createEmergencyAlert(
    @ActiveUser() user: UserActiveInterface,
    @Body() createEmergencyAlertDto: CreateEmergencyAlertDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: 'video/*' }),
        ],
        fileIsRequired: false,
      }),
    )
    videoFile?: Express.Multer.File,
  ): Promise<EmergencyAlertResponseDto> {
    return this.emergencyService.createEmergencyAlert(
      user.id,
      createEmergencyAlertDto,
      undefined, // audio
    );
  }

  @Post('alerts/panic-button')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        location: { type: 'string' },
        metadata: { type: 'string' },
        video: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async triggerPanicButton(
    @ActiveUser() user: UserActiveInterface,
    @Body() createEmergencyAlertDto: CreateEmergencyAlertDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: 'video/*' }),
        ],
        fileIsRequired: false,
      }),
    )
    videoFile?: Express.Multer.File,
  ): Promise<EmergencyAlertResponseDto> {
    // Forzar tipo de alerta como panic_button
    const alertData = {
      ...createEmergencyAlertDto,
      type: 'panic_button' as any,
    };

    return this.emergencyService.createEmergencyAlert(
      user.id,
      alertData,
      undefined, // audio
    );
  }

  @Patch('alerts/:id/video')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        video: {
          type: 'string',
          format: 'binary',
        },
        local_signature: { type: 'string' },
        public_key: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async attachVideoToAlert(
    @ActiveUser() user: UserActiveInterface,
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }), // 50MB
          new FileTypeValidator({ fileType: 'video/*' }),
        ],
        fileIsRequired: true,
      }),
    )
    videoFile: Express.Multer.File,
    @Body('local_signature') localSignature?: string,
    @Body('public_key') publicKey?: string,
  ): Promise<EmergencyAlertResponseDto> {
    return this.emergencyService.attachVideoToAlert(id, user.id, videoFile, localSignature, publicKey);
  }

  /**
   * Endpoint para sincronizar alertas generadas sin internet (offline-first).
   * Misma lógica que panic-button pero acepta el campo `offlineTimestamp`
   * para preservar la hora real de la emergencia.
   */
  @Post('alerts/sync')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        location: { type: 'string' },
        offlineTimestamp: { type: 'string', description: 'ISO timestamp de cuando ocurrió la emergencia' },
        metadata: { type: 'string' },
        video: { type: 'string', format: 'binary' },
        local_signature: { type: 'string' },
        public_key: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('video', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async syncOfflineAlert(
    @ActiveUser() user: UserActiveInterface,
    @Body() body: CreateEmergencyAlertDto & { offlineTimestamp?: string },
    @Body('metadata') metadataStr?: string,
    @Body('local_signature') localSignature?: string,
    @Body('public_key') publicKey?: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: 'video/*' }),
        ],
        fileIsRequired: false,
      }),
    )
    videoFile?: Express.Multer.File,
  ): Promise<EmergencyAlertResponseDto> {
    // Marcar en metadata que es una sincronización offline
    const metadata = {
      ...(typeof body.metadata === 'string' ? JSON.parse(body.metadata || '{}') : (body.metadata ?? {})),
      offlineSync: true,
      offlineTimestamp: body.offlineTimestamp,
    };

    const alertData: CreateEmergencyAlertDto = {
      ...body,
      type: 'panic_button' as any,
      metadata,
    };

    // skipNotifications=true: la emergencia ya ocurrió offline, no reenviar alertas
    const savedAlert = await this.emergencyService.createEmergencyAlert(user.id, alertData, undefined, true);
    if (videoFile) {
      return this.emergencyService.attachVideoToAlert(savedAlert.id, user.id, videoFile, localSignature, publicKey);
    }
    return savedAlert;
  }

  @Get('alerts')
  async findAllEmergencyAlerts(
    @ActiveUser() user: UserActiveInterface,
  ): Promise<EmergencyAlertResponseDto[]> {
    return this.emergencyService.findAllEmergencyAlerts(user.id);
  }

  @Get('alerts/:id')
  async findOneEmergencyAlert(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
  ): Promise<EmergencyAlertResponseDto> {
    return this.emergencyService.findOneEmergencyAlert(+id, user.id);
  }

  @Get('alerts/:id/certificado')
  async descargarCertificado(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
  ) {
    return this.emergencyService.descargarCertificado(+id, user.id);
  }

  @Patch('alerts/:id/resolve')
  async resolveEmergencyAlert(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
    @Body() body: { resolutionNotes?: string },
  ): Promise<EmergencyAlertResponseDto> {
    return this.emergencyService.resolveEmergencyAlert(
      +id,
      user.id,
      body.resolutionNotes,
    );
  }

  @Patch('alerts/:id/false-alarm')
  async markAsFalseAlarm(
    @Param('id') id: string,
    @ActiveUser() user: UserActiveInterface,
    @Body() body: { resolutionNotes?: string },
  ): Promise<EmergencyAlertResponseDto> {
    return this.emergencyService.markAsFalseAlarm(
      +id,
      user.id,
      body.resolutionNotes,
    );
  }

  // ===== ESTADÍSTICAS =====

  @Get('stats')
  async getEmergencyStats(@ActiveUser() user: UserActiveInterface) {
    return this.emergencyService.getEmergencyStats(user.id);
  }

  // ===== SERVICIOS DE NOTIFICACIÓN =====

  @Get('notification-services/status')
  async getNotificationServicesStatus() {
    return this.emergencyService.getNotificationServicesStatus();
  }
} 