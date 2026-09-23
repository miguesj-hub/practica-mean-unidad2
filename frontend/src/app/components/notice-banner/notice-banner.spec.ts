import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoticeBanner } from './notice-banner';

describe('NoticeBanner', () => {
  let fixture: ComponentFixture<NoticeBanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NoticeBanner] }).compileComponents();
    fixture = TestBed.createComponent(NoticeBanner);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('no renderiza nada sin aviso', async () => {
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.alert')).toBeNull();
  });

  it('distingue el aviso de éxito del de error', async () => {
    fixture.componentRef.setInput('notice', { tipo: 'exito', texto: 'Empleado guardado' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.alert-success')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Empleado guardado');

    fixture.componentRef.setInput('notice', { tipo: 'error', texto: 'Sueldo inválido' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.alert-danger')).not.toBeNull();
  });

  it('emite el descarte al cerrar', async () => {
    const descartes: number[] = [];
    fixture.componentInstance.dismiss.subscribe(() => descartes.push(1));
    fixture.componentRef.setInput('notice', { tipo: 'exito', texto: 'Listo' });
    await fixture.whenStable();

    fixture.nativeElement.querySelector('.btn-close').click();
    await fixture.whenStable();

    expect(descartes.length).toBe(1);
  });
});
