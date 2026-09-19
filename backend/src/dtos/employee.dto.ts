import { z } from 'zod';

/**
 * Contratos declarativos de entrada (Data Transfer Objects).
 *
 * Definen qué es una petición legítima ANTES de que el controlador exista
 * en la ecuación. Son reglas de negocio, no de almacenamiento: el schema de
 * Mongoose sólo exige `required`, aquí se exige longitud mínima y sueldo
 * positivo.
 *
 * `strictObject` rechaza claves desconocidas: impide que un cliente inyecte
 * campos arbitrarios que luego terminarían persistidos.
 */
export const createEmployeeSchema = z.strictObject({
  nombre: z
    .string('El nombre es obligatorio y debe ser texto')
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(80, 'El nombre no puede exceder 80 caracteres'),
  cargo: z
    .string('El cargo es obligatorio y debe ser texto')
    .trim()
    .min(3, 'El cargo debe tener al menos 3 caracteres')
    .max(80, 'El cargo no puede exceder 80 caracteres'),
  departamento: z
    .string('El departamento es obligatorio y debe ser texto')
    .trim()
    .min(2, 'El departamento debe tener al menos 2 caracteres')
    .max(80, 'El departamento no puede exceder 80 caracteres'),
  sueldo: z
    .number('El sueldo es obligatorio y debe ser numérico')
    .positive('El sueldo debe ser mayor a 0')
    .max(1_000_000, 'El sueldo excede el máximo permitido')
});

/**
 * Actualización parcial: todos los campos son opcionales, pero un cuerpo
 * vacío no es una actualización válida.
 */
export const updateEmployeeSchema = createEmployeeSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    error: 'Debe enviar al menos un campo para actualizar'
  });

/**
 * Blindaje de `req.params`. Valida la presencia del identificador sin
 * asumir su formato: que un id sea un ObjectId de 24 hexadecimales es un
 * detalle del motor de persistencia, no del contrato HTTP.
 */
export const employeeIdParamSchema = z.strictObject({
  id: z.string().trim().min(1, 'El identificador del empleado es obligatorio')
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
export type EmployeeIdParam = z.infer<typeof employeeIdParamSchema>;
