import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConnectionComponent } from './features/connection/connection.component';
import { TemperatureDisplayComponent } from './features/temperature-display/temperature-display.component';
import { HrChartComponent } from './features/hr-chart/hr-chart.component';
import { AccChartComponent } from './features/acc-chart/acc-chart.component';
import { EcgChartComponent } from './features/ecg-chart/ecg-chart.component'; // Import EcgChartComponent

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ConnectionComponent,
    TemperatureDisplayComponent,
    HrChartComponent,
    AccChartComponent,
    EcgChartComponent // Add EcgChartComponent here
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush // Add ChangeDetectionStrategy
})
export class AppComponent {
  // No title needed for now
}
