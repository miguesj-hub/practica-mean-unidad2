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

/**
 * Actualización parcial o total de un registro.
 *
 * El mapeo explícito admite `undefined` además de la ausencia de la clave.
 * Con `exactOptionalPropertyTypes` activo, `Partial<T>` significa
 * "la clave puede no venir", mientras que un DTO derivado de Zod expresa
 * "la clave puede venir con valor `undefined`". Semánticamente ambas cosas
 * son lo mismo aquí —el campo queda intacto— y JSON no puede transportar
 * `undefined`, así que el caso sólo existe a nivel de tipos.
 */
export type UpdateEmployeeInput = {
  [K in keyof CreateEmployeeInput]?: CreateEmployeeInput[K] | undefined;
};
