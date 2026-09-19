import { isValidObjectId } from 'mongoose';
import type {
  CreateEmployeeInput,
  Employee,
  UpdateEmployeeInput
} from '../../../domain/employee.entity.js';
import type { IEmployeeRepository } from '../../../domain/employee.repository.js';
import { EmpleadoModel } from './empleado.schema.js';

/** Forma cruda del documento tal como lo devuelve Mongoose. */
interface EmpleadoDocument {
  _id: unknown;
  nombre: string;
  cargo: string;
  departamento: string;
  sueldo: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Traduce del lenguaje del ODM al lenguaje del dominio. */
const toEntity = (doc: EmpleadoDocument): Employee => ({
  id: String(doc._id),
  nombre: doc.nombre,
  cargo: doc.cargo,
  departamento: doc.departamento,
  sueldo: doc.sueldo,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt
});

/**
 * Adaptador de persistencia: implementa el puerto `IEmployeeRepository`
 * usando Mongoose. Es la frontera donde termina el dominio y empieza el ODM.
 *
 * El guardia `isValidObjectId` vive aquí por diseño: que un identificador
 * sea un ObjectId de 24 hexadecimales es una regla del motor, no del
 * contrato HTTP. Traduciendo el id malformado a "no encontrado" se evita
 * que un `CastError` escape como 500 y se mantiene al dominio ignorante
 * del formato de llave primaria de Mongo.
 */
export class MongooseEmployeeRepository implements IEmployeeRepository {
  async findAll(): Promise<Employee[]> {
    const docs = await EmpleadoModel.find().lean<EmpleadoDocument[]>();
    return docs.map(toEntity);
  }

  async findById(id: string): Promise<Employee | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await EmpleadoModel.findById(id).lean<EmpleadoDocument | null>();
    return doc ? toEntity(doc) : null;
  }

  async create(data: CreateEmployeeInput): Promise<Employee> {
    const created = await EmpleadoModel.create(data);
    return toEntity(created.toObject() as EmpleadoDocument);
  }

  async update(id: string, data: UpdateEmployeeInput): Promise<Employee | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await EmpleadoModel
      .findByIdAndUpdate(id, data, { returnDocument: 'after' })
      .lean<EmpleadoDocument | null>();
    return doc ? toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const doc = await EmpleadoModel.findByIdAndDelete(id).lean<EmpleadoDocument | null>();
    return doc !== null;
  }
}
