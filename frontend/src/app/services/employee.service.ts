import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, EMPTY, Observable, catchError, finalize, map } from 'rxjs';
import {
  ApiFailure,
  ApiSuccess,
  Employee,
  EmployeeDraft,
  Notice,
  nuevoBorrador
} from '../models/employee.model';

@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private readonly http = inject(HttpClient);
  // Ruta relativa: en producción Nginx la envía al backend y en desarrollo lo hace proxy.conf.json.
  private readonly api = '/api/v1/empleados';

  private readonly employeesSubject = new BehaviorSubject<Employee[]>([]);
  private readonly draftSubject = new BehaviorSubject<EmployeeDraft>(nuevoBorrador());
  private readonly editingIdSubject = new BehaviorSubject<string | null>(null);
  private readonly loadingSubject = new BehaviorSubject<boolean>(false);
  private readonly noticeSubject = new BehaviorSubject<Notice | null>(null);

  readonly employees$: Observable<Employee[]> = this.employeesSubject.asObservable();
  readonly draft$: Observable<EmployeeDraft> = this.draftSubject.asObservable();
  readonly editingId$: Observable<string | null> = this.editingIdSubject.asObservable();
  readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();
  readonly notice$: Observable<Notice | null> = this.noticeSubject.asObservable();

  readonly total$: Observable<number> = this.employees$.pipe(
    map((empleados) => empleados.reduce((acumulado, empleado) => acumulado + empleado.sueldo, 0))
  );

  loadAll(): void {
    this.dispatch(
      this.http.get<ApiSuccess<Employee[]>>(this.api).pipe(map((respuesta) => respuesta.data)),
      (empleados) => this.employeesSubject.next(empleados)
    );
  }

  edit(empleado: Employee): void {
    this.editingIdSubject.next(empleado.id);
    this.draftSubject.next({
      nombre: empleado.nombre,
      cargo: empleado.cargo,
      departamento: empleado.departamento,
      sueldo: empleado.sueldo
    });
  }

  cancelEdit(): void {
    this.editingIdSubject.next(null);
    this.draftSubject.next(nuevoBorrador());
  }

  save(borrador: EmployeeDraft): void {
    const editandoId = this.editingIdSubject.value;

    if (editandoId === null) {
      this.create(borrador);
      return;
    }

    this.update(editandoId, borrador);
  }

  remove(id: string): void {
    this.dispatch(
      this.http.delete<ApiSuccess<{ id: string }>>(`${this.api}/${id}`).pipe(
        map((respuesta) => respuesta.data.id)
      ),
      (eliminado) => {
        this.employeesSubject.next(
          this.employeesSubject.value.filter((empleado) => empleado.id !== eliminado)
        );
        this.noticeSubject.next({ tipo: 'exito', texto: 'Empleado eliminado' });

        if (this.editingIdSubject.value === eliminado) {
          this.cancelEdit();
        }
      }
    );
  }

  dismissNotice(): void {
    this.noticeSubject.next(null);
  }

  private create(borrador: EmployeeDraft): void {
    this.dispatch(
      this.http
        .post<ApiSuccess<Employee>>(this.api, borrador)
        .pipe(map((respuesta) => respuesta.data)),
      (creado) => {
        this.employeesSubject.next([...this.employeesSubject.value, creado]);
        this.noticeSubject.next({ tipo: 'exito', texto: 'Empleado guardado' });
        this.cancelEdit();
      }
    );
  }

  private update(id: string, borrador: EmployeeDraft): void {
    this.dispatch(
      this.http
        .put<ApiSuccess<Employee>>(`${this.api}/${id}`, borrador)
        .pipe(map((respuesta) => respuesta.data)),
      (actualizado) => {
        this.employeesSubject.next(
          this.employeesSubject.value.map((empleado) =>
            empleado.id === actualizado.id ? actualizado : empleado
          )
        );
        this.noticeSubject.next({ tipo: 'exito', texto: 'Empleado actualizado' });
        this.cancelEdit();
      }
    );
  }

  private dispatch<T>(origen: Observable<T>, alRecibir: (valor: T) => void): void {
    this.loadingSubject.next(true);

    origen
      .pipe(
        catchError((fallo: HttpErrorResponse) => {
          this.noticeSubject.next({ tipo: 'error', texto: this.describir(fallo) });
          return EMPTY;
        }),
        finalize(() => this.loadingSubject.next(false))
      )
      .subscribe(alRecibir);
  }

  private describir(fallo: HttpErrorResponse): string {
    const cuerpo = fallo.error as ApiFailure | null;

    if (cuerpo?.errors?.length) {
      return cuerpo.errors.map((detalle) => detalle.mensaje).join(' · ');
    }

    if (cuerpo?.error?.message) {
      return cuerpo.error.message;
    }

    return 'No se pudo contactar con el servidor';
  }
}
