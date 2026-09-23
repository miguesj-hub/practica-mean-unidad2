import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeForm } from './employee-form';
import { EmployeeDraft } from '../../models/employee.model';

describe('EmployeeForm', () => {
  let fixture: ComponentFixture<EmployeeForm>;

  const draft = (nombre = 'Ana'): EmployeeDraft => ({
    nombre,
    cargo: 'Arquitecto de Software',
    departamento: 'Innovación',
    sueldo: 4500
  });

  const escribir = async (campo: string, valor: string) => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector(`input[name="${campo}"]`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  const enviar = async () => {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmployeeForm] }).compileComponents();
    fixture = TestBed.createComponent(EmployeeForm);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('no muta la entrada que recibe al teclear', async () => {
    const entrada = draft();
    fixture.componentRef.setInput('draft', entrada);
    await fixture.whenStable();

    await escribir('nombre', 'Ana Modificada');

    expect(entrada.nombre).toBe('Ana');
  });

  it('emite una copia, no su propio modelo interno', async () => {
    const entrada = draft();
    const emitidos: EmployeeDraft[] = [];
    fixture.componentInstance.save.subscribe((valor) => emitidos.push(valor));
    fixture.componentRef.setInput('draft', entrada);
    await fixture.whenStable();

    await escribir('nombre', 'Ana Modificada');
    await enviar();

    expect(emitidos.length).toBe(1);
    expect(emitidos[0].nombre).toBe('Ana Modificada');
    expect(emitidos[0]).not.toBe(entrada);
    expect(entrada.nombre).toBe('Ana');

    await escribir('nombre', 'Otro Nombre');
    expect(emitidos[0].nombre).toBe('Ana Modificada');
  });

  it('se resiembra cuando la entrada cambia de referencia', async () => {
    fixture.componentRef.setInput('draft', draft('Ana'));
    await fixture.whenStable();
    await escribir('nombre', 'Tecleado');

    fixture.componentRef.setInput('draft', draft('Beto'));
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[name="nombre"]');
    expect(input.value).toBe('Beto');
  });

  it('muestra el modo edición y emite la cancelación', async () => {
    const cancelaciones: number[] = [];
    fixture.componentInstance.cancel.subscribe(() => cancelaciones.push(1));
    fixture.componentRef.setInput('draft', draft());
    fixture.componentRef.setInput('editing', true);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Editando empleado');

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    );
    botones.find((b) => b.textContent?.includes('Cancelar'))?.click();
    await fixture.whenStable();

    expect(cancelaciones.length).toBe(1);
  });

  it('deshabilita el envío mientras la operación está en curso', async () => {
    fixture.componentRef.setInput('draft', draft());
    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();

    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submit.disabled).toBe(true);
  });
});
