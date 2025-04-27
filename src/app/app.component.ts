import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ConnectionComponent } from './features/connection/connection.component';
import { TemperatureDisplayComponent } from './features/temperature-display/temperature-display.component';
import { HrChartComponent } from './features/hr-chart/hr-chart.component';
import { AccChartComponent } from './features/acc-chart/acc-chart.component';
import { EcgChartComponent } from './features/ecg-chart/ecg-chart.component';
import { MetricsDisplayComponent } from './features/metrics-display/metrics-display.component';
import { GyroDisplayComponent } from './features/gyro-display/gyro-display.component';
import { MagnDisplayComponent } from './features/magn-display/magn-display.component';
import { StoredEcgListComponent } from './features/stored-ecg-list/stored-ecg-list.component';
import { SensorStatus } from './core/models/sensor-data.model';
import { MovesenseService } from './core/services/movesense.service';

@Component({
  selector: 'app-root',
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
    StoredEcgListComponent
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  private movesenseService = inject(MovesenseService);

  // Signals para estados de sensores
  readonly temperatureStatus = computed(() => this.movesenseService.temperatureStatus());
  readonly accelerometerStatus = computed(() => this.movesenseService.accelerometerStatus());
  readonly heartRateStatus = computed(() => this.movesenseService.heartRateStatus());
  readonly gyroscopeStatus = computed(() => this.movesenseService.gyroscopeStatus());
  readonly magnetometerStatus = computed(() => this.movesenseService.magnetometerStatus());
  readonly ecgStatus = computed(() => this.movesenseService.ecgStatus());

  // Signal para determinar si hay ECGs guardados
  readonly hasStoredEcgs = computed(() => this.movesenseService.hasStoredEcgs());
}