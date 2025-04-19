import { Component, inject, ChangeDetectionStrategy, signal, WritableSignal, computed, Signal, effect } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // Import the module
import { MovesenseService, EcgData } from '../../core/services/movesense.service';
import { ChartData, ChartSeriesData } from '../hr-chart/hr-chart.component'; // Reuse chart interfaces

const MAX_ECG_DATA_POINTS = 500; // Keep a larger history for ECG, adjust as needed for performance

@Component({
    selector: 'app-ecg-chart',
    templateUrl: './ecg-chart.component.html',
    styleUrls: ['./ecg-chart.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NgxChartsModule], // Import the module for standalone components
    // standalone: true is default
})
export class EcgChartComponent {
    private readonly movesenseService = inject(MovesenseService);

    // --- Chart Data Signal ---
    // Holds data for the ECG signal
    readonly chartData: WritableSignal<ChartData[]> = signal([
        { name: 'ECG', series: [] }
    ]);

    // --- Chart Configuration ---
    readonly view: [number, number] = [700, 300]; // Chart dimensions
    readonly legend: boolean = false; // No legend needed for single series
    readonly showXAxisLabel: boolean = true;
    readonly showYAxisLabel: boolean = true;
    readonly xAxisLabel: string = 'Time';
    readonly yAxisLabel: string = 'ECG (mV)'; // Assuming units, adjust based on actual data
    readonly timeline: boolean = true;
    readonly colorScheme = { // Example color scheme for ECG
        name: 'ecgScheme',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#00BCD4'] // Cyan color for ECG
    };
    // Consider disabling autoScale if the range is relatively fixed or jumps too much
    readonly autoScale = true;

    // Expose connection status
    readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;

    constructor() {
        // Effect to update chart when new ECG data arrives
        // Note: ECG data likely arrives in batches (multiple samples per notification)
        effect(() => {
            const newEcgData = this.movesenseService.ecgData(); // Get latest ECG data object
            if (newEcgData && this.isConnected() && newEcgData.samples.length > 0) {
                this.updateChart(newEcgData);
            }
        }, { allowSignalWrites: true });

        // Effect to clear chart data when disconnected
        effect(() => {
            if (!this.isConnected()) {
                this.chartData.set([{ name: 'ECG', series: [] }]);
            }
        });
    }

    // This needs careful implementation based on how timestamps relate to samples
    private updateChart(newData: EcgData): void {
        this.chartData.update(currentChartData => {
            const currentSeries = currentChartData[0].series;
            const newPoints: ChartSeriesData[] = [];

            // ASSUMPTION: Timestamp applies to the FIRST sample in the batch.
            // We need to estimate timestamps for subsequent samples based on sample rate (e.g., 128Hz).
            const sampleRateHz = 128; // Example rate - THIS MUST BE KNOWN/CONFIGURABLE
            const timePerSampleMs = 1000 / sampleRateHz;
            let currentTimestampMs = newData.timestamp; // Assuming timestamp is milliseconds epoch

            for (const sample of newData.samples) {
                newPoints.push({
                    name: new Date(currentTimestampMs),
                    value: sample // Assuming the sample value is directly usable (e.g., mV)
                });
                currentTimestampMs += timePerSampleMs; // Increment timestamp for next sample
            }

            // Add new data points and limit history length
            const updatedSeries = [...currentSeries, ...newPoints].slice(-MAX_ECG_DATA_POINTS);

            return [{ name: 'ECG', series: updatedSeries }];
        });
    }

    // Optional: Custom date formatting for x-axis ticks
    xAxisTickFormatting(val: string | Date): string {
        if (val instanceof Date) {
            // Show milliseconds for ECG precision
            return val.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
        }
        return String(val);
    }
}