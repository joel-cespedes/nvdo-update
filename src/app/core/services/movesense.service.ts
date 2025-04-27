import { effect, computed, inject, Injectable, Signal } from '@angular/core';
import { MovesenseConnectionService } from './movesense-connection.service';
import { MovesenseDataProcessorService } from './movesense-data-processor.service';
import { EcgStorageService } from './ecg-storage.service';
import { MOVESENSE_COMMANDS } from '../models/movesense-commands.model';
import { SensorStatus } from '../models/sensor-data.model';

@Injectable({
    providedIn: 'root',
})
export class MovesenseService {
    // Servicios inyectados
    private connectionService = inject(MovesenseConnectionService);
    private dataProcessor = inject(MovesenseDataProcessorService);
    private ecgStorage = inject(EcgStorageService);

    // Timer para monitoreo de sensores
    private sensorMonitorTimer: any = null;

    // Estado de grabación ECG
    readonly isRecording = computed(() => this.dataProcessor.isEcgRecording());
    readonly recordedSamples = computed(() => this.dataProcessor.recordedEcgSamples());
    readonly storedEcgs = computed(() => this.ecgStorage.storedEcgs());
    readonly hasStoredEcgs = computed(() => this.ecgStorage.hasStoredEcgs());

    constructor() {
        // Monitorear estado de conexión
        effect(() => {
            if (this.isConnected()) {
                this.setupSensorMonitoring();
            } else {
                this.clearSensorMonitoring();
            }
        });
    }

    // --- API Pública: Gestión de Conexión ---

    async connect(): Promise<void> {
        try {
            await this.connectionService.connect();

            // Registrar manejador de notificaciones
            if (this.isConnected()) {
                this.connectionService.registerNotificationHandler(this.handleNotification.bind(this));

                // Iniciar seguimiento de actividad para métricas
                this.dataProcessor.startActivity();

                // Suscribirse a sensores
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

    // --- API Pública: Grabación ECG ---

    startEcgRecording(): void {
        this.dataProcessor.startEcgRecording();
    }

    stopEcgRecording(): void {
        this.dataProcessor.stopEcgRecording();

        // Guardar las muestras en localStorage
        if (this.recordedSamples().length > 0) {
            this.ecgStorage.saveEcg(this.recordedSamples());
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

    // --- API Pública: Funciones de Depuración ---

    trySpecificFormat(): void {
        if (!this.isConnected()) return;

        // Enviar comandos en el formato específico
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ACCELEROMETER, 'Accelerometer (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.HEART_RATE, 'Heart rate (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.GYROSCOPE, 'Gyroscope (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG (specific format)');
    }

    // --- Signals de Conexión ---

    get isConnected(): Signal<boolean> {
        return this.connectionService.isConnected;
    }

    get deviceName(): Signal<string> {
        return this.connectionService.deviceName;
    }

    get connectionError(): Signal<string | null> {
        return this.connectionService.connectionError;
    }

    // --- Signals de Datos de Sensores ---

    get temperatureData() {
        return this.dataProcessor.temperatureData;
    }

    get accelerometerData() {
        return this.dataProcessor.accelerometerData;
    }

    get heartRateData() {
        return this.dataProcessor.heartRateData;
    }

    get ecgData() {
        return this.dataProcessor.ecgData;
    }

    get gyroscopeData() {
        return this.dataProcessor.gyroscopeData;
    }

    get magnetometerData() {
        return this.dataProcessor.magnetometerData;
    }

    // --- Signals de Métricas Calculadas ---

    get steps() {
        return this.dataProcessor.steps;
    }

    get distance() {
        return this.dataProcessor.distance;
    }

    get posture() {
        return this.dataProcessor.posture;
    }

    get hrvRmssd() {
        return this.dataProcessor.hrvRmssd;
    }

    get stressLevel() {
        return this.dataProcessor.stressLevel;
    }

    get dribbleCount() {
        return this.dataProcessor.dribbleCount;
    }

    get caloriesBurned() {
        return this.dataProcessor.caloriesBurned;
    }

    get fallDetected() {
        return this.dataProcessor.fallDetected;
    }

    get lastFallTimestamp() {
        return this.dataProcessor.lastFallTimestamp;
    }

    // --- Signals de Estado de Sensores ---

    get temperatureStatus() {
        return this.dataProcessor.temperatureStatus;
    }

    get accelerometerStatus() {
        return this.dataProcessor.accelerometerStatus;
    }

    get heartRateStatus() {
        return this.dataProcessor.heartRateStatus;
    }

    get gyroscopeStatus() {
        return this.dataProcessor.gyroscopeStatus;
    }

    get magnetometerStatus() {
        return this.dataProcessor.magnetometerStatus;
    }

    get ecgStatus() {
        return this.dataProcessor.ecgStatus;
    }

    get isEcgRecording() {
        return this.dataProcessor.isEcgRecording;
    }

    get recordedEcgSamples() {
        return this.dataProcessor.recordedEcgSamples;
    }

    // --- Métodos Privados ---

    private handleNotification(event: Event): void {
        try {
            const characteristic = (event.target as BluetoothRemoteGATTCharacteristic);
            const dataView = characteristic.value;

            if (!dataView) {
                return;
            }

            const data = new Uint8Array(dataView.buffer);

            if (data.length === 0) return;

            // Enviar al procesador de datos
            this.dataProcessor.processNotification(data);
        } catch (error) {
            console.error('Error handling notification:', error);
        }
    }

    private setupSensorMonitoring(): void {
        this.clearSensorMonitoring();

        // Comprobar sensores activos periódicamente y tratar de volver a suscribirse si es necesario
        this.sensorMonitorTimer = setInterval(() => {
            if (!this.isConnected()) {
                this.clearSensorMonitoring();
                return;
            }

            const activeCount = this.dataProcessor.getActiveSensorCount();

            // Si tenemos pocos sensores activos, probar los comandos de formato específico
            if (activeCount < 3) {
                this.trySpecificFormat();
            }

        }, 10000); // Comprueba cada 10 segundos
    }

    private clearSensorMonitoring(): void {
        if (this.sensorMonitorTimer) {
            clearInterval(this.sensorMonitorTimer);
            this.sensorMonitorTimer = null;
        }
    }
}