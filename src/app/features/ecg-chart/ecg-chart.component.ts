import { Component, inject, signal, computed, effect } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { CommonModule } from '@angular/common';
import { EcgData } from '../../core/models/sensor-data.model';
import { MovesenseService } from '../../core/services/movesense.service';

const MAX_ECG_DATA_POINTS = 500;

interface ChartData {
    name: string;
    series: ChartSeriesData[];
}

interface ChartSeriesData {
    name: string | Date;
    value: number;
}

@Component({
    selector: 'app-ecg-chart',
    templateUrl: './ecg-chart.component.html',
    styleUrls: ['./ecg-chart.component.scss'],
    imports: [NgxChartsModule, CommonModule]
})
export class EcgChartComponent {
    private movesenseService = inject(MovesenseService);

    // Signals de datos
    readonly chartData = signal<ChartData[]>([
        { name: 'ECG', series: [] }
    ]);

    // Signals de grabación
    readonly hasStoredEcgs = computed(() => this.movesenseService.hasStoredEcgs());

    // Configuración del chart
    readonly view: [number, number] = [700, 300];
    readonly legend = false;
    readonly showXAxisLabel = true;
    readonly showYAxisLabel = true;
    readonly xAxisLabel = 'Tiempo';
    readonly yAxisLabel = 'ECG (mV)';
    readonly timeline = true;
    readonly colorScheme = {
        name: 'ecgScheme',
        selectable: true,
        group: ScaleType.Ordinal,
        domain: ['#00BCD4']
    };
    readonly autoScale = true;

    // Exponer signals de conexión y grabación
    readonly isConnected = computed(() => this.movesenseService.isConnected());
    readonly isRecording = computed(() => this.movesenseService.isEcgRecording());

    constructor() {
        // Effect para actualizar chart cuando hay nuevos datos de ECG
        effect(() => {
            const newEcgData = this.movesenseService.ecgData();
            if (newEcgData && this.isConnected() && newEcgData.samples.length > 0) {
                this.updateChart(newEcgData);
            }
        });

        // Effect para limpiar datos del chart cuando se desconecta
        effect(() => {
            if (!this.isConnected()) {
                this.chartData.set([{ name: 'ECG', series: [] }]);
            }
        });
    }

    private updateChart(newData: EcgData): void {
        this.chartData.update(currentChartData => {
            const currentSeries = currentChartData[0].series;
            const newPoints: ChartSeriesData[] = [];

            // La frecuencia de muestreo debe ser conocida
            const sampleRateHz = 128;
            const timePerSampleMs = 1000 / sampleRateHz;
            let currentTimestampMs = newData.timestamp;

            for (const sample of newData.samples) {
                newPoints.push({
                    name: new Date(currentTimestampMs),
                    value: sample
                });
                currentTimestampMs += timePerSampleMs;
            }

            // Añadir nuevos puntos y limitar longitud de historial
            const updatedSeries = [...currentSeries, ...newPoints].slice(-MAX_ECG_DATA_POINTS);

            return [{ name: 'ECG', series: updatedSeries }];
        });
    }

    // Formateo de ejes
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

    // Métodos de control de grabación
    startRecording(): void {
        this.movesenseService.startEcgRecording();
    }

    stopRecording(): void {
        this.movesenseService.stopEcgRecording();
    }
}