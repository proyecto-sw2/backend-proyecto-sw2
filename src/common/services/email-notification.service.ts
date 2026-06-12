import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { NotificationContact, EmergencyAlertData } from './emergency-notification.service';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('smtp.host');
    const port = this.configService.get<number>('smtp.port') || 587;
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');

    if (!host || !user || !pass) {
      this.logger.warn('⚠️ Credenciales SMTP no configuradas. Email desactivado.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // TLS en puerto 587
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    this.logger.log(`✅ Transporter SMTP listo: ${host}:${port} (${user})`);
  }

  isAvailable(): boolean {
    return this.transporter !== null;
  }

  // ── Fase 1: Alerta inmediata sin video ───────────────────────────────────────

  async sendEmergencyEmail(
    contact: NotificationContact,
    alertData: EmergencyAlertData,
  ): Promise<void> {
    if (!this.transporter || !contact.email) return;

    const fromUser = this.configService.get<string>('smtp.user');
    const mapsUrl = this.buildGoogleMapsUrl(alertData.latitude, alertData.longitude);
    const timestamp = new Date(alertData.createdAt).toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const htmlBody = this.buildPhase1Html({
      userName: alertData.user.name,
      contactName: contact.name,
      location: alertData.location,
      mapsUrl,
      description: alertData.description,
      timestamp,
      isOfflineSync: !!(alertData.metadata as any)?.offlineSync,
    });

    try {
      const info = await this.transporter.sendMail({
        from: `"🚨 Sistema de Emergencia" <${fromUser}>`,
        to: contact.email,
        subject: `🚨 EMERGENCIA: ${alertData.user.name} necesita ayuda`,
        html: htmlBody,
        text: this.buildPhase1Text(alertData, mapsUrl),
      });

      this.logger.log(`✅ Email (Fase 1) enviado a ${contact.email} | MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`❌ Error enviando email a ${contact.email}: ${error.message}`);
    }
  }

  // ── Fase 2: Evidencia lista (video ya subido a S3) ───────────────────────────

  async sendVideoReadyEmail(
    contact: NotificationContact,
    alertData: EmergencyAlertData,
  ): Promise<void> {
    if (!this.transporter || !contact.email || !alertData.videoUrl) return;

    const fromUser = this.configService.get<string>('smtp.user');
    const timestamp = new Date(alertData.createdAt).toLocaleString('es-BO', {
      timeZone: 'America/La_Paz',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    const htmlBody = this.buildPhase2Html({
      userName: alertData.user.name,
      contactName: contact.name,
      videoUrl: alertData.videoUrl,
      timestamp,
    });

    try {
      const info = await this.transporter.sendMail({
        from: `"🚨 Sistema de Emergencia" <${fromUser}>`,
        to: contact.email,
        subject: `🎥 EVIDENCIA: Grabación de la emergencia de ${alertData.user.name}`,
        html: htmlBody,
        text: `La evidencia de la emergencia de ${alertData.user.name} ya está disponible. Ver video: ${alertData.videoUrl}`,
      });

      this.logger.log(`✅ Email (Fase 2) enviado a ${contact.email} | MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`❌ Error enviando email a ${contact.email}: ${error.message}`);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private buildGoogleMapsUrl(lat?: number, lng?: number): string {
    if (lat != null && lng != null) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    return '';
  }

  private buildPhase1Text(alertData: EmergencyAlertData, mapsUrl: string): string {
    return [
      '🚨 ALERTA DE EMERGENCIA 🚨',
      '',
      `${alertData.user.name} ha activado el botón de pánico.`,
      '',
      alertData.description ? `Descripción: ${alertData.description}` : '',
      alertData.location ? `Ubicación: ${alertData.location}` : '',
      mapsUrl ? `Ver en mapa: ${mapsUrl}` : '',
      '',
      '📹 Evidencia: La grabación de video está en curso. Recibirás el enlace al video cuando termine la grabación.',
      '',
      `Hora: ${new Date(alertData.createdAt).toLocaleString()}`,
      '',
      'Responda inmediatamente.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildPhase1Html(params: {
    userName: string;
    contactName: string;
    location?: string;
    mapsUrl: string;
    description?: string;
    timestamp: string;
    isOfflineSync: boolean;
  }): string {
    const { userName, contactName, location, mapsUrl, description, timestamp, isOfflineSync } = params;

    const offlineBanner = isOfflineSync
      ? `<div style="background:#f59e0b;color:#fff;padding:10px 20px;border-radius:6px;margin-bottom:16px;font-size:13px;">
          ⚠️ Esta alerta fue generada sin conexión y sincronizada al recuperar internet.
        </div>`
      : '';

    const mapButton = mapsUrl
      ? `<a href="${mapsUrl}" style="display:inline-block;background:#4285F4;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 4px;">
          📍 Ver ubicación en Google Maps
        </a>`
      : '';

    const descriptionBlock = description
      ? `<div style="background:#fef3f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
          <strong>📝 Descripción:</strong> ${description}
        </div>`
      : '';

    const locationBlock = location
      ? `<p style="margin:8px 0;"><strong>📍 Última ubicación conocida:</strong> ${location}</p>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <tr>
            <td style="background:#dc2626;padding:28px 32px;text-align:center;">
              <div style="font-size:48px;">🚨</div>
              <h1 style="color:#ffffff;margin:8px 0 4px;font-size:26px;letter-spacing:-0.5px;">ALERTA DE EMERGENCIA</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              ${offlineBanner}
              <p style="font-size:16px;color:#374151;margin-top:0;">Hola <strong>${contactName}</strong>,</p>
              <div style="background:#fef2f2;border:2px solid #dc2626;border-radius:10px;padding:20px;margin:16px 0;">
                <p style="margin:0;font-size:18px;color:#dc2626;font-weight:bold;">
                  ⚠️ ${userName} ha activado el botón de pánico
                </p>
              </div>
              
              <div style="background:#f3f4f6;border-left:4px solid #4b5563;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;">
                <strong>📹 Evidencia en curso:</strong> El dispositivo está grabando video en este momento. Recibirás un segundo correo con el enlace de la grabación al finalizar.
              </div>

              ${descriptionBlock}
              ${locationBlock}
              <p style="margin:8px 0;color:#6b7280;font-size:14px;">🕐 <strong>Hora de la alerta:</strong> ${timestamp}</p>
              <div style="margin:24px 0;text-align:center;">${mapButton}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private buildPhase2Html(params: {
    userName: string;
    contactName: string;
    videoUrl: string;
    timestamp: string;
  }): string {
    const { userName, contactName, videoUrl, timestamp } = params;

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <tr>
            <td style="background:#2563eb;padding:28px 32px;text-align:center;">
              <div style="font-size:48px;">🎥</div>
              <h1 style="color:#ffffff;margin:8px 0 4px;font-size:26px;letter-spacing:-0.5px;">EVIDENCIA DISPONIBLE</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="font-size:16px;color:#374151;margin-top:0;">Hola <strong>${contactName}</strong>,</p>
              <p style="font-size:16px;color:#374151;">
                La grabación de la emergencia reportada por <strong>${userName}</strong> ya se ha subido y está lista para ser visualizada.
              </p>
              
              <div style="margin:24px 0;text-align:center;">
                <a href="${videoUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 4px;">
                  ▶️ Ver video de emergencia
                </a>
              </div>

              <p style="margin:8px 0;color:#6b7280;font-size:14px;">🕐 <strong>Hora original de la alerta:</strong> ${timestamp}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }
}
