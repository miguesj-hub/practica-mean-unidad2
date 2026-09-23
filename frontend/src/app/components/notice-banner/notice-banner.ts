import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Notice } from '../../models/employee.model';

@Component({
  selector: 'app-notice-banner',
  imports: [],
  templateUrl: './notice-banner.html',
  styleUrl: './notice-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NoticeBanner {
  @Input() notice: Notice | null = null;
  @Output() dismiss = new EventEmitter<void>();
}
