import { Component, OnInit, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmployeeService } from './services/employee.service';
import { Employee, EmployeeDraft } from './models/employee.model';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, CurrencyPipe, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly employees = inject(EmployeeService);

  readonly employees$ = this.employees.employees$;
  readonly draft$ = this.employees.draft$;
  readonly editingId$ = this.employees.editingId$;
  readonly loading$ = this.employees.loading$;
  readonly notice$ = this.employees.notice$;
  readonly total$ = this.employees.total$;

  ngOnInit(): void {
    this.employees.loadAll();
  }

  onField<K extends keyof EmployeeDraft>(campo: K, valor: EmployeeDraft[K]): void {
    this.employees.setField(campo, valor);
  }

  onSave(): void {
    this.employees.save();
  }

  onEdit(empleado: Employee): void {
    this.employees.edit(empleado);
  }

  onCancel(): void {
    this.employees.cancelEdit();
  }

  onRemove(id: string): void {
    this.employees.remove(id);
  }

  onReload(): void {
    this.employees.loadAll();
  }

  onDismiss(): void {
    this.employees.dismissNotice();
  }
}
