import { effect, computed, inject, Injectable, linkedSignal } from '@angular/core';
import { MovesenseConnectionService } from './movesense-connection.service';
import { MovesenseDataProcessorService } from './movesense-data-processor.service';
import { EcgStorageService } from './ecg-storage.service';
import { MOVESENSE_COMMANDS } from '../models/movesense-commands.model';
import { SensorStatus, PostureState } from '../models/sensor-data.model';

@Injectable({
    providedIn: 'root',
})
export class MovesenseService {
    private connectionService = inject(MovesenseConnectionService);
    private dataProcessor = inject(MovesenseDataProcessorService);
    private ecgStorage = inject(EcgStorageService);

    private sensorMonitorTimer: number | null = null;

    // Connection Signals
    readonly isConnected = linkedSignal(this.connectionService.isConnected);
    readonly deviceName = linkedSignal(this.connectionService.deviceName);
    readonly connectionError = linkedSignal(this.connectionService.connectionError);

    // Sensor Data Signals
    readonly temperatureData = linkedSignal(this.dataProcessor.temperatureData);
    readonly accelerometerData = linkedSignal(this.dataProcessor.accelerometerData);
    readonly heartRateData = linkedSignal(this.dataProcessor.heartRateData);
    readonly ecgData = linkedSignal(this.dataProcessor.ecgData);
    readonly gyroscopeData = linkedSignal(this.dataProcessor.gyroscopeData);
    readonly magnetometerData = linkedSignal(this.dataProcessor.magnetometerData);

    // Sensor Status Signals
    readonly temperatureStatus = linkedSignal(this.dataProcessor.temperatureStatus);
    readonly accelerometerStatus = linkedSignal(this.dataProcessor.accelerometerStatus);
    readonly heartRateStatus = linkedSignal(this.dataProcessor.heartRateStatus);
    readonly gyroscopeStatus = linkedSignal(this.dataProcessor.gyroscopeStatus);
    readonly magnetometerStatus = linkedSignal(this.dataProcessor.magnetometerStatus);
    readonly ecgStatus = linkedSignal(this.dataProcessor.ecgStatus);

    // Activity Metrics Signals
    readonly steps = linkedSignal(this.dataProcessor.steps);
    readonly distance = linkedSignal(this.dataProcessor.distance);
    readonly posture = linkedSignal(this.dataProcessor.posture);
    readonly hrvRmssd = linkedSignal(this.dataProcessor.hrvRmssd);
    readonly stressLevel = linkedSignal(this.dataProcessor.stressLevel);
    readonly dribbleCount = linkedSignal(this.dataProcessor.dribbleCount);
    readonly caloriesBurned = linkedSignal(this.dataProcessor.caloriesBurned);
    readonly fallDetected = linkedSignal(this.dataProcessor.fallDetected);
    readonly lastFallTimestamp = linkedSignal(this.dataProcessor.lastFallTimestamp);

    // ECG Recording Signals
    readonly isEcgRecording = linkedSignal(this.dataProcessor.isEcgRecording);
    readonly recordedEcgSamples = linkedSignal(this.dataProcessor.recordedEcgSamples);

    // Storage Signals
    readonly storedEcgs = linkedSignal(this.ecgStorage.storedEcgs);
    readonly hasStoredEcgs = linkedSignal(this.ecgStorage.hasStoredEcgs);

    constructor() {
        effect(() => {
            if (this.isConnected()) {
                this.setupSensorMonitoring();
            } else {
                this.clearSensorMonitoring();
            }
        });
    }

    async connect(): Promise<void> {
        try {
            await this.connectionService.connect();

            if (this.isConnected()) {
                this.connectionService.registerNotificationHandler(this.handleNotification.bind(this));
                this.dataProcessor.startActivity();
                this.subscribeToSensors();
            }
        } catch (error) {
            console.error('Error connecting to Movesense device:', error);
        }
    }

    async disconnect(): Promise<void> {
        await this.connectionService.disconnect();
    }

    subscribeToSensors(): void {
        if (!this.isConnected()) return;
        this.connectionService.subscribeToSensors();
    }

    startEcgRecording(): void {
        console.log('Iniciando grabación de ECG en MovesenseService');

        if (this.ecgStatus() !== 'active') {
            console.log('ECG no está activo, enviando comando ECG');
            this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'Activar ECG para grabación');

            setTimeout(() => {
                this.dataProcessor.startEcgRecording();
            }, 1000);
        } else {
            this.dataProcessor.startEcgRecording();
        }
    }

    stopEcgRecording(): void {
        console.log('Deteniendo grabación de ECG en MovesenseService');
        this.dataProcessor.stopEcgRecording();

        const samples = this.recordedEcgSamples();
        console.log(`Intento guardar ECG con ${samples.length} muestras`);

        if (samples.length > 0) {
            try {
                const ecgId = this.ecgStorage.saveEcg(samples);
                console.log(`ECG guardado con ID: ${ecgId}`, {
                    muestras: samples.length,
                    duracion: samples.length / 128
                });
            } catch (error) {
                console.error('Error al guardar ECG:', error);
            }
        } else {
            console.warn('No hay muestras de ECG para guardar');
        }
    }

    saveStoredEcg(name: string, id: string): boolean {
        return this.ecgStorage.renameEcg(id, name);
    }

    deleteStoredEcg(id: string): boolean {
        return this.ecgStorage.deleteEcg(id);
    }

    getEcgById(id: string) {
        return this.ecgStorage.getEcgById(id);
    }

    private handleNotification(event: Event): void {
        try {
            const characteristic = (event.target as BluetoothRemoteGATTCharacteristic);
            const dataView = characteristic.value;

            if (!dataView) {
                return;
            }

            const data = new Uint8Array(dataView.buffer);

            if (data.length === 0) return;

            this.dataProcessor.processNotification(data);
        } catch (error) {
            console.error('Error handling notification:', error);
        }
    }

    private setupSensorMonitoring(): void {
        this.clearSensorMonitoring();

        this.sensorMonitorTimer = window.setInterval(() => {
            if (!this.isConnected()) {
                this.clearSensorMonitoring();
                return;
            }

            const activeCount = this.dataProcessor.getActiveSensorCount();

            if (activeCount < 3) {
                this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature (reconnect)');
                this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ACCELEROMETER, 'Accelerometer (reconnect)');
                this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.HEART_RATE, 'Heart rate (reconnect)');
                this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.GYROSCOPE, 'Gyroscope (reconnect)');
                this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer (reconnect)');
                this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG (reconnect)');
            }
        }, 10000);
    }

    private clearSensorMonitoring(): void {
        if (this.sensorMonitorTimer) {
            window.clearInterval(this.sensorMonitorTimer);
            this.sensorMonitorTimer = null;
        }
    }
}