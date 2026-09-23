import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmployeeDraft, nuevoBorrador } from '../../models/employee.model';

@Component({
  selector: 'app-employee-form',
  imports: [FormsModule],
  templateUrl: './employee-form.html',
  styleUrl: './employee-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeForm {
  @Input() set draft(valor: EmployeeDraft) {
    this.modelo = { ...valor };
  }

  @Input() editing = false;
  @Input() saving = false;

  @Output() save = new EventEmitter<EmployeeDraft>();
  @Output() cancel = new EventEmitter<void>();

  protected modelo: EmployeeDraft = nuevoBorrador();

  protected setCampo<K extends keyof EmployeeDraft>(campo: K, valor: EmployeeDraft[K]): void {
    this.modelo = { ...this.modelo, [campo]: valor };
  }

  protected onSubmit(): void {
    this.save.emit({ ...this.modelo });
  }
}
