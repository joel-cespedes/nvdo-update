import { Component, ChangeDetectionStrategy, Signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConnectionComponent } from './features/connection/connection.component';
import { TemperatureDisplayComponent } from './features/temperature-display/temperature-display.component';
import { HrChartComponent } from './features/hr-chart/hr-chart.component';
import { AccChartComponent } from './features/acc-chart/acc-chart.component';
import { EcgChartComponent } from './features/ecg-chart/ecg-chart.component';
import { MetricsDisplayComponent } from './features/metrics-display/metrics-display.component';
import { GyroDisplayComponent } from './features/gyro-display/gyro-display.component';
import { MagnDisplayComponent } from './features/magn-display/magn-display.component';
import { SensorStatus } from './core/services/models/movesense.model';
import { MovesenseService } from './core/services/movesense.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ConnectionComponent,
    TemperatureDisplayComponent,
    HrChartComponent,
    AccChartComponent,
    EcgChartComponent,
    MetricsDisplayComponent,
    GyroDisplayComponent,
    MagnDisplayComponent

  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly movesenseService = inject(MovesenseService);

  readonly temperatureStatus: Signal<SensorStatus> = this.movesenseService.temperatureStatus;
  readonly accelerometerStatus: Signal<SensorStatus> = this.movesenseService.accelerometerStatus;
  readonly heartRateStatus: Signal<SensorStatus> = this.movesenseService.heartRateStatus;
  readonly gyroscopeStatus: Signal<SensorStatus> = this.movesenseService.gyroscopeStatus;
  readonly magnetometerStatus: Signal<SensorStatus> = this.movesenseService.magnetometerStatus;
  readonly ecgStatus: Signal<SensorStatus> = this.movesenseService.ecgStatus;
}
