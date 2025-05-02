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

  private generateChartData(ecg: StoredEcg): void {
    const series: ChartSeriesData[] = [];
    const sampleRateHz = 128; // Assumed sample rate
    const timePerSampleMs = 1000 / sampleRateHz;

    // Take up to 2000 samples for performance
    const maxSamples = 2000;
    const interval = ecg.samples.length > maxSamples ? Math.floor(ecg.samples.length / maxSamples) : 1;

    // Generate timestamp for each sample
    let currentTimestampMs = ecg.timestamp;

    for (let i = 0; i < ecg.samples.length; i += interval) {
      series.push({
        name: new Date(currentTimestampMs),
        value: ecg.samples[i]
      });

      currentTimestampMs += timePerSampleMs * interval;
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