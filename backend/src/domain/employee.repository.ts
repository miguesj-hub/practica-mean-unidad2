import type {
  CreateEmployeeInput,
  Employee,
  UpdateEmployeeInput
} from './employee.entity.js';

/**
 * Puerto de persistencia (Patrón Repository).
 *
 * Es el único contrato que la capa de Express conoce. Cualquier motor de
 * almacenamiento —Mongoose, Postgres, un arreglo en memoria para tests—
 * es intercambiable mientras implemente esta interfaz.
 *
 * Cubre las cinco operaciones fundamentales que exige la práctica.
 */
export interface IEmployeeRepository {
  /** Consulta completa de empleados. */
  findAll(): Promise<Employee[]>;

  /** Consulta atómica por identificador único. */
  findById(id: string): Promise<Employee | null>;

  /** Registro de un nuevo empleado. */
  create(data: CreateEmployeeInput): Promise<Employee>;

  /** Actualización parcial o total. Devuelve `null` si el id no existe. */
  update(id: string, data: UpdateEmployeeInput): Promise<Employee | null>;

  /** Eliminación física. Devuelve `false` si el id no existe. */
  delete(id: string): Promise<boolean>;
}
