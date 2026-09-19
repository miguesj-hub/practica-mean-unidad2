import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  empleados: any[] = [];
  empleado: any = { nombre: '', cargo: '', departamento: '', sueldo: 0 };
  editando: string | null = null;
  cargando = false;
  mensaje = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarEmpleados();
  }

  cargarEmpleados() {
    this.cargando = true;
    this.http.get<any>('http://127.0.0.1:3000/api/v1/empleados').subscribe({
      next: (res) => {
        this.empleados = res.data;
        this.cargando = false;
      },
      error: () => {
        this.mensaje = 'No se pudo cargar el listado';
        this.cargando = false;
      }
    });
  }

  guardar() {
    const payload = {
      nombre: this.empleado.nombre,
      cargo: this.empleado.cargo,
      departamento: this.empleado.departamento,
      sueldo: Number(this.empleado.sueldo)
    };

    if (this.editando) {
      this.http
        .put<any>('http://127.0.0.1:3000/api/v1/empleados/' + this.editando, payload)
        .subscribe({
          next: (res) => {
            for (let i = 0; i < this.empleados.length; i++) {
              if (this.empleados[i].id === this.editando) {
                this.empleados[i].nombre = res.data.nombre;
                this.empleados[i].cargo = res.data.cargo;
                this.empleados[i].departamento = res.data.departamento;
                this.empleados[i].sueldo = res.data.sueldo;
              }
            }
            this.mensaje = 'Empleado actualizado';
            this.limpiar();
          },
          error: (err) => {
            this.mensaje = err.error?.errors?.[0]?.mensaje || 'No se pudo actualizar';
          }
        });
    } else {
      this.http.post<any>('http://127.0.0.1:3000/api/v1/empleados', payload).subscribe({
        next: (res) => {
          this.empleados.push(res.data);
          this.mensaje = 'Empleado guardado';
          this.limpiar();
        },
        error: (err) => {
          this.mensaje = err.error?.errors?.[0]?.mensaje || 'No se pudo guardar';
        }
      });
    }
  }

  editar(e: any) {
    this.editando = e.id;
    this.empleado = e;
  }

  eliminar(id: string) {
    this.http.delete<any>('http://127.0.0.1:3000/api/v1/empleados/' + id).subscribe({
      next: () => {
        const indice = this.empleados.findIndex((e) => e.id === id);
        this.empleados.splice(indice, 1);
        this.mensaje = 'Empleado eliminado';
      },
      error: () => {
        this.mensaje = 'No se pudo eliminar';
      }
    });
  }

  limpiar() {
    this.empleado = { nombre: '', cargo: '', departamento: '', sueldo: 0 };
    this.editando = null;
  }
}
