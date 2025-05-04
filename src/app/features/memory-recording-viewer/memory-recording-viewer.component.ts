// src/app/features/memory-recording-viewer/memory-recording-viewer.component.ts
import { Component, Input, inject, signal, computed, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts';
import { MovesenseService } from '../../core/services/movesense.service';
import { StoredMemoryRecording } from '../../core/models/memory-recording.model';

interface ChartData {
  name: string;
  series: ChartSeriesData[];
}

interface ChartSeriesData {
  name: string | Date;
  value: number;
}

@Component({
  selector: 'app-memory-recording-viewer',
  standalone: true,
  imports: [CommonModule, NgxChartsModule],
  templateUrl: './memory-recording-viewer.component.html',
  styleUrl: './memory-recording-viewer.component.scss'
})
export class MemoryRecordingViewerComponent implements OnChanges {
  @Input() recordingId = '';

  private movesenseService = inject(MovesenseService);

  // Component state signals
  readonly recordingData = signal<StoredMemoryRecording | null>(null);
  readonly chartData = signal<ChartData[]>([]);
  readonly selectedMetric = signal<string>('accelerometer');

  // Available metrics
  readonly availableMetrics = computed(() => {
    const recording = this.recordingData();
    if (!recording) return [];

    const metrics: { id: string, name: string }[] = [];

    if (recording.sensorData.accelerometer?.length) {
      metrics.push({ id: 'accelerometer', name: 'Acelerómetro' });
    }

    if (recording.sensorData.temperature?.length) {
      metrics.push({ id: 'temperature', name: 'Temperatura' });
    }

    if (recording.sensorData.heartRate?.length) {
      metrics.push({ id: 'heartRate', name: 'Ritmo Cardíaco' });
    }

    if (recording.sensorData.gyroscope?.length) {
      metrics.push({ id: 'gyroscope', name: 'Giroscopio' });
    }

    if (recording.sensorData.magnetometer?.length) {
      metrics.push({ id: 'magnetometer', name: 'Magnetómetro' });
    }

    if (recording.sensorData.ecg?.length) {
      metrics.push({ id: 'ecg', name: 'ECG' });
    }

    return metrics;
  });

  // Chart configuration
  readonly view: [number, number] = [700, 300];
  readonly legend = true;
  readonly showXAxisLabel = true;
  readonly showYAxisLabel = true;
  readonly xAxisLabel = 'Tiempo';
  readonly yAxisLabel = signal<string>('Valor');
  readonly timeline = true;
  readonly autoScale = true;
  readonly colorScheme = {
    name: 'memoryRecordingScheme',
    selectable: true,
    group: ScaleType.Ordinal,
    domain: ['#FF0000', '#00FF00', '#0000FF']
  };

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recordingId']) {
      this.loadRecordingData();
    }
  }

  private loadRecordingData(): void {
    if (!this.recordingId) {
      this.recordingData.set(null);
      this.chartData.set([]);
      return;
    }

    const recording = this.movesenseService.getMemoryRecordingById(this.recordingId);

    if (!recording) {
      this.recordingData.set(null);
      this.chartData.set([]);
      return;
    }

    this.recordingData.set(recording);
    this.updateChartData();
  }

  selectMetric(metricId: string): void {
    this.selectedMetric.set(metricId);
    this.updateChartData();
  }

  private updateChartData(): void {
    const recording: any = this.recordingData();
    if (!recording) {
      this.chartData.set([]);
      return;
    }

    const metricId = this.selectedMetric();
    console.log(`Procesando datos para: ${metricId}`, recording);

    // Verificar si hay datos para el sensor seleccionado
    const sensorData = recording.sensorData[metricId];
    if (!sensorData || (Array.isArray(sensorData) && sensorData.length === 0)) {
      console.log(`No hay datos para ${metricId}`);
      this.chartData.set([]);
      return;
    }

    // Procesar datos según el tipo de sensor
    switch (metricId) {
      case 'accelerometer':
        this.generateAccelerometerChart(recording);
        this.yAxisLabel.set('Aceleración (m/s²)');
        break;
      case 'temperature':
        this.generateTemperatureChart(recording);
        this.yAxisLabel.set('Temperatura (°C)');
        break;
      case 'heartRate':
        this.generateHeartRateChart(recording);
        this.yAxisLabel.set('Ritmo Cardíaco (BPM)');
        break;
      case 'gyroscope':
        this.generateGyroscopeChart(recording);
        this.yAxisLabel.set('Velocidad Angular (°/s)');
        break;
      case 'magnetometer':
        this.generateMagnetometerChart(recording);
        this.yAxisLabel.set('Campo Magnético (µT)');
        break;
      case 'ecg':
        this.generateEcgChart(recording);
        this.yAxisLabel.set('ECG (mV)');
        break;
      default:
        this.chartData.set([]);
    }
  }

  private generateAccelerometerChart(recording: StoredMemoryRecording): void {
    const accData = recording.sensorData.accelerometer;
    if (!accData || accData.length === 0) {
      this.chartData.set([]);
      return;
    }

    const seriesX: ChartSeriesData[] = [];
    const seriesY: ChartSeriesData[] = [];
    const seriesZ: ChartSeriesData[] = [];

    accData.forEach(data => {
      const timestamp = new Date(data[0]);
      seriesX.push({ name: timestamp, value: data[1] });
      seriesY.push({ name: timestamp, value: data[2] });
      seriesZ.push({ name: timestamp, value: data[3] });
    });

    this.chartData.set([
      { name: 'X', series: seriesX },
      { name: 'Y', series: seriesY },
      { name: 'Z', series: seriesZ }
    ]);
  }

  private generateTemperatureChart(recording: StoredMemoryRecording): void {
    const tempData = recording.sensorData.temperature;
    if (!tempData || tempData.length === 0) {
      this.chartData.set([]);
      return;
    }

    const series: ChartSeriesData[] = [];
    const baseTime = recording.timestamp;

    tempData.forEach((value, index) => {
      const timestamp = new Date(baseTime + index * 1000);
      series.push({ name: timestamp, value });
    });

    this.chartData.set([{ name: 'Temperatura', series }]);
  }

  private generateHeartRateChart(recording: StoredMemoryRecording): void {
    const hrData = recording.sensorData.heartRate;
    if (!hrData || hrData.length === 0) {
      this.chartData.set([]);
      return;
    }

    const series: ChartSeriesData[] = [];
    const baseTime = recording.timestamp;

    hrData.forEach((value, index) => {
      const timestamp = new Date(baseTime + index * 1000);
      series.push({ name: timestamp, value });
    });

    this.chartData.set([{ name: 'Ritmo Cardíaco', series }]);
  }

  private generateGyroscopeChart(recording: StoredMemoryRecording): void {
    const gyroData = recording.sensorData.gyroscope;
    if (!gyroData || gyroData.length === 0) {
      this.chartData.set([]);
      return;
    }

    const seriesX: ChartSeriesData[] = [];
    const seriesY: ChartSeriesData[] = [];
    const seriesZ: ChartSeriesData[] = [];

    gyroData.forEach(data => {
      const timestamp = new Date(data[0]);
      seriesX.push({ name: timestamp, value: data[1] });
      seriesY.push({ name: timestamp, value: data[2] });
      seriesZ.push({ name: timestamp, value: data[3] });
    });

    this.chartData.set([
      { name: 'X', series: seriesX },
      { name: 'Y', series: seriesY },
      { name: 'Z', series: seriesZ }
    ]);
  }

  private generateMagnetometerChart(recording: StoredMemoryRecording): void {
    const magnData = recording.sensorData.magnetometer;
    if (!magnData || magnData.length === 0) {
      this.chartData.set([]);
      return;
    }

    const seriesX: ChartSeriesData[] = [];
    const seriesY: ChartSeriesData[] = [];
    const seriesZ: ChartSeriesData[] = [];

    magnData.forEach(data => {
      const timestamp = new Date(data[0]);
      seriesX.push({ name: timestamp, value: data[1] });
      seriesY.push({ name: timestamp, value: data[2] });
      seriesZ.push({ name: timestamp, value: data[3] });
    });

    this.chartData.set([
      { name: 'X', series: seriesX },
      { name: 'Y', series: seriesY },
      { name: 'Z', series: seriesZ }
    ]);
  }

  private generateEcgChart(recording: StoredMemoryRecording): void {
    const ecgData = recording.sensorData.ecg;
    if (!ecgData || ecgData.length === 0) {
      this.chartData.set([]);
      return;
    }

    const series: ChartSeriesData[] = [];
    const baseTime = recording.timestamp;
    const sampleRate = 128; // Hz para ECG
    const timePerSampleMs = 1000 / sampleRate;

    ecgData.forEach((value, index) => {
      const timestamp = new Date(baseTime + index * timePerSampleMs);
      series.push({ name: timestamp, value });
    });

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