import { CommonModule } from '@angular/common';
import { Component, inject, linkedSignal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MovesenseService } from './core/services/movesense.service';
import { AccChartComponent } from './features/acc-chart/acc-chart.component';
import { ConnectionComponent } from './features/connection/connection.component';
import { EcgChartComponent } from './features/ecg-chart/ecg-chart.component';
import { GyroDisplayComponent } from './features/gyro-display/gyro-display.component';
import { HrChartComponent } from './features/hr-chart/hr-chart.component';
import { MagnDisplayComponent } from './features/magn-display/magn-display.component';
import { MetricsDisplayComponent } from './features/metrics-display/metrics-display.component';
import { StoredEcgListComponent } from './features/stored-ecg-list/stored-ecg-list.component';
import { TemperatureDisplayComponent } from './features/temperature-display/temperature-display.component';
import { MemoryRecordingComponent } from './features/memory-recording/memory-recording.component';
import { MemoryRecordingListComponent } from './features/memory-recording-list/memory-recording-list.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ConnectionComponent,
    TemperatureDisplayComponent,
    HrChartComponent,
    AccChartComponent,
    EcgChartComponent,
    MetricsDisplayComponent,
    GyroDisplayComponent,
    MagnDisplayComponent,
    StoredEcgListComponent,
    MemoryRecordingComponent,
    MemoryRecordingListComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private movesenseService = inject(MovesenseService);

  // Link signals directly from the service
  readonly temperatureStatus = linkedSignal(this.movesenseService.temperatureStatus);
  readonly accelerometerStatus = linkedSignal(this.movesenseService.accelerometerStatus);
  readonly heartRateStatus = linkedSignal(this.movesenseService.heartRateStatus);
  readonly gyroscopeStatus = linkedSignal(this.movesenseService.gyroscopeStatus);
  readonly magnetometerStatus = linkedSignal(this.movesenseService.magnetometerStatus);
  readonly ecgStatus = linkedSignal(this.movesenseService.ecgStatus);
  readonly hasStoredEcgs = linkedSignal(this.movesenseService.hasStoredEcgs);

  readonly hasStoredMemoryRecordings = linkedSignal(this.movesenseService.hasStoredMemoryRecordings);
}