import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { EmployeeService } from './employee.service';
import { Employee, EmployeeDraft } from '../models/employee.model';

const API = '/api/v1/empleados';

const empleado = (id: string, nombre: string, sueldo = 1000): Employee => ({
  id,
  nombre,
  cargo: 'Arquitecto de Software',
  departamento: 'Innovación',
  sueldo,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

const borrador = (nombre: string, sueldo = 1000): EmployeeDraft => ({
  nombre,
  cargo: 'Arquitecto de Software',
  departamento: 'Innovación',
  sueldo
});

describe('EmployeeService', () => {
  let service: EmployeeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(EmployeeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cargarCon = (empleados: Employee[]) => {
    service.loadAll();
    http.expectOne(API).flush({ success: true, data: empleados });
  };

  it('expone el estado inicial como flujo de solo lectura', async () => {
    expect(await firstValueFrom(service.employees$)).toEqual([]);
    expect(await firstValueFrom(service.loading$)).toBe(false);
  });

  it('no expone los BehaviorSubject al exterior', () => {
    expect((service.employees$ as unknown as { next?: unknown }).next).toBeUndefined();
    expect((service.draft$ as unknown as { next?: unknown }).next).toBeUndefined();
  });

  it('publica el listado desenvuelto del Response Wrapper', async () => {
    cargarCon([empleado('1', 'Ana')]);
    const emitido = await firstValueFrom(service.employees$);
    expect(emitido.map((e) => e.nombre)).toEqual(['Ana']);
  });

  it('agrega sin mutar el arreglo anterior', async () => {
    cargarCon([empleado('1', 'Ana')]);
    const anterior = await firstValueFrom(service.employees$);

    service.save(borrador('Beto'));
    http.expectOne({ url: API, method: 'POST' }).flush({ success: true, data: empleado('2', 'Beto') });

    const actual = await firstValueFrom(service.employees$);
    expect(actual).not.toBe(anterior);
    expect(anterior.map((e) => e.nombre)).toEqual(['Ana']);
    expect(actual.map((e) => e.nombre)).toEqual(['Ana', 'Beto']);
  });

  it('reemplaza la referencia de la fila editada y respeta las demás', async () => {
    cargarCon([empleado('1', 'Ana'), empleado('2', 'Beto')]);
    const anterior = await firstValueFrom(service.employees$);

    service.edit(anterior[1]);
    service.save(borrador('Beto', 7000));
    http
      .expectOne({ url: `${API}/2`, method: 'PUT' })
      .flush({ success: true, data: empleado('2', 'Beto', 7000) });

    const actual = await firstValueFrom(service.employees$);
    expect(actual).not.toBe(anterior);
    expect(actual[0]).toBe(anterior[0]);
    expect(actual[1]).not.toBe(anterior[1]);
    expect(anterior[1].sueldo).toBe(1000);
    expect(actual[1].sueldo).toBe(7000);
  });

  it('elimina filtrando hacia un arreglo nuevo', async () => {
    cargarCon([empleado('1', 'Ana'), empleado('2', 'Beto')]);
    const anterior = await firstValueFrom(service.employees$);

    service.remove('1');
    http.expectOne({ url: `${API}/1`, method: 'DELETE' }).flush({ success: true, data: { id: '1' } });

    const actual = await firstValueFrom(service.employees$);
    expect(actual).not.toBe(anterior);
    expect(anterior.length).toBe(2);
    expect(actual.map((e) => e.id)).toEqual(['2']);
  });

  it('siembra el borrador con una copia del empleado, no con su referencia', async () => {
    cargarCon([empleado('1', 'Ana')]);
    const fila = (await firstValueFrom(service.employees$))[0];

    service.edit(fila);
    const sembrado = await firstValueFrom(service.draft$);

    expect(sembrado).not.toBe(fila);
    expect(sembrado).toEqual({
      nombre: fila.nombre,
      cargo: fila.cargo,
      departamento: fila.departamento,
      sueldo: fila.sueldo
    });
    expect(await firstValueFrom(service.editingId$)).toBe('1');
  });

  it('emite una referencia nueva en cada limpieza del borrador', async () => {
    const inicial = await firstValueFrom(service.draft$);
    service.cancelEdit();
    const primera = await firstValueFrom(service.draft$);
    service.cancelEdit();
    const segunda = await firstValueFrom(service.draft$);

    expect(primera).not.toBe(inicial);
    expect(segunda).not.toBe(primera);
    expect(segunda).toEqual(inicial);
  });

  it('deriva la masa salarial del flujo de empleados', async () => {
    cargarCon([empleado('1', 'Ana', 1000), empleado('2', 'Beto', 2500)]);
    expect(await firstValueFrom(service.total$)).toBe(3500);
  });

  it('traduce los errores del backend a un aviso y no limpia el borrador', async () => {
    const antes = await firstValueFrom(service.draft$);

    service.save(borrador('An'));
    http.expectOne({ url: API, method: 'POST' }).flush(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'La petición no superó la validación' },
        errors: [{ campo: 'nombre', mensaje: 'El nombre debe tener al menos 3 caracteres' }]
      },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(await firstValueFrom(service.notice$)).toEqual({
      tipo: 'error',
      texto: 'El nombre debe tener al menos 3 caracteres'
    });
    expect(await firstValueFrom(service.draft$)).toBe(antes);
    expect(await firstValueFrom(service.loading$)).toBe(false);
  });

  it('limpia el borrador y el modo edición sólo cuando la operación tuvo éxito', async () => {
    service.save(borrador('Andrés Mendoza'));
    http
      .expectOne({ url: API, method: 'POST' })
      .flush({ success: true, data: empleado('9', 'Andrés Mendoza') });

    expect(await firstValueFrom(service.draft$)).toEqual({
      nombre: '',
      cargo: '',
      departamento: '',
      sueldo: 0
    });
    expect(await firstValueFrom(service.editingId$)).toBeNull();
  });
});
