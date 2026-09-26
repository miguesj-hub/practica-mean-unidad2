import { beforeEach, describe, expect, it, jest } from '@jest/globals';

/**
 * Prueba unitaria del adaptador de persistencia.
 *
 * Se reemplaza `EmpleadoModel` por un doble: no se abre conexión ni hace
 * falta MongoDB. Lo que se verifica es la responsabilidad propia del
 * adaptador: traducir documentos a entidades (`_id` → `id`) y cortar los
 * ids malformados antes de que lleguen al motor.
 *
 * En ESM los imports estáticos se resuelven antes que cualquier línea del
 * archivo, por eso el mock se registra con `unstable_mockModule` y el
 * módulo bajo prueba se importa dinámicamente después.
 */
const lean = <T>(value: T) => ({ lean: jest.fn(async () => value) });

const EmpleadoModel = {
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn()
};

jest.unstable_mockModule('./empleado.schema.js', () => ({ EmpleadoModel }));

const { MongooseEmployeeRepository } = await import('./employee.mongoose.repository.js');

describe('🧪 Unit Test: MongooseEmployeeRepository (Adaptador de persistencia)', () => {
  let repository: InstanceType<typeof MongooseEmployeeRepository>;

  const validId = '66f0c0ffee0000000000abcd';
  const fecha = new Date('2026-09-01T00:00:00Z');
  const doc = {
    _id: { toString: () => validId },
    nombre: 'Andrés Mendoza',
    cargo: 'Arquitecto',
    departamento: 'TI',
    sueldo: 4000,
    createdAt: fecha,
    updatedAt: fecha
  };
  const entity = {
    id: validId,
    nombre: 'Andrés Mendoza',
    cargo: 'Arquitecto',
    departamento: 'TI',
    sueldo: 4000,
    createdAt: fecha,
    updatedAt: fecha
  };

  beforeEach(() => {
    repository = new MongooseEmployeeRepository();
  });

  it('findAll debería mapear cada documento a entidad de dominio', async () => {
    EmpleadoModel.find.mockReturnValue(lean([doc]));

    const result = await repository.findAll();

    expect(result).toEqual([entity]);
    expect(result[0]).not.toHaveProperty('_id');
  });

  describe('findById', () => {
    it('Debería devolver la entidad cuando el documento existe', async () => {
      EmpleadoModel.findById.mockReturnValue(lean(doc));

      await expect(repository.findById(validId)).resolves.toEqual(entity);
      expect(EmpleadoModel.findById).toHaveBeenCalledWith(validId);
    });

    it('Debería devolver null cuando el documento no existe', async () => {
      EmpleadoModel.findById.mockReturnValue(lean(null));

      await expect(repository.findById(validId)).resolves.toBeNull();
    });

    it('Debería devolver null sin consultar el motor si el id es malformado', async () => {
      await expect(repository.findById('no-es-object-id')).resolves.toBeNull();
      expect(EmpleadoModel.findById).not.toHaveBeenCalled();
    });
  });

  it('create debería persistir los datos y devolver la entidad', async () => {
    const { id, createdAt, updatedAt, ...data } = entity;
    EmpleadoModel.create.mockResolvedValue({ toObject: () => doc } as never);

    await expect(repository.create(data)).resolves.toEqual(entity);
    expect(EmpleadoModel.create).toHaveBeenCalledWith(data);
  });

  describe('update', () => {
    it('Debería devolver la entidad actualizada', async () => {
      const actualizado = { ...doc, sueldo: 4500 };
      EmpleadoModel.findByIdAndUpdate.mockReturnValue(lean(actualizado));

      await expect(repository.update(validId, { sueldo: 4500 })).resolves.toEqual({
        ...entity,
        sueldo: 4500
      });
      expect(EmpleadoModel.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        { sueldo: 4500 },
        { returnDocument: 'after' }
      );
    });

    it('Debería devolver null cuando el documento no existe', async () => {
      EmpleadoModel.findByIdAndUpdate.mockReturnValue(lean(null));

      await expect(repository.update(validId, { sueldo: 4500 })).resolves.toBeNull();
    });

    it('Debería devolver null sin consultar el motor si el id es malformado', async () => {
      await expect(repository.update('xyz', { sueldo: 4500 })).resolves.toBeNull();
      expect(EmpleadoModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('Debería devolver true cuando se eliminó un documento', async () => {
      EmpleadoModel.findByIdAndDelete.mockReturnValue(lean(doc));

      await expect(repository.delete(validId)).resolves.toBe(true);
      expect(EmpleadoModel.findByIdAndDelete).toHaveBeenCalledWith(validId);
    });

    it('Debería devolver false cuando el documento no existe', async () => {
      EmpleadoModel.findByIdAndDelete.mockReturnValue(lean(null));

      await expect(repository.delete(validId)).resolves.toBe(false);
    });

    it('Debería devolver false sin consultar el motor si el id es malformado', async () => {
      await expect(repository.delete('xyz')).resolves.toBe(false);
      expect(EmpleadoModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
