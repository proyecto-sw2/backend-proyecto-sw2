import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit') as typeof import('pdfkit');
import * as QRCode from 'qrcode';
import { EmergencyAlert } from './entities/emergency-alert.entity';

export interface CertificadoResultado {
  pdf: Buffer | null;
  url?: string;
  status: 'confirmado' | 'pendiente' | 'sin_registro';
  message?: string;
}

@Injectable()
export class CertificadoEmergenciaService {
  constructor(
    @InjectRepository(EmergencyAlert)
    private readonly emergencyRepo: Repository<EmergencyAlert>,
  ) {}

  async generarCertificadoEmergencia(id: number): Promise<CertificadoResultado> {
    const emergencia = await this.emergencyRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!emergencia) {
      throw new NotFoundException('Emergencia no encontrada');
    }

    if (emergencia.blockchain_status === 'pendiente') {
      return {
        pdf: null,
        status: 'pendiente',
        message: 'La transacción blockchain aún está siendo procesada. El certificado estará disponible una vez confirmada en Sepolia.',
      };
    }

    if (emergencia.blockchain_status !== 'confirmado') {
      throw new BadRequestException(
        'Esta emergencia no tiene un registro confirmado en blockchain. Solo se pueden generar certificados para emergencias con estado "confirmado".',
      );
    }

    if (emergencia.certificado_url) {
      return { pdf: null, url: emergencia.certificado_url, status: 'confirmado' };
    }

    const etherscanUrl = `https://sepolia.etherscan.io/tx/${emergencia.tx_hash}`;
    const qrBuffer = await QRCode.toBuffer(etherscanUrl, {
      width: 160,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    const pdf = await this.construirPdf(emergencia, etherscanUrl, qrBuffer);
    return { pdf, status: 'confirmado' };
  }

  private construirPdf(
    emergencia: EmergencyAlert,
    etherscanUrl: string,
    qrBuffer: Buffer,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PRIMARY = '#b71c1c'; // Rojo oscuro para emergencia
      const GRAY = '#546e7a';
      const GREEN = '#2e7d32';
      const pageWidth = 495;

      doc.rect(50, 45, pageWidth, 70).fill(PRIMARY);
      doc
        .fill('white')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('CERTIFICADO DIGITAL DE EVIDENCIA DE EMERGENCIA', 60, 60, {
          width: pageWidth - 20,
          align: 'center',
        });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Registro Inmutable en Blockchain – Sepolia Testnet', 60, 85, {
          width: pageWidth - 20,
          align: 'center',
        });

      doc.fill('black');
      let y = 135;

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('DATOS DE LA EMERGENCIA', 50, y);
      y += 18;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke(GRAY);
      y += 10;

      const filas: [string, string][] = [
        ['ID de Alerta', `#${emergencia.id}`],
        ['Tipo de Alerta', emergencia.type.toUpperCase()],
        ['Coordenadas GPS', `${emergencia.latitude ?? 'Desconocido'}, ${emergencia.longitude ?? 'Desconocido'}`],
        [
          'Fecha y Hora (Activación)',
          new Date(emergencia.createdAt).toLocaleString('es-BO', {
            timeZone: 'America/La_Paz',
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          }),
        ],
        ['Duración de Grabación', `${emergencia.duration} segundos`],
        ['Usuario Afectado', emergencia.user?.name ?? 'Usuario anónimo'],
      ];

      for (const [label, valor] of filas) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(GRAY)
          .text(label + ':', 55, y, { continued: true });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('black')
          .text('  ' + valor, { lineBreak: true });
        y = doc.y + 4;
      }

      y += 10;

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('REGISTRO BLOCKCHAIN', 50, y);
      y += 18;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke(GRAY);
      y += 10;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('Hash de Archivo de Evidencia (SHA-256):', 55, y);
      y += 13;
      doc.font('Helvetica').fontSize(8).fillColor('black').text(emergencia.doc_hash ?? 'Sin evidencia', 55, y, { width: pageWidth - 10 });
      y = doc.y + 8;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('Transaction Hash (txHash):', 55, y);
      y += 13;
      doc.font('Helvetica').fontSize(8).fillColor('black').text(emergencia.tx_hash ?? '', 55, y, { width: pageWidth - 10 });
      y = doc.y + 8;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('Enlace de Evidencia Multimedia:', 55, y);
      y += 13;
      if (emergencia.videoUrl) {
        doc.font('Helvetica').fontSize(8).fillColor('blue').text(emergencia.videoUrl, 55, y, { width: pageWidth - 10, link: emergencia.videoUrl, underline: true });
      } else {
        doc.font('Helvetica').fontSize(8).fillColor('black').text('Sin evidencia grabada', 55, y, { width: pageWidth - 10 });
      }
      y = doc.y + 8;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('Red: ', 55, y, { continued: true });
      doc.font('Helvetica').fontSize(9).fillColor('black').text('Ethereum Sepolia Testnet');
      y = doc.y + 4;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(GRAY).text('Estado: ', 55, y, { continued: true });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN).text('CONFIRMADO EN BLOCKCHAIN');
      y = doc.y + 14;

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('VERIFICACIÓN PÚBLICA', 50, y);
      y += 18;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke(GRAY);
      y += 10;

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('black')
        .text(
          'Escanea el código QR para verificar la inmutabilidad de esta alerta de emergencia directamente en Etherscan Sepolia:',
          55, y, { width: 290 },
        );

      doc.image(qrBuffer, 370, y - 5, { width: 160, height: 160 });

      y += 30;
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(PRIMARY)
        .text(etherscanUrl, 55, y, { width: 290, link: etherscanUrl, underline: true });

      const footerY = 770;
      doc.moveTo(50, footerY).lineTo(545, footerY).lineWidth(0.5).stroke(GRAY);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(GRAY)
        .text(
          'Certificado generado automáticamente por el Sistema de Emergencias. ' +
            'El hash SHA-256 garantiza la integridad e inmutabilidad de la evidencia registrada en la blockchain.',
          50, footerY + 10, { align: 'center', width: pageWidth }
        );

      doc.end();
    });
  }
}