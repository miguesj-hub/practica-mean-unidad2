import type { FieldError } from './api-response.js';

/**
 * Error de aplicación: excepción que el sistema sabe traducir a una
 * respuesta HTTP deliberada. Cualquier otra cosa que llegue al middleware
 * global es un fallo no previsto y se reporta como 500 genérico.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly errors: FieldError[] = []
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** 404: el recurso solicitado no existe. */
export class NotFoundError extends AppError {
  constructor(message = 'El recurso solicitado no existe') {
    super(404, 'NOT_FOUND', message);
  }
}

/** 400: la petición no superó el esquema declarativo del DTO. */
export class ValidationError extends AppError {
  constructor(errors: FieldError[]) {
    super(400, 'VALIDATION_ERROR', 'La petición no superó la validación de esquema', errors);
  }
}
