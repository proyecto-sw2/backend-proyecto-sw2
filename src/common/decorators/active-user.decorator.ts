import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const ActiveUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    console.log('Usuario autenticado:', request.user);
    
    // Mapear los campos correctamente
    return {
      id: request.user.id || request.user.userId, // userId -> id
      email: request.user.email,
      role: request.user.roles || 'user', // roles -> role
      name: request.user.name || 'Usuario'
    };
  }
)