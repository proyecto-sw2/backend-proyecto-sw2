import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { NotificationContact, EmergencyAlertData } from './emergency-notification.service';

@Injectable()
export class WhatsAppNotificationService {
  private readonly logger = new Logger(WhatsAppNotificationService.name);
  private readonly client: AxiosInstance | null = null;
  private readonly channelId: string;

  constructor(private readonly configService: ConfigService) {
    const baseUrl = this.configService.get<string>('WHAPI_BASE_URL');
    const token = this.configService.get<string>('WHAPI_TOKEN');
    this.channelId = this.configService.get<string>('WHAPI_CHANNEL_ID') || 'default';

    if (!baseUrl || !token) {
      this.logger.warn('⚠️ WHAPI no configurado. WhatsApp desactivado.');
      return;
    }

    (this.client as any) = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });

    this.logger.log(`✅ WhatsApp (WHAPI) listo → ${baseUrl}`);
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  // ── Fase 1: Alerta inmediata sin video ───────────────────────────────────────

  async sendEmergencyMessage(
    contact: NotificationContact,
    alertData: EmergencyAlertData,
  ): Promise<void> {
    const message = this.buildPhase1Message(alertData);
    await this.sendText(contact, message);
  }

  // ── Fase 2: Evidencia lista (video ya subido a S3) ───────────────────────────

  async sendVideoReadyMessage(
    contact: NotificationContact,
    alertData: EmergencyAlertData,
  ): Promise<void> {
    if (!alertData.videoUrl) return;
    const message = this.buildPhase2Message(alertData);
    await this.sendText(contact, message);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async sendText(contact: NotificationContact, message: string): Promise<void> {
    if (!this.client) {
      this.logger.warn(`⚠️ WHAPI no configurado. WhatsApp NO enviado a ${contact.name}`);
      return;
    }

    const phone = this.normalizePhone(contact.phone);
    if (!phone) {
      this.logger.warn(`⚠️ Número inválido para WhatsApp: "${contact.phone}"`);
      return;
    }

    const to = `${phone}@s.whatsapp.net`;

    try {
      const response = await this.client.post('/messages/text', {
        to,
        body: message,
        ...(this.channelId !== 'default' ? { channel_id: this.channelId } : {}),
      });

      this.logger.log(
        `✅ WhatsApp enviado a ${contact.name} (${phone}) | id: ${response.data?.id ?? 'n/a'}`,
      );
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(
        `❌ Error WhatsApp a ${contact.name} (${phone}) [${status ?? 'sin respuesta'}]: ${detail}`,
      );
    }
  }

  private buildPhase1Message(alertData: EmergencyAlertData): string {
    const mapsUrl =
      alertData.latitude != null && alertData.longitude != null
        ? `https://www.google.com/maps?q=${alertData.latitude},${alertData.longitude}`
        : null;

    const isOfflineSync = !!(alertData.metadata as any)?.offlineSync;

    const lines: string[] = [
      '🚨 *ALERTA DE EMERGENCIA* 🚨',
      '',
      `*${alertData.user.name}* ha activado el botón de pánico.`,
    ];

    if (alertData.location) {
      lines.push(`📍 *Última ubicación:* ${alertData.location}`);
    }

    if (mapsUrl) {
      lines.push(`🗺️ *Ver en mapa:* ${mapsUrl}`);
    }

    lines.push(
      '',
      '📹 *Evidencia:* La grabación de video está en curso.',
      '  Recibirás el enlace al video cuando termine la grabación.',
    );

    lines.push(
      '',
      `🕐 *Hora:* ${new Date(alertData.createdAt).toLocaleString('es-BO', {
        timeZone: 'America/La_Paz',
      })}`,
    );

    if (isOfflineSync) {
      lines.push('', '⚠️ _Alerta generada sin internet y sincronizada automáticamente._');
    }

    lines.push('', '‼️ *Responda inmediatamente.*');

    return lines.join('\n');
  }

  private buildPhase2Message(alertData: EmergencyAlertData): string {
    const lines: string[] = [
      '🎥 *EVIDENCIA DE EMERGENCIA DISPONIBLE*',
      '',
      `La grabación de la emergencia de *${alertData.user.name}* ya está lista.`,
      '',
      `▶️ *Ver video:* ${alertData.videoUrl}`,
    ];

    if (alertData.location) {
      lines.push(`📍 *Ubicación registrada:* ${alertData.location}`);
    }

    lines.push(
      '',
      `🕐 *Hora de la emergencia:* ${new Date(alertData.createdAt).toLocaleString('es-BO', {
        timeZone: 'America/La_Paz',
      })}`,
    );

    return lines.join('\n');
  }

  private normalizePhone(raw: string): string | null {
    if (!raw) return null;

    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;

    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }

    if (digits.startsWith('591') && digits.length >= 11) {
      return digits;
    }

    if (digits.length === 8) {
      return `591${digits}`;
    }

    if (digits.length >= 10) {
      return digits;
    }

    return null;
  }
}
