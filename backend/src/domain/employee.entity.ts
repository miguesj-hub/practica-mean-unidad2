/**
 * Entidad de dominio. No conoce Mongoose, ni Express, ni ningún detalle
 * de infraestructura: es un objeto plano que describe un empleado.
 * Nótese `id` (string) y no `_id` (ObjectId): el dominio no habla Mongo.
 */
export interface Employee {
  id: string;
  nombre: string;
  cargo: string;
  departamento: string;
  sueldo: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos necesarios para registrar un empleado. */
export type CreateEmployeeInput = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

/** Actualización parcial o total de un registro. */
export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;
