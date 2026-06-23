import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateIncidenteDto {
  @ApiProperty({
    description: 'Tipo de incidente',
    example: 'Accidente de tráfico',
    examples: [
      'Accidente de tráfico',
      'Bloqueo de vía',
      'Manifestación',
      'Obra en construcción',
      'Semáforo dañado',
      'Bache en la vía',
      'Inundación',
      'Robo',
      'Disturbios',
      'Otro'
    ]
  })
  @IsString()
  @IsNotEmpty({ message: 'El tipo de incidente es requerido' })
  @MaxLength(100, { message: 'El tipo de incidente no puede exceder 100 caracteres' })
  tipo_incidente: string;

  @ApiProperty({
    description: 'Descripción detallada del incidente',
    example: 'Colisión entre dos vehículos en la intersección. Tráfico completamente bloqueado hacia el sur.',
    maxLength: 500
  })
  @IsString()
  @IsNotEmpty({ message: 'La descripción del incidente es requerida' })
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres' })
  descripcion: string;

  @ApiProperty({
    description: 'Coordenadas geográficas en formato "latitud,longitud"',
    example: '-16.5000,-68.1193',
    pattern: '^-?[0-9]+\\.?[0-9]*,-?[0-9]+\\.?[0-9]*$'
  })
  @IsString()
  @IsNotEmpty({ message: 'Las coordenadas son requeridas' })
  @Matches(/^-?[0-9]+\.?[0-9]*,-?[0-9]+\.?[0-9]*$/, {
    message: 'Las coordenadas deben estar en formato "latitud,longitud" (ej: -16.5000,-68.1193)'
  })
  latitud_longitud: string;
}
