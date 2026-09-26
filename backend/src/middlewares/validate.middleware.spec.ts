import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { z } from 'zod';
import { toFieldErrors, validate } from './validate.middleware.js';
import { createEmployeeSchema, employeeIdParamSchema } from '../dtos/employee.dto.js';
import { ValidationError } from '../shared/app-error.js';

/**
 * Prueba unitaria del middleware de validación perimetral.
 *
 * Se invoca el middleware como una función pura con `req`, `res` y `next`
 * falsos: no se levanta Express ni se abre ningún puerto.
 */
describe('🧪 Unit Test: validate middleware (Validación perimetral)', () => {
  let next: jest.Mock<NextFunction>;
  const res = {} as Response;

  const cuerpoValido = {
    nombre: '  Andrés Mendoza  ',
    cargo: 'Arquitecto',
    departamento: 'TI',
    sueldo: 4000
  };

  beforeEach(() => {
    next = jest.fn<NextFunction>();
  });

  it('Debería llamar a next() sin error y normalizar el body cuando es válido', () => {
    const req = { body: cuerpoValido } as Request;

    validate({ body: createEmployeeSchema })(req, res, next);

    expect(next).toHaveBeenCalledWith();
    // El controlador recibe los datos ya parseados (con `trim` aplicado)
    expect(req.body.nombre).toBe('Andrés Mendoza');
  });

  it('Debería reemplazar req.params por los datos parseados', () => {
    const req = { params: { id: '  abc  ' } } as unknown as Request;

    validate({ params: employeeIdParamSchema })(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.params['id']).toBe('abc');
  });

  it('Debería pasar un ValidationError a next() cuando el body es inválido', () => {
    const req = { body: { ...cuerpoValido, sueldo: -1 } } as Request;

    validate({ body: createEmployeeSchema })(req, res, next);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).errors).toEqual([
      { campo: 'sueldo', mensaje: 'El sueldo debe ser mayor a 0' }
    ]);
  });

  it('Debería acumular los errores de params y body en una sola respuesta', () => {
    const req = {
      params: { id: '' },
      body: { ...cuerpoValido, nombre: 'Al' }
    } as unknown as Request;

    validate({ params: employeeIdParamSchema, body: createEmployeeSchema })(req, res, next);

    const error = next.mock.calls[0]?.[0] as ValidationError;
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.errors.map((e) => e.campo)).toEqual(['id', 'nombre']);
  });

  it('Debería llamar a next() cuando no se declaran esquemas', () => {
    validate({})({} as Request, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  describe('toFieldErrors', () => {
    it('Debería usar la ruta del issue como nombre de campo', () => {
      const result = z.object({ a: z.object({ b: z.string() }) }).safeParse({ a: { b: 1 } });

      expect(result.success).toBe(false);
      expect(toFieldErrors(result.error!, 'body')[0]?.campo).toBe('a.b');
    });

    it('Debería usar el scope cuando el issue no tiene ruta', () => {
      const result = z.string().safeParse(123);

      expect(result.success).toBe(false);
      expect(toFieldErrors(result.error!, 'body')[0]?.campo).toBe('body');
    });
  });
});
