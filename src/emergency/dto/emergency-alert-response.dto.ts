import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertStatus, AlertType } from '../entities/emergency-alert.entity';

export class EmergencyAlertResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: AlertType })
  type: AlertType;

  @ApiProperty({ enum: AlertStatus })
  status: AlertStatus;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  latitude?: number;

  @ApiPropertyOptional()
  longitude?: number;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  videoUrl?: string;

  @ApiPropertyOptional()
  audioUrl?: string;

  @ApiProperty()
  duration: number;

  @ApiPropertyOptional()
  doc_hash?: string;

  @ApiPropertyOptional()
  tx_hash?: string;

  @ApiProperty()
  blockchain_status: string;

  @ApiPropertyOptional()
  certificado_url?: string;

  @ApiPropertyOptional()
  metadata?: any;

  @ApiPropertyOptional()
  resolvedAt?: Date;

  @ApiPropertyOptional()
  resolutionNotes?: string;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
} 