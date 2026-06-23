
import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AwsS3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
  }

  /**
   * Subir archivo a S3
   */
  async uploadFile(file: Express.Multer.File, folder: string = 'uploads'): Promise<string> {
    try {
      // Validar tipo de archivo
      this.validateFile(file);

      // Generar nombre único
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      // Retornar URL pública del archivo
      return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('Error subiendo archivo a S3:', error);
      throw new BadRequestException('Error al subir archivo');
    }
  }

  /**
   * Subir buffer a S3
   */
  async uploadBuffer(buffer: Buffer, mimetype: string, extension: string, folder: string = 'uploads'): Promise<string> {
    try {
      const fileName = `${folder}/${uuidv4()}.${extension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: buffer,
        ContentType: mimetype,
      });

      await this.s3Client.send(command);

      return `https://${this.bucketName}.s3.${this.configService.get('AWS_REGION')}.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('Error subiendo buffer a S3:', error);
      throw new BadRequestException('Error al subir archivo');
    }
  }

  /**
   * Subir múltiples archivos
   */
  async uploadMultipleFiles(files: Express.Multer.File[], folder: string = 'uploads'): Promise<string[]> {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  /**
   * Eliminar archivo de S3
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extraer el key del URL
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1); // Remover el primer '/'

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error eliminando archivo de S3:', error);
      throw new BadRequestException('Error al eliminar archivo');
    }
  }

  /**
   * Generar URL firmada para acceso temporal
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Error generando URL firmada:', error);
      throw new BadRequestException('Error al generar URL de acceso');
    }
  }

  /**
   * Validar archivo
   */
  private validateFile(file: Express.Multer.File): void {
    // Tipos de archivo permitidos
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'application/pdf'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido. Tipos válidos: ${allowedMimeTypes.join(', ')}`
      );
    }

    // Tamaño máximo: 10MB para imágenes, 50MB para videos
    const maxSize = file.mimetype.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      throw new BadRequestException(`Archivo muy grande. Tamaño máximo: ${maxSizeMB}MB`);
    }
  }
}