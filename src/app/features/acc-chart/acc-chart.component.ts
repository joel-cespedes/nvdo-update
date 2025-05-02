import { Component, inject, signal, effect, linkedSignal } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { CommonModule } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';
import { AccelerometerData } from '../../core/models/sensor-data.model';

// Chart data interfaces
interface ChartData {
    name: string;
    series: ChartSeriesData[];
}

interface ChartSeriesData {
    name: string | Date;
    value: number;
}

const MAX_ACC_DATA_POINTS = 100;

@Component({
    selector: 'app-acc-chart',
    templateUrl: './acc-chart.component.html',
    styleUrls: ['./acc-chart.component.scss'],
    standalone: true,
    imports: [NgxChartsModule, CommonModule]
})
export class AccChartComponent {
    private movesenseService = inject(MovesenseService);

    // Chart data signal
    readonly chartData = signal<ChartData[]>([
        { name: 'X', series: [] },
        { name: 'Y', series: [] },
        { name: 'Z', series: [] }
    ]);

    // Link connection status signal
    readonly isConnected = linkedSignal(this.movesenseService.isConnected);

    // Chart configuration
    readonly view: [number, number] = [700, 300];
    readonly legend = true;
    readonly showXAxisLabel = true;
    readonly showYAxisLabel = true;
    readonly xAxisLabel = 'Tiempo';
    readonly yAxisLabel = 'Aceleración (m/s²)';
    readonly timeline = true;
    readonly colorScheme = {
        name: 'accScheme',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#FF0000', '#00FF00', '#0000FF']
    };
    readonly autoScale = true;

    constructor() {
        // Effect to update chart when new accelerometer data arrives
        effect(() => {
            const newAccData = this.movesenseService.accelerometerData();
            if (newAccData && this.isConnected()) {
                this.updateChart(newAccData);
            }
        });

        // Effect to clear chart when disconnected
        effect(() => {
            if (!this.isConnected()) {
                this.chartData.set([
                    { name: 'X', series: [] },
                    { name: 'Y', series: [] },
                    { name: 'Z', series: [] }
                ]);
            }
        });
    }

    private updateChart(newData: AccelerometerData): void {
        this.chartData.update(currentChartData => {
            // Create a single new data point
            const timestamp = new Date(newData.timestamp);

            const newPointX: ChartSeriesData = { name: timestamp, value: newData.x };
            const newPointY: ChartSeriesData = { name: timestamp, value: newData.y };
            const newPointZ: ChartSeriesData = { name: timestamp, value: newData.z };

            // Add new points and limit history length
            const updatedSeriesX = [...currentChartData[0].series, newPointX].slice(-MAX_ACC_DATA_POINTS);
            const updatedSeriesY = [...currentChartData[1].series, newPointY].slice(-MAX_ACC_DATA_POINTS);
            const updatedSeriesZ = [...currentChartData[2].series, newPointZ].slice(-MAX_ACC_DATA_POINTS);

            return [
                { name: 'X', series: updatedSeriesX },
                { name: 'Y', series: updatedSeriesY },
                { name: 'Z', series: updatedSeriesZ }
            ];
        });
    }

    // Custom formatting for X-axis ticks
    xAxisTickFormatting(val: string | Date): string {
        if (val instanceof Date) {
            return val.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                fractionalSecondDigits: 3
            });
        }
        return String(val);
    }
}