import { effect, inject, Injectable, Signal } from '@angular/core';

import { MovesenseConnectionService } from './movesense-connection.service';

import {
    AccelerometerData,
    EcgData,
    GyroscopeData,
    HeartRateData,
    MagnetometerData,
    MOVESENSE_COMMANDS,
    PostureState,
    SensorStatus,
    TemperatureData
} from './models/movesense.model';
import { MovesenseDataProcessorService } from './movesense-data-processor.service';
import { MovesenseLoggerService } from './movesense-logger.service';

/**
 * Main Movesense service that coordinates connection and data processing
 */
@Injectable({
    providedIn: 'root',
})
export class MovesenseService {
    private connectionService = inject(MovesenseConnectionService);
    private dataProcessor = inject(MovesenseDataProcessorService);
    private logger = inject(MovesenseLoggerService);

    // Sensor data monitoring timer
    private sensorMonitorTimer: any = null;

    constructor() {
        console.log('MovesenseService initialized');

        // Monitor connection state
        effect(() => {
            if (this.isConnected()) {
                this.setupSensorMonitoring();
            } else {
                this.clearSensorMonitoring();
            }
        });
    }

    // --- Public API: Connection Management ---

    /** Connect to Movesense device */
    async connect(): Promise<void> {
        console.log('Connecting to Movesense device...');
        try {
            await this.connectionService.connect();

            // Register notification handler
            if (this.isConnected()) {
                this.connectionService.registerNotificationHandler(this.handleNotification.bind(this));

                // Start activity tracking for metrics
                this.dataProcessor.startActivity();

                // Subscribe to sensors
                this.subscribeToSensors();
            }
        } catch (error) {
            console.error('Error connecting to Movesense device:', error);
            this.logger.error('Failed to connect to Movesense', error);
        }
    }

    /** Disconnect from device */
    async disconnect(): Promise<void> {
        console.log('Disconnecting from Movesense device...');
        await this.connectionService.disconnect();
    }

    /** Subscribe to available sensors */
    subscribeToSensors(): void {
        if (!this.isConnected()) {
            console.warn('Cannot subscribe to sensors: Not connected');
            return;
        }

        console.log('Subscribing to sensors...');
        this.logger.log('Subscribing to all available sensors...');

        // Use the device-specific command format
        this.connectionService.subscribeToSensors();
    }

    // --- Public API: ECG Recording ---

    /** Start recording ECG data */
    startEcgRecording(): void {
        this.dataProcessor.startEcgRecording();
    }

    /** Stop recording ECG data */
    stopEcgRecording(): void {
        this.dataProcessor.stopEcgRecording();
    }

    // --- Public API: Debug Functions ---

    /** Clear log entries */
    clearLog(): void {
        this.logger.clearLogs();
    }

    /** Try specific format from original app */
    trySpecificFormat(): void {
        if (!this.isConnected()) {
            this.logger.log('Cannot try specific format - not connected');
            return;
        }

        this.logger.log('Trying specific format for this device model...');

        // Send commands in the specific format
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ACCELEROMETER, 'Accelerometer (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.HEART_RATE, 'Heart rate (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.GYROSCOPE, 'Gyroscope (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer (specific format)');
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG (specific format)');
    }

    // --- Connection Signals (proxying from connectionService) ---

    /** Is the device connected */
    get isConnected(): Signal<boolean> {
        return this.connectionService.isConnected;
    }

    /** Connected device name */
    get deviceName(): Signal<string> {
        return this.connectionService.deviceName;
    }

    /** Connection error if any */
    get connectionError(): Signal<string | null> {
        return this.connectionService.connectionError;
    }

    // --- Sensor Data Signals (proxying from dataProcessor) ---

    /** Temperature data */
    get temperatureData(): Signal<TemperatureData | null> {
        return this.dataProcessor.temperatureData;
    }

    /** Accelerometer data */
    get accelerometerData(): Signal<AccelerometerData | null> {
        return this.dataProcessor.accelerometerData;
    }

    /** Heart rate data */
    get heartRateData(): Signal<HeartRateData | null> {
        return this.dataProcessor.heartRateData;
    }

    /** ECG data */
    get ecgData(): Signal<EcgData | null> {
        return this.dataProcessor.ecgData;
    }

    /** Gyroscope data */
    get gyroscopeData(): Signal<GyroscopeData | null> {
        return this.dataProcessor.gyroscopeData;
    }

    /** Magnetometer data */
    get magnetometerData(): Signal<MagnetometerData | null> {
        return this.dataProcessor.magnetometerData;
    }

    // --- Calculated Metrics Signals (proxying from dataProcessor) ---

    /** Step count */
    get steps(): Signal<number> {
        return this.dataProcessor.steps;
    }

    /** Distance in meters */
    get distance(): Signal<number> {
        return this.dataProcessor.distance;
    }

    /** Current posture */
    get posture(): Signal<PostureState> {
        return this.dataProcessor.posture;
    }

    /** HRV RMSSD value */
    get hrvRmssd(): Signal<number | null> {
        return this.dataProcessor.hrvRmssd;
    }

    /** Stress level (0-100) */
    get stressLevel(): Signal<number | null> {
        return this.dataProcessor.stressLevel;
    }

    /** Dribble count */
    get dribbleCount(): Signal<number> {
        return this.dataProcessor.dribbleCount;
    }

    /** Calories burned */
    get caloriesBurned(): Signal<number> {
        return this.dataProcessor.caloriesBurned;
    }

    /** Fall detected status */
    get fallDetected(): Signal<boolean> {
        return this.dataProcessor.fallDetected;
    }

    /** Last fall timestamp */
    get lastFallTimestamp(): Signal<number | null> {
        return this.dataProcessor.lastFallTimestamp;
    }

    // --- Sensor Status Signals (proxying from dataProcessor) ---

    /** Temperature sensor status */
    get temperatureStatus(): Signal<SensorStatus> {
        return this.dataProcessor.temperatureStatus;
    }

    /** Accelerometer sensor status */
    get accelerometerStatus(): Signal<SensorStatus> {
        return this.dataProcessor.accelerometerStatus;
    }

    /** Heart rate sensor status */
    get heartRateStatus(): Signal<SensorStatus> {
        return this.dataProcessor.heartRateStatus;
    }

    /** Gyroscope sensor status */
    get gyroscopeStatus(): Signal<SensorStatus> {
        return this.dataProcessor.gyroscopeStatus;
    }

    /** Magnetometer sensor status */
    get magnetometerStatus(): Signal<SensorStatus> {
        return this.dataProcessor.magnetometerStatus;
    }

    /** ECG sensor status */
    get ecgStatus(): Signal<SensorStatus> {
        return this.dataProcessor.ecgStatus;
    }

    // --- ECG Recording Signals (proxying from dataProcessor) ---

    /** ECG recording active status */
    get isEcgRecording(): Signal<boolean> {
        return this.dataProcessor.isEcgRecording;
    }

    /** Recorded ECG samples */
    get recordedEcgSamples(): Signal<number[]> {
        return this.dataProcessor.recordedEcgSamples;
    }

    // --- Debug Log (proxying from logger) ---

    /** Debug log entries */
    get debugLog(): Signal<string[]> {
        return this.logger.logEntries;
    }

    // --- Private Methods ---

    /**
     * Handle notification from device
     */
    private handleNotification(event: Event): void {
        try {
            const characteristic = (event.target as BluetoothRemoteGATTCharacteristic);
            const dataView = characteristic.value;

            if (!dataView) {
                console.warn('Received empty notification');
                return;
            }

            const data = new Uint8Array(dataView.buffer);

            if (data.length === 0) return;

            // Log the raw data for debugging
            console.log(`Recibido datos RAW: ${this.logger.bufferToHex(data)} (${data.length} bytes)`);

            // Send to data processor
            this.dataProcessor.processNotification(data);
        } catch (error) {
            console.error('Error handling notification:', error);
            this.logger.error('Error handling notification', error);
        }
    }

    /**
     * Setup sensor monitoring
     */
    private setupSensorMonitoring(): void {
        this.clearSensorMonitoring();

        // Check active sensors periodically and try to resubscribe if needed
        this.sensorMonitorTimer = setInterval(() => {
            if (!this.isConnected()) {
                this.clearSensorMonitoring();
                return;
            }

            const activeCount = this.dataProcessor.getActiveSensorCount();
            console.log(`Active sensors: ${activeCount}`);

            // If we have few active sensors, try the specific format commands
            if (activeCount < 3) {
                console.log('Few active sensors detected, trying specific format commands');
                this.trySpecificFormat();
            }

        }, 10000); // Check every 10 seconds
    }

    /**
     * Clear sensor monitoring
     */
    private clearSensorMonitoring(): void {
        if (this.sensorMonitorTimer) {
            clearInterval(this.sensorMonitorTimer);
            this.sensorMonitorTimer = null;
        }
    }
}