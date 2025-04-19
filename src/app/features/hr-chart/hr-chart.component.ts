import { Component, inject, ChangeDetectionStrategy, signal, WritableSignal, computed, Signal, effect } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // Import the module
import { MovesenseService, HeartRateData } from '../../core/services/movesense.service';

// Interface for ngx-charts data format
export interface ChartData {
    name: string; // Series name (e.g., 'Heart Rate')
    series: ChartSeriesData[];
}

export interface ChartSeriesData {
    name: string | Date; // Timestamp (using Date for x-axis)
    value: number; // HR value
}

const MAX_DATA_POINTS = 60; // Keep the last 60 HR readings

@Component({
    selector: 'app-hr-chart',
    templateUrl: './hr-chart.component.html',
    styleUrls: ['./hr-chart.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgxChartsModule], // Import the module for standalone components
    // standalone: true is default
})
export class HrChartComponent {
    private readonly movesenseService = inject(MovesenseService);

    // --- Chart Data Signal ---
    // Holds the data formatted for ngx-charts
    readonly chartData: WritableSignal<ChartData[]> = signal([{ name: 'Heart Rate', series: [] }]);

    // --- Chart Configuration ---
    readonly view: [number, number] = [700, 300]; // Chart dimensions [width, height]
    readonly legend: boolean = false;
    readonly showXAxisLabel: boolean = true;
    readonly showYAxisLabel: boolean = true;
    readonly xAxisLabel: string = 'Time';
    readonly yAxisLabel: string = 'Heart Rate (BPM)';
    readonly timeline: boolean = true; // Enable timeline view for time-series data
    readonly colorScheme = { // Example color scheme
        name: 'hrScheme',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#E44D25'] // Reddish color for HR
    };
    readonly autoScale = true; // Automatically adjust y-axis scale

    // Expose connection status
    readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;

    constructor() {
        // Effect to update chart data when new HR data arrives from the service
        effect(() => {
            const newHrData = this.movesenseService.heartRateData(); // Get latest HR data point
            if (newHrData && this.isConnected()) {
                this.updateChart(newHrData);
            }
        }, { allowSignalWrites: true }); // Allow writing to chartData signal inside effect

        // Effect to clear chart data when disconnected
        effect(() => {
            if (!this.isConnected()) {
                this.chartData.set([{ name: 'Heart Rate', series: [] }]);
            }
        });
    }

    private updateChart(newData: HeartRateData): void {
        this.chartData.update(currentChartData => {
            const series = currentChartData[0].series;
            const newPoint: ChartSeriesData = {
                name: new Date(newData.timestamp), // Use Date object for time axis
                value: newData.hr
            };

            // Add new data point and limit history length
            const updatedSeries = [...series, newPoint].slice(-MAX_DATA_POINTS);

            return [{ name: 'Heart Rate', series: updatedSeries }];
        });
    }

    // Optional: Custom date formatting for x-axis ticks
    xAxisTickFormatting(val: string | Date): string {
        if (val instanceof Date) {
            return val.toLocaleTimeString(); // Format as HH:MM:SS
        }
        return String(val);
    }
}