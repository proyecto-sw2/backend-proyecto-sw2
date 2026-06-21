export class IncidenteResponseDto {
  id_incidente: number;
  tipo_incidente: string;
  descripcion: string;
  latitud_longitud: string;
  fecha_incidente: Date;
  usuario: {
    id: number;
    name: string;
    email: string;
  };
  total_publicaciones?: number;
  publicaciones?: any[];
  doc_hash?: string;
  tx_hash?: string;
  blockchain_status?: string;
}