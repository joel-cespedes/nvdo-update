import { Component, inject, signal, effect, linkedSignal } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { CommonModule } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';
import { HeartRateData } from '../../core/models/sensor-data.model';

// Chart data interfaces
interface ChartData {
    name: string;
    series: ChartSeriesData[];
}

interface ChartSeriesData {
    name: string | Date;
    value: number;
}

const MAX_DATA_POINTS = 60;

@Component({
    selector: 'app-hr-chart',
    templateUrl: './hr-chart.component.html',
    styleUrls: ['./hr-chart.component.scss'],
    standalone: true,
    imports: [NgxChartsModule, CommonModule]
})
export class HrChartComponent {
    private movesenseService = inject(MovesenseService);

    // Chart data signal
    readonly chartData = signal<ChartData[]>([{ name: 'Ritmo Cardíaco', series: [] }]);

    // Link connection status signal
    readonly isConnected = linkedSignal(this.movesenseService.isConnected);

    // Chart configuration
    readonly view: [number, number] = [700, 300];
    readonly legend = false;
    readonly showXAxisLabel = true;
    readonly showYAxisLabel = true;
    readonly xAxisLabel = 'Tiempo';
    readonly yAxisLabel = 'Ritmo Cardíaco (BPM)';
    readonly timeline = true;
    readonly colorScheme = {
        name: 'hrScheme',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#E44D25']
    };
    readonly autoScale = true;

    constructor() {
        // Effect to update chart data when new HR data arrives
        effect(() => {
            const newHrData = this.movesenseService.heartRateData();
            if (newHrData && this.isConnected()) {
                this.updateChart(newHrData);
            }
        });

        // Effect to clear chart data when disconnected
        effect(() => {
            if (!this.isConnected()) {
                this.chartData.set([{ name: 'Ritmo Cardíaco', series: [] }]);
            }
        });
    }

    private updateChart(newData: HeartRateData): void {
        this.chartData.update(currentChartData => {
            const series = currentChartData[0].series;
            const newPoint: ChartSeriesData = {
                name: new Date(newData.timestamp),
                value: newData.hr
            };

            // Add new point and limit history length
            const updatedSeries = [...series, newPoint].slice(-MAX_DATA_POINTS);

            return [{ name: 'Ritmo Cardíaco', series: updatedSeries }];
        });
    }

    // Custom formatting for X-axis ticks
    xAxisTickFormatting(val: string | Date): string {
        if (val instanceof Date) {
            return val.toLocaleTimeString();
        }
        return String(val);
    }
}