import { describe, expect, it } from '@jest/globals';
import {
  createEmployeeSchema,
  employeeIdParamSchema,
  updateEmployeeSchema
} from './employee.dto.js';

/**
 * Prueba unitaria de los contratos de entrada (DTOs).
 *
 * Las reglas de negocio viven en los esquemas de Zod: se prueban
 * directamente, sin HTTP de por medio.
 */
describe('🧪 Unit Test: Employee DTOs (Reglas de negocio)', () => {
  const valido = {
    nombre: 'Andrés Mendoza',
    cargo: 'Arquitecto',
    departamento: 'TI',
    sueldo: 4000
  };

  describe('createEmployeeSchema', () => {
    it('Debería aceptar un empleado válido y aplicar trim', () => {
      const result = createEmployeeSchema.safeParse({ ...valido, cargo: '  Arquitecto  ' });

      expect(result.success).toBe(true);
      expect(result.data?.cargo).toBe('Arquitecto');
    });

    it.each([
      ['nombre corto', { nombre: 'Al' }, 'El nombre debe tener al menos 3 caracteres'],
      ['nombre largo', { nombre: 'a'.repeat(81) }, 'El nombre no puede exceder 80 caracteres'],
      ['cargo corto', { cargo: 'TI' }, 'El cargo debe tener al menos 3 caracteres'],
      ['departamento corto', { departamento: 'T' }, 'El departamento debe tener al menos 2 caracteres'],
      ['sueldo cero', { sueldo: 0 }, 'El sueldo debe ser mayor a 0'],
      ['sueldo excesivo', { sueldo: 1_000_001 }, 'El sueldo excede el máximo permitido'],
      ['sueldo como texto', { sueldo: '4000' }, 'El sueldo es obligatorio y debe ser numérico']
    ])('Debería rechazar %s', (_caso, cambio, mensaje) => {
      const result = createEmployeeSchema.safeParse({ ...valido, ...cambio });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(mensaje);
    });

    it('Debería rechazar campos faltantes', () => {
      const { nombre, ...sinNombre } = valido;
      const result = createEmployeeSchema.safeParse(sinNombre);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('El nombre es obligatorio y debe ser texto');
    });

    it('Debería rechazar claves desconocidas (strictObject)', () => {
      const result = createEmployeeSchema.safeParse({ ...valido, rol: 'admin' });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.code).toBe('unrecognized_keys');
    });
  });

  describe('updateEmployeeSchema', () => {
    it('Debería aceptar una actualización parcial', () => {
      expect(updateEmployeeSchema.safeParse({ sueldo: 5000 }).success).toBe(true);
    });

    it('Debería rechazar un cuerpo vacío', () => {
      const result = updateEmployeeSchema.safeParse({});

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'Debe enviar al menos un campo para actualizar'
      );
    });

    it('Debería seguir aplicando las reglas de cada campo', () => {
      expect(updateEmployeeSchema.safeParse({ sueldo: -10 }).success).toBe(false);
    });
  });

  describe('employeeIdParamSchema', () => {
    it('Debería aceptar cualquier id no vacío sin asumir formato de Mongo', () => {
      expect(employeeIdParamSchema.safeParse({ id: 'cualquier-id' }).success).toBe(true);
    });

    it('Debería rechazar un id vacío o sólo con espacios', () => {
      const result = employeeIdParamSchema.safeParse({ id: '   ' });

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(
        'El identificador del empleado es obligatorio'
      );
    });
  });
});
