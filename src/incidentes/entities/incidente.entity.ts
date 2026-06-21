// src/incidentes/entities/incidente.entity.ts
import { PublicacionEntity } from 'src/publicaciones/entities/publicacion.entity';
import { User } from 'src/users/entities/user.entity';

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('incidentes_mapa')
export class IncidenteMapaEntity {
  @PrimaryGeneratedColumn()
  id_incidente: number;

  @ManyToOne(() => User, (user) => user.incidentes)
  usuario: User;

  @Column({ type: 'varchar', length: 100 })
  tipo_incidente: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 100 })
  latitud_longitud: string; // "lat,lng" ejemplo: "-16.5000,-68.1193"

  @CreateDateColumn()
  fecha_incidente: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  doc_hash: string; // SHA-256 del contenido del incidente

  @Column({ type: 'varchar', length: 66, nullable: true })
  tx_hash: string; // Hash de la transacción en Sepolia (0x…)

  @Column({ type: 'varchar', length: 20, default: 'sin_registro', nullable: true })
  blockchain_status: string; // 'sin_registro' | 'pendiente' | 'confirmado' | 'fallido'

  // Relación con publicaciones (un incidente puede tener múltiples publicaciones)
  @OneToMany(() => PublicacionEntity, (publicacion) => publicacion.incidente)
  publicaciones: PublicacionEntity[];
}