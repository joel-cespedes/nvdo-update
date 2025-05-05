import { Component, Input, inject, signal, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { MovesenseService } from '../../core/services/movesense.service';
import { StoredEcg } from '../../core/models/ecg-storage.model';

interface ChartData {
  name: string;
  series: ChartSeriesData[];
}

interface ChartSeriesData {
  name: string | Date;
  value: number;
}

@Component({
  selector: 'app-stored-ecg-viewer',
  standalone: true,
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './stored-ecg-viewer.component.html',
  styleUrl: './stored-ecg-viewer.component.scss'
})
export class StoredEcgViewerComponent implements OnChanges {
  @Input() ecgId = '';

  private movesenseService = inject(MovesenseService);

  // Component state signals
  readonly ecgData = signal<StoredEcg | null>(null);
  readonly chartData = signal<ChartData[]>([{ name: 'ECG', series: [] }]);

  // Chart configuration
  readonly view: [number, number] = [700, 300];
  readonly legend = false;
  readonly showXAxisLabel = true;
  readonly showYAxisLabel = true;
  readonly xAxisLabel = 'Tiempo';
  readonly yAxisLabel = 'ECG (mV)';
  readonly timeline = true;
  readonly autoScale = true;
  readonly colorScheme = {
    name: 'ecgScheme',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#00BCD4']
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ecgId']) {
      this.loadEcgData();
    }
  }

  private loadEcgData(): void {
    if (!this.ecgId) {
      this.ecgData.set(null);
      this.chartData.set([{ name: 'ECG', series: [] }]);
      return;
    }

    const ecg = this.movesenseService.getEcgById(this.ecgId);

    if (!ecg) {
      this.ecgData.set(null);
      this.chartData.set([{ name: 'ECG', series: [] }]);
      return;
    }

    this.ecgData.set(ecg);
    this.generateChartData(ecg);
  }
  /**
   * Genera datos para visualización ECG médica
   * Mantiene precisión para uso clínico
   */
  private generateChartData(ecg: StoredEcg): void {
    const series: ChartSeriesData[] = [];
    const sampleRateHz = 128; // Frecuencia estándar Movesense ECG
    const timePerSampleMs = 1000 / sampleRateHz;

    // Factor de conversión µV específico para Movesense (mantener precisión)
    const LSB_UV = 0.38147;

    if (ecg.samples.length > 0) {
      let currentTimestampMs = ecg.timestamp;

      // Generar visualización con todos los puntos disponibles
      // En aplicaciones médicas es importante no omitir datos
      for (let i = 0; i < ecg.samples.length; i++) {
        const rawValue = ecg.samples[i];

        // Opción 1: Valor crudo (para desarrollo/depuración)
        // const value = rawValue;

        // Opción 2: Valor en µV (para uso médico/clínico)
        const value = rawValue * LSB_UV;

        series.push({
          name: new Date(currentTimestampMs),
          value: value
        });

        currentTimestampMs += timePerSampleMs;
      }
    }

    this.chartData.set([{ name: 'ECG', series }]);
  }
  // Axis formatting
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