import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';

export enum AlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  FALSE_ALARM = 'false_alarm',
}

export enum AlertType {
  PANIC_BUTTON = 'panic_button',
  AUTOMATIC_DETECTION = 'automatic_detection',
  MANUAL_TRIGGER = 'manual_trigger',
}

@Entity('emergency_alerts')
export class EmergencyAlert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: AlertType,
    default: AlertType.PANIC_BUTTON,
  })
  type: AlertType;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string; // Dirección aproximada

  @Column({ type: 'varchar', length: 255, nullable: true })
  videoUrl: string; // URL del video en S3

  @Column({ type: 'varchar', length: 255, nullable: true })
  audioUrl: string; // URL del audio en S3

  @Column({ type: 'int', default: 0 })
  duration: number; // Duración del video/audio en segundos

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // Información adicional como acelerómetro, etc.

  @Column({ type: 'varchar', length: 64, nullable: true })
  doc_hash: string; // SHA-256 de los metadatos de la evidencia

  @Column({ type: 'varchar', length: 66, nullable: true })
  tx_hash: string; // Hash de la transacción en Sepolia (0x…)

  @Column({ type: 'varchar', length: 20, default: 'sin_registro', nullable: true })
  blockchain_status: string; // 'sin_registro' | 'pendiente' | 'confirmado' | 'fallido'

  @Column({ type: 'varchar', length: 255, nullable: true })
  certificado_url: string; // URL del PDF en S3

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @ManyToOne(() => User, (user) => user.emergencyAlerts, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
} 