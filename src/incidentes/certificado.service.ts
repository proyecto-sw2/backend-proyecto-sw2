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
import { IncidenteMapaEntity } from './entities/incidente.entity';

export interface CertificadoResultado {
  pdf: Buffer | null;
  url?: string;
  status: 'confirmado' | 'pendiente' | 'sin_registro';
  message?: string;
}

@Injectable()
export class CertificadoService {
  constructor(
    @InjectRepository(IncidenteMapaEntity)
    private readonly incidenteRepo: Repository<IncidenteMapaEntity>,
  ) {}

  async generarCertificadoReporte(id: number): Promise<CertificadoResultado> {
    const incidente = await this.incidenteRepo.findOne({
      where: { id_incidente: id },
      relations: ['usuario'],
    });

    if (!incidente) {
      throw new NotFoundException('Incidente no encontrado');
    }

    if (incidente.blockchain_status === 'pendiente') {
      return {
        pdf: null,
        status: 'pendiente',
        message:
          'La transacción blockchain aún está siendo procesada. El certificado estará disponible una vez confirmada en Sepolia.',
      };
    }

    if (incidente.blockchain_status !== 'confirmado') {
      throw new BadRequestException(
        'Este incidente no tiene un registro confirmado en blockchain. Solo se pueden generar certificados para incidentes con estado "confirmado".',
      );
    }

    if (incidente.certificado_url) {
      return { pdf: null, url: incidente.certificado_url, status: 'confirmado' };
    }

    const etherscanUrl = `https://sepolia.etherscan.io/tx/${incidente.tx_hash}`;
    const qrBuffer = await QRCode.toBuffer(etherscanUrl, {
      width: 160,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    const pdf = await this.construirPdf(incidente, etherscanUrl, qrBuffer);
    return { pdf, status: 'confirmado' };
  }

  private construirPdf(
    incidente: IncidenteMapaEntity,
    etherscanUrl: string,
    qrBuffer: Buffer,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PRIMARY = '#1a237e';
      const GRAY = '#546e7a';
      const GREEN = '#2e7d32';
      const pageWidth = 495;

      // ── Encabezado ──────────────────────────────────────────────────────────
      doc.rect(50, 45, pageWidth, 70).fill(PRIMARY);
      doc
        .fill('white')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('CERTIFICADO DE REPORTE DE INCIDENTE', 60, 60, {
          width: pageWidth - 20,
          align: 'center',
        });
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Registro Inmutable en Blockchain — Sepolia Testnet', 60, 85, {
          width: pageWidth - 20,
          align: 'center',
        });

      doc.fill('black');
      let y = 135;

      // ── Datos del reporte ────────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('DATOS DEL REPORTE', 50, y);
      y += 18;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke(GRAY);
      y += 10;

      const filas: [string, string][] = [
        ['ID de Reporte', `#${incidente.id_incidente}`],
        ['Tipo de Incidente', incidente.tipo_incidente.toUpperCase()],
        ['Descripción', incidente.descripcion],
        ['Coordenadas GPS', incidente.latitud_longitud],
        [
          'Fecha y Hora',
          new Date(incidente.fecha_incidente).toLocaleString('es-BO', {
            timeZone: 'America/La_Paz',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
        ],
        ['Reportado por', incidente.usuario?.name ?? 'Usuario anónimo'],
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

      // ── Datos blockchain ─────────────────────────────────────────────────────
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(PRIMARY)
        .text('REGISTRO BLOCKCHAIN', 50, y);
      y += 18;
      doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).stroke(GRAY);
      y += 10;

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(GRAY)
        .text('Hash SHA-256:', 55, y);
      y += 13;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('black')
        .text(incidente.doc_hash ?? '', 55, y, { width: pageWidth - 10 });
      y = doc.y + 8;

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(GRAY)
        .text('Transaction Hash (txHash):', 55, y);
      y += 13;
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('black')
        .text(incidente.tx_hash ?? '', 55, y, { width: pageWidth - 10 });
      y = doc.y + 8;

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(GRAY)
        .text('Red: ', 55, y, { continued: true });
      doc.font('Helvetica').fontSize(9).fillColor('black').text('Ethereum Sepolia Testnet');
      y = doc.y + 4;

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(GRAY)
        .text('Estado: ', 55, y, { continued: true });
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(GREEN)
        .text('CONFIRMADO EN BLOCKCHAIN');
      y = doc.y + 14;

      // ── QR y verificación ────────────────────────────────────────────────────
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
          'Escanea el código QR para verificar este reporte directamente en Etherscan Sepolia:',
          55,
          y,
          { width: 290 },
        );

      doc.image(qrBuffer, 370, y - 5, { width: 160, height: 160 });

      y += 20;
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(PRIMARY)
        .text(etherscanUrl, 55, y, {
          width: 290,
          link: etherscanUrl,
          underline: true,
        });

      // ── Pie de página ────────────────────────────────────────────────────────
      const footerY = 770;
      doc.moveTo(50, footerY).lineTo(545, footerY).lineWidth(0.5).stroke(GRAY);
      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor(GRAY)
        .text(
          'Certificado generado automáticamente por el Sistema de Gestión de Tránsito. ' +
            'El hash SHA-256 del reporte garantiza la integridad e inmutabilidad de los datos registrados en la blockchain.',
          50,
          footerY + 6,
          { width: pageWidth, align: 'center' },
        );
      doc
        .text(
          `Generado el ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}`,
          50,
          footerY + 18,
          { width: pageWidth, align: 'center' },
        );

      doc.end();
    });
  }
}
