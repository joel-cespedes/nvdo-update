import { Component, inject, ChangeDetectionStrategy, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';
import { SensorStatus } from '../../core/services/models/movesense.model';

@Component({
  selector: 'app-debug-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './debug-panel.component.html',
  styleUrls: ['./debug-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DebugPanelComponent {
  private readonly movesenseService = inject(MovesenseService);

  // Expose signals for template
  readonly debugLog: Signal<string[]> = this.movesenseService.debugLog;
  readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;

  // Sensor status
  readonly temperatureStatus: Signal<SensorStatus> = this.movesenseService.temperatureStatus;
  readonly accelerometerStatus: Signal<SensorStatus> = this.movesenseService.accelerometerStatus;
  readonly heartRateStatus: Signal<SensorStatus> = this.movesenseService.heartRateStatus;
  readonly gyroscopeStatus: Signal<SensorStatus> = this.movesenseService.gyroscopeStatus;
  readonly magnetometerStatus: Signal<SensorStatus> = this.movesenseService.magnetometerStatus;
  readonly ecgStatus: Signal<SensorStatus> = this.movesenseService.ecgStatus;

  clearLog(): void {
    this.movesenseService.clearLog();
  }

  trySpecificFormat(): void {
    this.movesenseService.trySpecificFormat();
  }
}