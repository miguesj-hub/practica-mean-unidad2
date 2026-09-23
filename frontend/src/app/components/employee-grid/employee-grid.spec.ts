import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeGrid } from './employee-grid';
import { Employee } from '../../models/employee.model';

describe('EmployeeGrid', () => {
  let fixture: ComponentFixture<EmployeeGrid>;

  const empleado = (id: string, nombre: string, sueldo = 1000): Employee => ({
    id,
    nombre,
    cargo: 'Arquitecto de Software',
    departamento: 'Innovación',
    sueldo,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  });

  const filas = () => fixture.nativeElement.querySelectorAll('tbody tr');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmployeeGrid] }).compileComponents();
    fixture = TestBed.createComponent(EmployeeGrid);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('anuncia la rejilla vacía sin empleados', async () => {
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Sin empleados registrados');
  });

  it('renderiza una fila por empleado recibido', async () => {
    fixture.componentRef.setInput('empleados', [empleado('1', 'Ana'), empleado('2', 'Beto')]);
    await fixture.whenStable();

    expect(filas().length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Ana');
    expect(fixture.nativeElement.textContent).toContain('Beto');
  });

  it('emite el empleado a editar y el id a eliminar sin tocar la entrada', async () => {
    const entrada = [empleado('1', 'Ana')];
    const editados: Employee[] = [];
    const eliminados: string[] = [];
    fixture.componentInstance.edit.subscribe((e) => editados.push(e));
    fixture.componentInstance.remove.subscribe((id) => eliminados.push(id));
    fixture.componentRef.setInput('empleados', entrada);
    await fixture.whenStable();

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('tbody button')
    );
    botones.find((b) => b.textContent?.includes('Editar'))?.click();
    botones.find((b) => b.textContent?.includes('Eliminar'))?.click();
    await fixture.whenStable();

    expect(editados).toEqual([entrada[0]]);
    expect(eliminados).toEqual(['1']);
    expect(entrada.length).toBe(1);
  });

  it('se repinta con OnPush cuando la entrada cambia de referencia', async () => {
    fixture.componentRef.setInput('empleados', [empleado('1', 'Ana')]);
    await fixture.whenStable();
    expect(filas().length).toBe(1);

    fixture.componentRef.setInput('empleados', [empleado('1', 'Ana'), empleado('2', 'Beto')]);
    await fixture.whenStable();
    expect(filas().length).toBe(2);
  });

  it('muestra el total recibido y el estado de carga', async () => {
    fixture.componentRef.setInput('total', 3500);
    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('tfoot').textContent).toContain('3,500');
    expect(fixture.nativeElement.textContent).toContain('Cargando');
  });
});
