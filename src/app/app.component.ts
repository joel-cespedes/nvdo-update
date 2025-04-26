import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConnectionComponent } from './features/connection/connection.component';
import { TemperatureDisplayComponent } from './features/temperature-display/temperature-display.component';
import { HrChartComponent } from './features/hr-chart/hr-chart.component';
import { AccChartComponent } from './features/acc-chart/acc-chart.component';
import { EcgChartComponent } from './features/ecg-chart/ecg-chart.component';
import { MetricsDisplayComponent } from './features/metrics-display/metrics-display.component'; // Import Metrics
import { GyroDisplayComponent } from './features/gyro-display/gyro-display.component'; // Import Gyro
import { MagnDisplayComponent } from './features/magn-display/magn-display.component'; // Import Magn
import { DebugPanelComponent } from './features/debug-panel/debug-panel.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ConnectionComponent,
    TemperatureDisplayComponent,
    HrChartComponent,
    AccChartComponent,
    EcgChartComponent,
    DebugPanelComponent, // Add Debug Panel
    MetricsDisplayComponent, // Add Metrics
    GyroDisplayComponent,    // Add Gyro
    MagnDisplayComponent     // Add Magn
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush // Add ChangeDetectionStrategy
})
export class AppComponent {
  // No title needed for now
}
