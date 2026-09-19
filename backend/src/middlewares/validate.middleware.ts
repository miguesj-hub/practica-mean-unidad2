import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import type { FieldError } from '../shared/api-response.js';
import { ValidationError } from '../shared/app-error.js';

/** Traduce los issues de Zod al formato de error de campo del contrato. */
export const toFieldErrors = (error: ZodError, scope: string): FieldError[] =>
  error.issues.map((issue) => ({
    campo: issue.path.length > 0 ? issue.path.join('.') : scope,
    mensaje: issue.message
  }));

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
}

/**
 * Validación perimetral.
 *
 * Se monta ANTES del controlador: si la petición no satisface el esquema,
 * el controlador nunca se ejecuta y el repositorio nunca se toca. Los
 * errores de `params` y `body` se acumulan para reportarlos todos juntos
 * en una sola respuesta, en vez de obligar al cliente a descubrirlos de
 * uno en uno.
 *
 * Los datos ya parseados reemplazan a los crudos, de modo que el
 * controlador trabaja con valores normalizados (por ejemplo, con `trim`
 * aplicado) y tipados.
 */
export const validate =
  (schemas: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const errors: FieldError[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) {
        req.params = result.data as Request['params'];
      } else {
        errors.push(...toFieldErrors(result.error, 'params'));
      }
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) {
        req.body = result.data;
      } else {
        errors.push(...toFieldErrors(result.error, 'body'));
      }
    }

    if (errors.length > 0) {
      next(new ValidationError(errors));
      return;
    }

    next();
  };
