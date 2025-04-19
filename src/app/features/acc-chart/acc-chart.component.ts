import { Component, inject, ChangeDetectionStrategy, signal, WritableSignal, computed, Signal, effect } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // Import the module
import { MovesenseService, AccelerometerData } from '../../core/services/movesense.service';
import { ChartData, ChartSeriesData } from '../hr-chart/hr-chart.component'; // Reuse chart interfaces

const MAX_ACC_DATA_POINTS = 100; // Keep history for accelerometer

@Component({
    selector: 'app-acc-chart',
    templateUrl: './acc-chart.component.html',
    styleUrls: ['./acc-chart.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgxChartsModule], // Import the module for standalone components
    // standalone: true is default
})
export class AccChartComponent {
    private readonly movesenseService = inject(MovesenseService);

    // --- Chart Data Signal ---
    // Holds data for X, Y, Z axes
    readonly chartData: WritableSignal<ChartData[]> = signal([
        { name: 'X', series: [] },
        { name: 'Y', series: [] },
        { name: 'Z', series: [] }
    ]);

    // --- Chart Configuration ---
    readonly view: [number, number] = [700, 300]; // Chart dimensions
    readonly legend: boolean = true; // Show legend for X, Y, Z
    readonly showXAxisLabel: boolean = true;
    readonly showYAxisLabel: boolean = true;
    readonly xAxisLabel: string = 'Time';
    readonly yAxisLabel: string = 'Acceleration (m/s²)'; // Assuming units, adjust if needed
    readonly timeline: boolean = true;
    readonly colorScheme = { // Example color scheme for 3 axes
        name: 'accScheme',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#FF0000', '#00FF00', '#0000FF'] // Red, Green, Blue for X, Y, Z
    };
    readonly autoScale = true; // Auto-scale Y-axis

    // Expose connection status
    readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;

    constructor() {
        // Effect to update chart when new Accelerometer data arrives
        // Note: Acc data might arrive in batches. This assumes the service provides an array.
        effect(() => {
            const newAccDataArray = this.movesenseService.accelerometerData(); // Get latest Acc data array
            if (newAccDataArray && this.isConnected() && newAccDataArray.length > 0) {
                // Process the last sample in the array for simplicity,
                // or loop through all if needed (might impact performance)
                this.updateChart(newAccDataArray[newAccDataArray.length - 1]);
            }
        }, { allowSignalWrites: true });

        // Effect to clear chart data when disconnected
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
            const timestamp = new Date(newData.timestamp); // Use Date object

            const newSeriesX = [...currentChartData[0].series, { name: timestamp, value: newData.x }].slice(-MAX_ACC_DATA_POINTS);
            const newSeriesY = [...currentChartData[1].series, { name: timestamp, value: newData.y }].slice(-MAX_ACC_DATA_POINTS);
            const newSeriesZ = [...currentChartData[2].series, { name: timestamp, value: newData.z }].slice(-MAX_ACC_DATA_POINTS);

            return [
                { name: 'X', series: newSeriesX },
                { name: 'Y', series: newSeriesY },
                { name: 'Z', series: newSeriesZ }
            ];
        });
    }

    // Optional: Custom date formatting for x-axis ticks
    xAxisTickFormatting(val: string | Date): string {
        if (val instanceof Date) {
            return val.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }); // Include milliseconds
        }
        return String(val);
    }
}