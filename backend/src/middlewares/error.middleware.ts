import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { fail } from '../shared/api-response.js';
import { AppError } from '../shared/app-error.js';
import { toFieldErrors } from './validate.middleware.js';

/** Ruta no registrada: también responde con la envoltura unificada. */
export const notFoundHandler = (req: Request, res: Response): void => {
  res
    .status(404)
    .json(fail('ROUTE_NOT_FOUND', `No existe la ruta ${req.method} ${req.originalUrl}`));
};

/**
 * Interceptor global de errores.
 *
 * Único punto de salida para cualquier excepción del sistema. Express 5
 * reenvía aquí también los rechazos de los handlers asíncronos, así que no
 * hace falta un try/catch por controlador.
 *
 * Contrato de seguridad: el stack trace y el mensaje original de una
 * excepción imprevista se registran en el servidor, jamás se envían al
 * cliente. Hacia afuera sólo viaja un 500 genérico.
 *
 * La firma de cuatro parámetros es obligatoria: así es como Express
 * distingue un manejador de errores de un middleware común.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(fail(err.code, err.message, err.errors));
    return;
  }

  // Red de seguridad: un ZodError que se haya lanzado fuera del middleware
  // de validación sigue siendo un fallo de contrato, no del servidor.
  if (err instanceof ZodError) {
    res
      .status(400)
      .json(
        fail(
          'VALIDATION_ERROR',
          'La petición no superó la validación de esquema',
          toFieldErrors(err, 'body')
        )
      );
    return;
  }

  // `express.json()` lanza un SyntaxError cuando el cuerpo no es JSON
  // parseable. El fallo es del cliente, no del servidor: merece un 400 y no
  // el 500 genérico. Su mensaje describe la sintaxis, no el sistema, así
  // que es seguro exponerlo.
  if (err instanceof SyntaxError && 'body' in err) {
    res
      .status(400)
      .json(
        fail('MALFORMED_JSON', 'El cuerpo de la petición no es un JSON válido', [
          { campo: 'body', mensaje: err.message }
        ])
      );
    return;
  }

  console.error('❌ [Error no controlado]:', err);
  res
    .status(500)
    .json(fail('INTERNAL_ERROR', 'Ocurrió un error inesperado en el servidor'));
};
