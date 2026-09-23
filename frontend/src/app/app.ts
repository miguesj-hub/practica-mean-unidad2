import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { EmployeeForm } from './components/employee-form/employee-form';
import { EmployeeGrid } from './components/employee-grid/employee-grid';
import { NoticeBanner } from './components/notice-banner/notice-banner';
import { EmployeeService } from './services/employee.service';
import { Employee, EmployeeDraft } from './models/employee.model';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, EmployeeForm, EmployeeGrid, NoticeBanner],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App implements OnInit {
  private readonly employees = inject(EmployeeService);

  protected readonly employees$ = this.employees.employees$;
  protected readonly draft$ = this.employees.draft$;
  protected readonly editingId$ = this.employees.editingId$;
  protected readonly loading$ = this.employees.loading$;
  protected readonly notice$ = this.employees.notice$;
  protected readonly total$ = this.employees.total$;

  ngOnInit(): void {
    this.employees.loadAll();
  }

  protected onSave(borrador: EmployeeDraft): void {
    this.employees.save(borrador);
  }

  protected onEdit(empleado: Employee): void {
    this.employees.edit(empleado);
  }

  protected onCancel(): void {
    this.employees.cancelEdit();
  }

  protected onRemove(id: string): void {
    this.employees.remove(id);
  }

  protected onReload(): void {
    this.employees.loadAll();
  }

  protected onDismiss(): void {
    this.employees.dismissNotice();
  }
}
