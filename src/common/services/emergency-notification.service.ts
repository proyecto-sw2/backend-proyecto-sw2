import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import { EmailNotificationService } from './email-notification.service';
import { WhatsAppNotificationService } from './whatsapp-notification.service';

export interface NotificationContact {
  id: number;
  name: string;
  phone: string;
  email?: string;
  fcmToken?: string;
  apnsToken?: string;
}

export interface EmergencyAlertData {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  type: string;
  description?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  videoUrl?: string;
  audioUrl?: string;
  duration: number;
  metadata?: any;
  createdAt: Date;
}

@Injectable()
export class EmergencyNotificationService {
  private readonly logger = new Logger(EmergencyNotificationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailNotificationService,
    private readonly whatsAppService: WhatsAppNotificationService,
  ) {
    this.initializeFirebase();
  }

  // ── Firebase ────────────────────────────────────────────────────────────────

  private initializeFirebase() {
    try {
      if (!admin.apps.length) {
        const pathToSecret =
          process.env.PATH_TO_SECRET ||
          this.configService.get<string>('PATH_TO_SECRET');

        if (!pathToSecret || !fs.existsSync(pathToSecret)) {
          this.logger.warn(
            '⚠️ Credenciales Firebase no encontradas. Push notifications desactivadas.',
          );
          return;
        }

        const serviceAccount = JSON.parse(fs.readFileSync(pathToSecret, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
          projectId: serviceAccount.project_id,
        });

        this.logger.log('✅ Firebase Admin SDK inicializado');
      }
    } catch (error) {
      this.logger.error('❌ Error inicializando Firebase:', error);
    }
  }

  // ── Punto de entrada principal ───────────────────────────────────────────────

  /**
   * Envía notificaciones de emergencia por todos los canales disponibles:
   * Email, WhatsApp, FCM (push), WebSocket (manejado por gateway).
   */
  async sendEmergencyNotification(
    contact: NotificationContact,
    alertData: EmergencyAlertData,
  ): Promise<void> {
    this.logger.log(
      `🔔 Notificando a ${contact.name} por alerta ${alertData.id}...`,
    );

    const tasks: Promise<void>[] = [];

    // 1. Email
    if (contact.email) {
      tasks.push(this.emailService.sendEmergencyEmail(contact, alertData));
    }

    // 2. WhatsApp
    if (contact.phone) {
      tasks.push(this.whatsAppService.sendEmergencyMessage(contact, alertData));
    }

    // 3. Push Notification (FCM)
    if (contact.fcmToken) {
      tasks.push(this.sendFirebaseNotification(contact, alertData));
    }

    // 4. APNs (futuro)
    if (contact.apnsToken) {
      tasks.push(this.sendAPNSNotification(contact, alertData));
    }

    const results = await Promise.allSettled(tasks);

    const failures = results
      .filter((r) => r.status === 'rejected')
      .map((r: PromiseRejectedResult) => r.reason?.message ?? r.reason);

    if (failures.length > 0) {
      this.logger.warn(
        `⚠️ ${failures.length} canal(es) fallaron para ${contact.name}: ${failures.join('; ')}`,
      );
    } else {
      this.logger.log(`✅ Todas las notificaciones enviadas a ${contact.name}`);
    }
  }

  /**
   * Fase 2: Envía notificaciones de que el video de la emergencia ya está listo.
   */
  async sendVideoReadyNotification(
    contact: NotificationContact,
    alertData: EmergencyAlertData,
  ): Promise<void> {
    this.logger.log(`📹 Notificando a ${contact.name} que el video de la alerta ${alertData.id} está listo...`);

    const tasks: Promise<void>[] = [];

    if (contact.email) {
      tasks.push(this.emailService.sendVideoReadyEmail(contact, alertData));
    }

    if (contact.phone) {
      tasks.push(this.whatsAppService.sendVideoReadyMessage(contact, alertData));
    }

    // Opcionalmente se podría enviar otro push (FCM) aquí,
    // pero usualmente email y WhatsApp bastan para la evidencia en diferido.

    const results = await Promise.allSettled(tasks);

    const failures = results
      .filter((r) => r.status === 'rejected')
      .map((r: PromiseRejectedResult) => r.reason?.message ?? r.reason);

    if (failures.length > 0) {
      this.logger.warn(`⚠️ ${failures.length} canal(es) fallaron al enviar video a ${contact.name}: ${failures.join('; ')}`);
    } else {
      this.logger.log(`✅ Notificaciones de video listo enviadas a ${contact.name}`);
    }
  }

  // ── Firebase Cloud Messaging ─────────────────────────────────────────────────

  private async sendFirebaseNotification(
    contact: NotificationContact,
    alertData: EmergencyAlertData,
  ): Promise<void> {
    try {
      const message: admin.messaging.TokenMessage = {
        token: contact.fcmToken,
        notification: {
          title: '🚨 ALERTA DE EMERGENCIA',
          body: `${alertData.user.name} ha activado el botón de pánico`,
        },
        data: {
          type: 'emergency_alert',
          alertId: alertData.id.toString(),
          userId: alertData.user.id.toString(),
          userName: alertData.user.name,
          description: alertData.description ?? '',
          videoUrl: alertData.videoUrl ?? '',
          audioUrl: alertData.audioUrl ?? '',
          location: alertData.location ?? '',
          latitude: alertData.latitude?.toString() ?? '',
          longitude: alertData.longitude?.toString() ?? '',
          duration: alertData.duration.toString(),
          timestamp: new Date(alertData.createdAt).toISOString(),
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'emergency_sound',
            channelId: 'emergency_alerts',
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'emergency_sound.wav',
              badge: 1,
              'content-available': 1,
            },
          },
        },
      };

      const result = await admin.messaging().send(message);
      this.logger.log(`✅ FCM enviado a ${contact.name} | ${result}`);
    } catch (error) {
      this.logger.error(`❌ FCM fallido para ${contact.name}: ${error.message}`);
    }
  }

  // ── APNs (futuro) ────────────────────────────────────────────────────────────

  private async sendAPNSNotification(
    contact: NotificationContact,
    _alertData: EmergencyAlertData,
  ): Promise<void> {
    // TODO: Implementar con el paquete `apn` cuando se requiera soporte iOS nativo
    this.logger.warn(`⚠️ APNs aún no implementado para ${contact.name}`);
  }

  // ── Estado de servicios ──────────────────────────────────────────────────────

  async checkNotificationServices(): Promise<{
    email: boolean;
    whatsapp: boolean;
    fcm: boolean;
    apns: boolean;
  }> {
    return {
      email: this.emailService.isAvailable(),
      whatsapp: this.whatsAppService.isAvailable(),
      fcm: admin.apps.length > 0,
      apns: !!this.configService.get('APNS_KEY_ID'),
    };
  }
}