import { Component, inject, ChangeDetectionStrategy, signal, WritableSignal, computed, Signal, effect } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // Import the module
import { MovesenseService } from '../../core/services/movesense.service';
import { ChartData, ChartSeriesData } from '../hr-chart/hr-chart.component'; // Reuse chart interfaces
import { AccelerometerData } from '../../core/services/models/movesense.model';

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
            const newAccDataObject = this.movesenseService.accelerometerData(); // Get latest Acc data object
            // Check if the object exists, we are connected, and the samples array is not empty
            if (newAccDataObject && this.isConnected()) {
                // Pass the whole object to updateChart
                this.updateChart(newAccDataObject);
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
            // Create a single new data point since AccelerometerData has a single x, y, z reading
            const timestamp = new Date(newData.timestamp);

            const newPointX: ChartSeriesData = { name: timestamp, value: newData.x };
            const newPointY: ChartSeriesData = { name: timestamp, value: newData.y };
            const newPointZ: ChartSeriesData = { name: timestamp, value: newData.z };

            // Add new points and limit history
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

    // Optional: Custom date formatting for x-axis ticks
    xAxisTickFormatting(val: string | Date): string {
        if (val instanceof Date) {
            return val.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }); // Include milliseconds
        }
        return String(val);
    }
}