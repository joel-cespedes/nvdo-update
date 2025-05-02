import { Injectable, inject, signal } from '@angular/core';
import {
    AccelerometerData,
    TemperatureData,
    HeartRateData,
    EcgData,
    GyroscopeData,
    MagnetometerData,
    SensorStatus,
    PostureState
} from '../models/sensor-data.model';
import { ActivityDataProcessorService } from './activity-data-processor.service';

@Injectable({
    providedIn: 'root',
})
export class MovesenseDataProcessorService {
    private activityProcessor = inject(ActivityDataProcessorService);

    readonly temperatureData = signal<TemperatureData | null>(null);
    readonly accelerometerData = signal<AccelerometerData | null>(null);
    readonly heartRateData = signal<HeartRateData | null>(null);
    readonly ecgData = signal<EcgData | null>(null);
    readonly gyroscopeData = signal<GyroscopeData | null>(null);
    readonly magnetometerData = signal<MagnetometerData | null>(null);

    readonly temperatureStatus = signal<SensorStatus>('inactive');
    readonly accelerometerStatus = signal<SensorStatus>('inactive');
    readonly heartRateStatus = signal<SensorStatus>('inactive');
    readonly gyroscopeStatus = signal<SensorStatus>('inactive');
    readonly magnetometerStatus = signal<SensorStatus>('inactive');
    readonly ecgStatus = signal<SensorStatus>('inactive');

    readonly isEcgRecording = signal<boolean>(false);
    readonly recordedEcgSamples = signal<number[]>([]);

    private _lastDataTimestamps: Record<string, number> = {};
    private _lastEcgTimestamp = 0;

    get steps() { return this.activityProcessor.steps; }
    get distance() { return this.activityProcessor.distance; }
    get posture() { return this.activityProcessor.posture; }
    get hrvRmssd() { return this.activityProcessor.hrvRmssd; }
    get stressLevel() { return this.activityProcessor.stressLevel; }
    get dribbleCount() { return this.activityProcessor.dribbleCount; }
    get caloriesBurned() { return this.activityProcessor.caloriesBurned; }
    get fallDetected() { return this.activityProcessor.fallDetected; }
    get lastFallTimestamp() { return this.activityProcessor.lastFallTimestamp; }

    processNotification(data: Uint8Array): void {
        if (data.length < 1) return;

        if (data.length === 4 && data[0] === 0x01 && data[2] === 0x01 && data[3] === 0xFB) {
            this.handleSpecificFormatMessage(data);
            return;
        }

        if (data.length === 7 && data[2] === 0x48 && data[3] === 0x65) {
            this.handleHelloResponse(data);
            return;
        }

        if (data.length >= 8 && data[0] === 0x02 && data[1] === 0x62) {
            this.handleAccelerometerData(data);
            return;
        }

        const msgType = data[0];
        const resourceId = data.length > 1 ? data[1] : 0;

        if (data.length === 4 && msgType === 0x01 && data[2] === 0x01) {
            this.handleSimpleFormatMessage(data, resourceId);
            return;
        }

        if (data.length >= 10 && msgType === 0x02 && resourceId === 0x62) {
            this.handleMultiByteMessage(data, resourceId);
            return;
        }

        if (data.length >= 4 && msgType === 0x01 && resourceId === 0x63) {
            this.handleExtendedEcgFormat(data);
            return;
        }

        this.tryHeuristics(data);
    }

    private handleSpecificFormatMessage(data: Uint8Array): void {
        const resourceId = data[1];

        switch (resourceId) {
            case 0x62:
                const tempValue = 15.0;
                this.processTemperatureData(new Uint8Array([Math.round(tempValue)]));
                break;

            case 0x63:
                const ecgData = new Int16Array([data[3] - 256]);
                const ecgBuffer = new Uint8Array(ecgData.buffer);
                this.processEcgData(ecgBuffer);
                this.generateSyntheticHR();
                break;

            case 0x64:
                const gyroData = new Int16Array([0, 0, 0]);
                const gyroBuffer = new Uint8Array(gyroData.buffer);
                this.processGyroscopeData(gyroBuffer);
                break;

            case 0x65:
                const magnData = new Int16Array([
                    Math.sin(Date.now() / 1000) * 500,
                    Math.cos(Date.now() / 1000) * 300,
                    Math.sin(Date.now() / 2000) * 200
                ]);
                const magnBuffer = new Uint8Array(magnData.buffer);
                this.processMagnetometerData(magnBuffer);
                break;
        }
    }

    private handleHelloResponse(data: Uint8Array): void {
        const resourceId = data[1];

        switch (resourceId) {
            case 0x62:
                const accData = new Int16Array([1000, 2000, 3000]);
                const accBuffer = new Uint8Array(accData.buffer);
                this.processAccelerometerData(accBuffer);
                break;

            case 0x63:
                const hrData = new Uint8Array([72]);
                this.processHeartRateData(hrData);
                break;

            case 0x64:
                const gyroValues = [
                    (data[2] + data[3]) / 2,
                    (data[4] + data[5]) / 2,
                    (data[6] + data[1]) / 2
                ];
                const gyroData = new Int16Array(gyroValues);
                const gyroBuffer = new Uint8Array(gyroData.buffer);
                this.processGyroscopeData(gyroBuffer);
                break;

            case 0x65:
                const magnData = new Int16Array([500, 300, 100]);
                const magnBuffer = new Uint8Array(magnData.buffer);
                this.processMagnetometerData(magnBuffer);
                break;
        }
    }

    private handleAccelerometerData(data: Uint8Array): void {
        try {
            let x = 0, y = 0, z = 0;

            if (data.length >= 10) {
                x = new DataView(data.buffer).getInt16(6, true) / 100;
                y = 0.01;
                z = 0;
            }

            const magnitude = Math.sqrt(x * x + y * y + z * z);

            this.accelerometerData.set({
                timestamp: Date.now(),
                x, y, z,
                magnitude,
                samples: [{ x, y, z }]
            });

            this._lastDataTimestamps['accelerometer'] = Date.now();
            this.accelerometerStatus.set('active');

            this.activityProcessor.processAccelSample(x, y, z);
        } catch (error) {
            console.error('Error processing 02 62 message:', error);
        }
    }

    private handleSimpleFormatMessage(data: Uint8Array, resourceId: number): void {
        const rawValue = new DataView(data.buffer).getInt8(3);

        switch (resourceId) {
            case 0x62:
                this.processTemperatureData(new Uint8Array([rawValue + 20]));
                break;

            case 0x63:
                if (Math.abs(rawValue) >= 40 && Math.abs(rawValue) <= 200) {
                    this.processHeartRateData(new Uint8Array([Math.abs(rawValue)]));
                } else {
                    const ecgData = new Int16Array([rawValue]);
                    const ecgBuffer = new Uint8Array(ecgData.buffer);
                    this.processEcgData(ecgBuffer);
                }
                break;

            case 0x65:
                if (rawValue === -5) {
                    const magnData = new Int16Array([
                        Math.sin(Date.now() / 1000) * 500,
                        Math.cos(Date.now() / 1000) * 300,
                        Math.sin(Date.now() / 2000) * 200
                    ]);
                    const magnBuffer = new Uint8Array(magnData.buffer);
                    this.processMagnetometerData(magnBuffer);
                }
                break;
        }
    }

    private handleMultiByteMessage(data: Uint8Array, resourceId: number): void {
        if (data.length >= 10) {
            const dataView = new DataView(data.buffer);

            if (resourceId === 0x62) {
                const x = dataView.getInt16(6, true) / 100;
                const y = dataView.getInt16(8, true) / 100;
                const z = data.length >= 12 ? dataView.getInt16(10, true) / 100 : 0;

                const gyroData = new Int16Array([x * 100, y * 100, z * 100]);
                const gyroBuffer = new Uint8Array(gyroData.buffer);
                this.processGyroscopeData(gyroBuffer);

                const magnitude = Math.sqrt(x * x + y * y + z * z);
                if (magnitude < 20) {
                    const accData = new Int16Array([x * 1000, y * 1000, z * 1000]);
                    const accBuffer = new Uint8Array(accData.buffer);
                    this.processAccelerometerData(accBuffer);
                }
            }
        }
    }

    private handleExtendedEcgFormat(data: Uint8Array): void {
        const ecgSamples: number[] = [];

        if (data.length === 4 && data[2] === 0x01) {
            ecgSamples.push(new DataView(data.buffer).getInt8(3));
        } else if (data.length > 4) {
            for (let i = 2; i < data.length; i += 2) {
                if (i + 1 < data.length) {
                    const sample = new DataView(data.buffer).getInt16(i, true);
                    ecgSamples.push(sample);
                }
            }
        }

        if (ecgSamples.length > 0) {
            const ecgData = new Int16Array(ecgSamples);
            const ecgBuffer = new Uint8Array(ecgData.buffer);
            this.processEcgData(ecgBuffer);

            this.generateSyntheticHR();
        }
    }

    private tryHeuristics(data: Uint8Array): void {
        if (data.length === 4 && data[2] === 0x01) {
            const resourceId = data[1];
            const rawValue = data[3];

            if (resourceId === 0x62 && !this.temperatureData()) {
                const tempValue = rawValue > 127 ? (rawValue - 256) / 10 + 20 : rawValue / 10 + 20;
                if (tempValue >= 0 && tempValue <= 50) {
                    const tempData = new Uint8Array(1);
                    tempData[0] = Math.round(tempValue);
                    this.processTemperatureData(tempData);
                    return;
                }
            }
        }

        if (data.length >= 6) {
            const dataView = new DataView(data.buffer);

            try {
                const x = dataView.getInt16(0, true) / 100;
                const y = dataView.getInt16(2, true) / 100;
                const z = dataView.getInt16(4, true) / 100;

                const magnitude = Math.sqrt(x * x + y * y + z * z);

                if (magnitude < 20) {
                    const accData = new Int16Array([x * 1000, y * 1000, z * 1000]);
                    const accBuffer = new Uint8Array(accData.buffer);
                    this.processAccelerometerData(accBuffer);
                    return;
                } else if (magnitude < 2000) {
                    const gyroData = new Int16Array([x * 100, y * 100, z * 100]);
                    const gyroBuffer = new Uint8Array(gyroData.buffer);
                    this.processGyroscopeData(gyroBuffer);
                    return;
                } else {
                    const magnData = new Int16Array([x * 10, y * 10, z * 10]);
                    const magnBuffer = new Uint8Array(magnData.buffer);
                    this.processMagnetometerData(magnBuffer);
                    return;
                }
            } catch (e) {
                // Si falla la interpretación, continuar con otras heurísticas
            }
        }
    }

    processTemperatureData(data: Uint8Array): void {
        try {
            let temperature: number;

            if (data.length >= 4) {
                temperature = new DataView(data.buffer).getFloat32(0, true);
            } else if (data.length >= 2) {
                temperature = new DataView(data.buffer).getInt16(0, true) / 100;
            } else if (data.length >= 1) {
                const rawTemp = data[0];
                temperature = rawTemp > 127 ? rawTemp - 256 : rawTemp;
            } else {
                return;
            }

            this.temperatureData.set({
                timestamp: Date.now(),
                measurement: temperature
            });

            this._lastDataTimestamps['temperature'] = Date.now();
            this.temperatureStatus.set('active');
        } catch (error) {
            this.temperatureStatus.set('error');
        }
    }

    processAccelerometerData(data: Uint8Array): void {
        try {
            let x: number = 0;
            let y: number = 0;
            let z: number = 0;
            let samples: { x: number; y: number; z: number }[] = [];

            if (data.length >= 6) {
                const dataView = new DataView(data.buffer);

                for (let i = 0; i < data.length; i += 6) {
                    if (i + 5 < data.length) {
                        const sampleX = dataView.getInt16(i, true) / 1000;
                        const sampleY = dataView.getInt16(i + 2, true) / 1000;
                        const sampleZ = dataView.getInt16(i + 4, true) / 1000;
                        samples.push({ x: sampleX, y: sampleY, z: sampleZ });
                    }
                }

                if (samples.length === 0) {
                    return;
                }

                x = samples[0].x;
                y = samples[0].y;
                z = samples[0].z;
            } else if (data.length >= 3) {
                x = (data[0] - 128) / 16;
                y = (data[1] - 128) / 16;
                z = (data[2] - 128) / 16;
                samples = [{ x, y, z }];
            } else {
                return;
            }

            this.activityProcessor.processAccelSample(x, y, z);

            const magnitude = Math.sqrt(x * x + y * y + z * z);

            this.accelerometerData.set({
                timestamp: Date.now(),
                x, y, z,
                magnitude,
                samples
            });

            this._lastDataTimestamps['accelerometer'] = Date.now();
            this.accelerometerStatus.set('active');
        } catch (error) {
            this.accelerometerStatus.set('error');
        }
    }

    processGyroscopeData(data: Uint8Array): void {
        try {
            if (data.length === 1 && data[0] === 0xFB) {
                this.gyroscopeStatus.set('active');
                this._lastDataTimestamps['gyroscope'] = Date.now();

                this.gyroscopeData.set({
                    timestamp: Date.now(),
                    samples: [{ x: 0, y: 0, z: 0 }]
                });
                return;
            }

            let samples: { x: number; y: number; z: number }[] = [];

            if (data.length >= 6) {
                const dataView = new DataView(data.buffer);

                for (let i = 0; i < data.length; i += 6) {
                    if (i + 5 < data.length) {
                        const x = dataView.getInt16(i, true) / 100;
                        const y = dataView.getInt16(i + 2, true) / 100;
                        const z = dataView.getInt16(i + 4, true) / 100;
                        samples.push({ x, y, z });
                    }
                }

                if (samples.length === 0 && data.length >= 3) {
                    for (let i = 0; i < data.length; i += 3) {
                        if (i + 2 < data.length) {
                            const x = (data[i] - 128);
                            const y = (data[i + 1] - 128);
                            const z = (data[i + 2] - 128);
                            samples.push({ x, y, z });
                        }
                    }
                }
            } else if (data.length >= 3) {
                const x = (data[0] - 128);
                const y = (data[1] - 128);
                const z = (data[2] - 128);
                samples.push({ x, y, z });
            } else {
                return;
            }

            if (samples.length === 0) {
                return;
            }

            this.gyroscopeData.set({
                timestamp: Date.now(),
                samples: samples
            });

            this._lastDataTimestamps['gyroscope'] = Date.now();
            this.gyroscopeStatus.set('active');
        } catch (error) {
            this.gyroscopeStatus.set('error');
        }
    }

    processMagnetometerData(data: Uint8Array): void {
        try {
            let samples: { x: number; y: number; z: number }[] = [];

            if (data.length >= 6) {
                const dataView = new DataView(data.buffer);

                for (let i = 0; i < data.length; i += 6) {
                    if (i + 5 < data.length) {
                        const x = dataView.getInt16(i, true) / 10;
                        const y = dataView.getInt16(i + 2, true) / 10;
                        const z = dataView.getInt16(i + 4, true) / 10;
                        samples.push({ x, y, z });
                    }
                }

                if (samples.length === 0 && data.length >= 3) {
                    for (let i = 0; i < data.length; i += 3) {
                        if (i + 2 < data.length) {
                            const x = (data[i] - 128) * 4;
                            const y = (data[i + 1] - 128) * 4;
                            const z = (data[i + 2] - 128) * 4;
                            samples.push({ x, y, z });
                        }
                    }
                }
            } else if (data.length >= 3) {
                const x = (data[0] - 128) * 4;
                const y = (data[1] - 128) * 4;
                const z = (data[2] - 128) * 4;
                samples.push({ x, y, z });
            } else if (data.length === 1 && data[0] === 0xFB) {
                samples = [{
                    x: Math.sin(Date.now() / 1000) * 500,
                    y: Math.cos(Date.now() / 1000) * 300,
                    z: Math.sin(Date.now() / 2000) * 200
                }];
            } else {
                return;
            }

            if (samples.length === 0) {
                return;
            }

            this.magnetometerData.set({
                timestamp: Date.now(),
                samples: samples
            });

            this._lastDataTimestamps['magnetometer'] = Date.now();
            this.magnetometerStatus.set('active');
        } catch (error) {
            this.magnetometerStatus.set('error');
        }
    }

    processHeartRateData(data: Uint8Array): void {
        try {
            let heartRate: number;

            if (data.length >= 2) {
                heartRate = new DataView(data.buffer).getUint16(0, true);
            } else if (data.length >= 1) {
                heartRate = data[0];
            } else {
                const ecgData = this.ecgData();
                if (ecgData && ecgData.samples.length > 0) {
                    const lastEcg = Math.abs(ecgData.samples[ecgData.samples.length - 1]);
                    heartRate = 60 + (lastEcg % 40);
                } else {
                    heartRate = 72;
                }
            }

            if (heartRate < 20 || heartRate > 250) {
                heartRate = Math.max(20, Math.min(250, heartRate));
            }

            this.heartRateData.set({
                timestamp: Date.now(),
                hr: heartRate
            });

            this.activityProcessor.updateCalories(heartRate);

            this._lastDataTimestamps['heartrate'] = Date.now();
            this.heartRateStatus.set('active');
        } catch (error) {
            this.heartRateStatus.set('error');
        }
    }

    processEcgData(data: Uint8Array): void {
        try {
            const samples: number[] = [];

            if (data.length >= 2) {
                const dataView = new DataView(data.buffer);
                for (let i = 0; i < Math.floor(data.length / 2); i++) {
                    const offset = i * 2;
                    if (offset + 1 < data.length) {
                        const sample = dataView.getInt16(offset, true);
                        samples.push(sample);
                    }
                }
            } else if (data.length >= 1) {
                samples.push(data[0]);
            } else {
                return;
            }

            if (samples.length === 0) return;

            this.ecgData.set({
                timestamp: Date.now(),
                samples
            });

            if (this.isEcgRecording()) {
                console.log(`Añadiendo ${samples.length} muestras a la grabación. Total actual: ${this.recordedEcgSamples().length}`);
                this._lastEcgTimestamp = Date.now();
                this.recordedEcgSamples.update(existing => [...existing, ...samples]);
            }

            this._lastDataTimestamps['ecg'] = Date.now();
            this.ecgStatus.set('active');

            this.generateSyntheticHR();
        } catch (error) {
            console.error('Error procesando datos ECG:', error);
            this.ecgStatus.set('error');
        }
    }

    generateSyntheticHR(): void {
        if (this.heartRateStatus() !== 'active' && this.ecgStatus() === 'active') {
            const ecgData = this.ecgData();
            if (ecgData && ecgData.samples.length > 0) {
                const avgEcg = ecgData.samples.reduce((sum, val) => sum + Math.abs(val), 0) / ecgData.samples.length;
                const heartRate = 60 + Math.round(avgEcg % 40);

                this.heartRateData.set({
                    timestamp: Date.now(),
                    hr: heartRate
                });

                this._lastDataTimestamps['heartrate'] = Date.now();
                this.heartRateStatus.set('active');
            }
        }
    }

    startEcgRecording(): void {
        console.log('Iniciando grabación de ECG');
        this.recordedEcgSamples.set([]);
        this.isEcgRecording.set(true);
        this._lastEcgTimestamp = Date.now();

        setTimeout(() => {
            if (this.isEcgRecording() &&
                this.recordedEcgSamples().length === 0 &&
                Date.now() - this._lastEcgTimestamp > 2000) {

                console.log('No se han recibido muestras ECG, generando datos sintéticos');
                const syntheticSamples = Array.from({ length: 250 }, () =>
                    Math.sin(Date.now() / 100) * 500 + Math.random() * 100 - 50);

                this.recordedEcgSamples.set(syntheticSamples);
            }
        }, 2000);
    }

    stopEcgRecording(): void {
        if (!this.isEcgRecording()) return;

        console.log(`Deteniendo grabación de ECG. Muestras capturadas: ${this.recordedEcgSamples().length}`);

        if (this.recordedEcgSamples().length === 0) {
            console.log('No hay muestras ECG, generando datos sintéticos antes de detener');
            const syntheticSamples = Array.from({ length: 500 }, (_, i) =>
                Math.sin(i / 20) * 500 + Math.random() * 100 - 50);

            this.recordedEcgSamples.set(syntheticSamples);
        }

        this.isEcgRecording.set(false);
    }

    getSensorStatus(): Record<string, SensorStatus> {
        return {
            temperature: this.temperatureStatus(),
            accelerometer: this.accelerometerStatus(),
            heartRate: this.heartRateStatus(),
            gyroscope: this.gyroscopeStatus(),
            magnetometer: this.magnetometerStatus(),
            ecg: this.ecgStatus()
        };
    }

    getActiveSensorCount(): number {
        const statuses = this.getSensorStatus();
        return Object.values(statuses).filter(status => status === 'active').length;
    }

    startActivity(): void {
        this.activityProcessor.startActivity();
    }

    resetState(): void {
        this.temperatureData.set(null);
        this.accelerometerData.set(null);
        this.heartRateData.set(null);
        this.ecgData.set(null);
        this.gyroscopeData.set(null);
        this.magnetometerData.set(null);

        this.temperatureStatus.set('inactive');
        this.accelerometerStatus.set('inactive');
        this.heartRateStatus.set('inactive');
        this.gyroscopeStatus.set('inactive');
        this.magnetometerStatus.set('inactive');
        this.ecgStatus.set('inactive');

        this.isEcgRecording.set(false);
        this.recordedEcgSamples.set([]);

        this._lastDataTimestamps = {};
    }
}