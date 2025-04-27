import { Component, inject, signal, computed, effect } from '@angular/core';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { CommonModule } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';
import { HeartRateData } from '../../core/models/sensor-data.model';

// Interfaces para formato de datos del gráfico
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
    imports: [NgxChartsModule, CommonModule]
})
export class HrChartComponent {
    private movesenseService = inject(MovesenseService);

    // Signal para datos del gráfico
    readonly chartData = signal<ChartData[]>([{ name: 'Ritmo Cardíaco', series: [] }]);

    // Configuración del gráfico
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

    // Computed signal para el estado de conexión
    readonly isConnected = computed(() => this.movesenseService.isConnected());

    constructor() {
        // Effect para actualizar datos del gráfico cuando llegan nuevos datos de HR
        effect(() => {
            const newHrData = this.movesenseService.heartRateData();
            if (newHrData && this.isConnected()) {
                this.updateChart(newHrData);
            }
        });

        // Effect para limpiar datos del gráfico al desconectar
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

            // Añadir nuevo punto y limitar longitud de historial
            const updatedSeries = [...series, newPoint].slice(-MAX_DATA_POINTS);

            return [{ name: 'Ritmo Cardíaco', series: updatedSeries }];
        });
    }

    // Formateo personalizado para ticks del eje X
    xAxisTickFormatting(val: string | Date): string {
        if (val instanceof Date) {
            return val.toLocaleTimeString();
        }
        return String(val);
    }
}