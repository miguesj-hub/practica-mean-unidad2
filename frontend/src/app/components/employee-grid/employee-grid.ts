import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Employee } from '../../models/employee.model';

@Component({
  selector: 'app-employee-grid',
  imports: [CurrencyPipe],
  templateUrl: './employee-grid.html',
  styleUrl: './employee-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeGrid {
  @Input() empleados: readonly Employee[] = [];
  @Input() loading = false;
  @Input() total = 0;
  @Output() edit = new EventEmitter<Employee>();
  @Output() remove = new EventEmitter<string>();
  @Output() reload = new EventEmitter<void>();
}
