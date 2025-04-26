import { Injectable, signal, WritableSignal, computed } from '@angular/core';
import {
    AccelerometerData,
    TemperatureData,
    HeartRateData,
    EcgData,
    GyroscopeData,
    MagnetometerData,
    ImuData,
    SensorStatus,
    PostureState
} from './models/movesense.model';
import { MovesenseLoggerService } from './movesense-logger.service';



/**
 * Service for processing sensor data from Movesense device
 */
@Injectable({
    providedIn: 'root',
})
export class MovesenseDataProcessorService {
    // --- Sensor Data Signals ---
    readonly temperatureData: WritableSignal<TemperatureData | null> = signal(null);
    readonly accelerometerData: WritableSignal<AccelerometerData | null> = signal(null);
    readonly heartRateData: WritableSignal<HeartRateData | null> = signal(null);
    readonly ecgData: WritableSignal<EcgData | null> = signal(null);
    readonly gyroscopeData: WritableSignal<GyroscopeData | null> = signal(null);
    readonly magnetometerData: WritableSignal<MagnetometerData | null> = signal(null);

    // --- Sensor Status ---
    readonly temperatureStatus: WritableSignal<SensorStatus> = signal('inactive');
    readonly accelerometerStatus: WritableSignal<SensorStatus> = signal('inactive');
    readonly heartRateStatus: WritableSignal<SensorStatus> = signal('inactive');
    readonly gyroscopeStatus: WritableSignal<SensorStatus> = signal('inactive');
    readonly magnetometerStatus: WritableSignal<SensorStatus> = signal('inactive');
    readonly ecgStatus: WritableSignal<SensorStatus> = signal('inactive');

    // --- Calculated Metrics Signals ---
    readonly steps = signal(0);
    readonly distance = signal(0); // In meters
    readonly posture = signal<PostureState>(PostureState.UNKNOWN);
    readonly hrvRmssd = signal<number | null>(null); // HRV Root Mean Square of Successive Differences
    readonly stressLevel = signal<number | null>(null); // 0-100 scale based on HRV
    readonly dribbleCount = signal(0);
    readonly caloriesBurned = signal(0); // Rough estimate
    readonly fallDetected = signal(false); // Fall detection status
    readonly lastFallTimestamp = signal<number | null>(null); // When the last fall was detected

    // --- ECG Recording State ---
    readonly isEcgRecording = signal(false);
    readonly recordedEcgSamples = signal<number[]>([]); // Stores recorded raw samples

    // --- Activity Tracking ---
    private _rrHistory: number[] = []; // For HRV calculation
    private _lastStepTimestamp = 0; // For step cadence calculation
    private _gravity = { x: 0, y: 0, z: 0 }; // Estimated gravity vector
    private _isFirstAccSample = true;
    private _lastDribbleTimestamp = 0; // For dribble cadence calculation
    private _activityStartTime = 0; // To track duration for calorie calc

    // --- Data Monitoring ---
    private _lastDataTimestamps: Record<string, number> = {}; // Track last data time for each sensor

    constructor(private logger: MovesenseLoggerService) {
        console.log('MovesenseDataProcessorService initialized');
    }

    /**
     * Process notification data from device
     */
    processNotification(data: Uint8Array): void {
        if (data.length < 1) return;

        console.log(`Processing notification data: ${this.logger.bufferToHex(data)}`);

        // Try to identify the sensor type by common patterns

        // First, check typical 2-byte header patterns
        if (data.length >= 2) {
            const header = (data[0] << 8) | data[1];

            // Recognized header patterns from the old code
            if (header === 0x0162 || header === 0x0101) {
                // Temperature data pattern
                this.processTemperatureData(data.slice(2));
                return;
            } else if (header === 0x0c62 || header === 0x0c02) {
                // Accelerometer data pattern
                this.processAccelerometerData(data.slice(2));
                return;
            } else if (header === 0x0c63 || header === 0x0c03) {
                // Heart rate data pattern
                this.processHeartRateData(data.slice(2));
                return;
            } else if (header === 0x0c64 || header === 0x0c04) {
                // Gyroscope data pattern
                this.processGyroscopeData(data.slice(2));
                return;
            } else if (header === 0x0c65 || header === 0x0c05) {
                // Magnetometer data pattern
                this.processMagnetometerData(data.slice(2));
                return;
            } else if (header === 0x0163 || header === 0x0106) {
                // ECG data pattern
                this.processEcgData(data.slice(2));
                return;
            }
        }

        // Next, try to identify by the data size/content

        // Temperature often has a small payload (1-2 bytes for the value)
        if (data.length <= 4) {
            const value = data.length >= 2 ?
                new DataView(data.buffer).getInt16(0, true) / 100 :
                data[0];

            if (value >= 15 && value <= 45) { // Typical human temperature range
                this.processTemperatureData(new Uint8Array([value]));
                return;
            }

            // Heart rate is also small and in a specific range
            if (value >= 40 && value <= 220) { // Typical human HR range
                this.processHeartRateData(new Uint8Array([value]));
                return;
            }
        }

        // Accelerometer, gyroscope, magnetometer all have 3-axis data
        if (data.length >= 6) {
            // Try to parse as 3-axis data with 2-byte values
            this.processUnknownThreeAxisData(data);
            return;
        }

        // ECG data is typically larger
        if (data.length > 20) {
            this.processEcgData(data);
            return;
        }

        console.log(`Unidentified data format: ${this.logger.bufferToHex(data)}`);
    }

    /**
     * Process temperature data
     */
    processTemperatureData(data: Uint8Array): void {
        try {
            // Extract temperature value - support different formats
            let temperature: number;

            if (data.length >= 4) {
                // Float format
                temperature = new DataView(data.buffer).getFloat32(0, true);
            } else if (data.length >= 2) {
                // Int16 format (scale by 100)
                temperature = new DataView(data.buffer).getInt16(0, true) / 100;
            } else if (data.length >= 1) {
                // Single byte format
                temperature = data[0];
            } else {
                console.warn('Temperature data too short');
                return;
            }

            // Apply sanity check
            if (temperature < 10 || temperature > 50) {
                console.warn(`Temperature value out of range: ${temperature}°C`);
                return;
            }

            this.temperatureData.set({
                timestamp: Date.now(),
                measurement: temperature
            });

            this._lastDataTimestamps['temperature'] = Date.now();
            this.temperatureStatus.set('active');

            console.log(`Temperature: ${temperature.toFixed(1)}°C`);
        } catch (error) {
            console.error('Error processing temperature data:', error);
            this.temperatureStatus.set('error');
        }
    }

    /**
     * Process accelerometer data
     */
    processAccelerometerData(data: Uint8Array): void {
        try {
            let x: number, y: number, z: number;

            if (data.length >= 6) {
                // 2-byte per axis format
                const dataView = new DataView(data.buffer);
                x = dataView.getInt16(0, true) / 1000; // Scale to G
                y = dataView.getInt16(2, true) / 1000;
                z = dataView.getInt16(4, true) / 1000;
            } else if (data.length >= 3) {
                // 1-byte per axis format
                x = (data[0] - 128) / 16; // Scale and center
                y = (data[1] - 128) / 16;
                z = (data[2] - 128) / 16;
            } else {
                console.warn('Accelerometer data too short');
                return;
            }

            // Process for step detection, etc.
            this.processAccelSample(x, y, z);

            const magnitude = Math.sqrt(x * x + y * y + z * z);

            this.accelerometerData.set({
                timestamp: Date.now(),
                x, y, z,
                magnitude,
                samples: [{ x, y, z }]
            });

            this._lastDataTimestamps['accelerometer'] = Date.now();
            this.accelerometerStatus.set('active');

            console.log(`Accelerometer: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]G, mag=${magnitude.toFixed(2)}G`);
        } catch (error) {
            console.error('Error processing accelerometer data:', error);
            this.accelerometerStatus.set('error');
        }
    }

    /**
     * Process gyroscope data
     */
    processGyroscopeData(data: Uint8Array): void {
        try {
            let x: number, y: number, z: number;

            if (data.length >= 6) {
                // 2-byte per axis format
                const dataView = new DataView(data.buffer);
                x = dataView.getInt16(0, true) / 100; // Scale to deg/s
                y = dataView.getInt16(2, true) / 100;
                z = dataView.getInt16(4, true) / 100;
            } else if (data.length >= 3) {
                // 1-byte per axis format
                x = data[0] - 128; // Scale and center
                y = data[1] - 128;
                z = data[2] - 128;
            } else {
                console.warn('Gyroscope data too short');
                return;
            }

            this.gyroscopeData.set({
                timestamp: Date.now(),
                samples: [{ x, y, z }]
            });

            this._lastDataTimestamps['gyroscope'] = Date.now();
            this.gyroscopeStatus.set('active');

            console.log(`Gyroscope: [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]°/s`);
        } catch (error) {
            console.error('Error processing gyroscope data:', error);
            this.gyroscopeStatus.set('error');
        }
    }

    /**
     * Process magnetometer data
     */
    processMagnetometerData(data: Uint8Array): void {
        try {
            let x: number, y: number, z: number;

            if (data.length >= 6) {
                // 2-byte per axis format
                const dataView = new DataView(data.buffer);
                x = dataView.getInt16(0, true) / 10; // Scale to µT
                y = dataView.getInt16(2, true) / 10;
                z = dataView.getInt16(4, true) / 10;
            } else if (data.length >= 3) {
                // 1-byte per axis format
                x = (data[0] - 128) * 4; // Scale and center
                y = (data[1] - 128) * 4;
                z = (data[2] - 128) * 4;
            } else {
                console.warn('Magnetometer data too short');
                return;
            }

            this.magnetometerData.set({
                timestamp: Date.now(),
                samples: [{ x, y, z }]
            });

            this._lastDataTimestamps['magnetometer'] = Date.now();
            this.magnetometerStatus.set('active');

            console.log(`Magnetometer: [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]µT`);
        } catch (error) {
            console.error('Error processing magnetometer data:', error);
            this.magnetometerStatus.set('error');
        }
    }

    /**
     * Process heart rate data
     */
    processHeartRateData(data: Uint8Array): void {
        try {
            let heartRate: number;

            if (data.length >= 2) {
                // 2-byte format
                heartRate = new DataView(data.buffer).getUint16(0, true);
            } else if (data.length >= 1) {
                // 1-byte format
                heartRate = data[0];
            } else {
                console.warn('Heart rate data too short');
                return;
            }

            // Apply sanity check
            if (heartRate < 30 || heartRate > 240) {
                console.warn(`Heart rate value out of range: ${heartRate} BPM`);
                return;
            }

            this.heartRateData.set({
                timestamp: Date.now(),
                hr: heartRate
            });

            // Update derived metrics
            this.updateCalories(heartRate);

            this._lastDataTimestamps['heartrate'] = Date.now();
            this.heartRateStatus.set('active');

            console.log(`Heart Rate: ${heartRate} BPM`);
        } catch (error) {
            console.error('Error processing heart rate data:', error);
            this.heartRateStatus.set('error');
        }
    }

    /**
     * Process ECG data
     */
    processEcgData(data: Uint8Array): void {
        try {
            const samples: number[] = [];

            if (data.length >= 2) {
                // Process as series of samples
                for (let i = 0; i < Math.floor(data.length / 2); i++) {
                    const offset = i * 2;
                    if (offset + 1 < data.length) {
                        const sample = new DataView(data.buffer).getInt16(offset, true);
                        samples.push(sample);
                    }
                }
            } else if (data.length >= 1) {
                // Single sample
                samples.push(data[0]);
            } else {
                console.warn('ECG data too short');
                return;
            }

            if (samples.length === 0) return;

            this.ecgData.set({
                timestamp: Date.now(),
                samples
            });

            // If recording is active, add these samples
            if (this.isEcgRecording()) {
                this.recordedEcgSamples.update(existing => [...existing, ...samples]);
            }

            this._lastDataTimestamps['ecg'] = Date.now();
            this.ecgStatus.set('active');

            console.log(`ECG: ${samples.length} samples`);
        } catch (error) {
            console.error('Error processing ECG data:', error);
            this.ecgStatus.set('error');
        }
    }

    /**
     * Process unknown three-axis data
     */
    processUnknownThreeAxisData(data: Uint8Array): void {
        try {
            let x: number, y: number, z: number;

            if (data.length >= 6) {
                // 2-byte per axis format
                const dataView = new DataView(data.buffer);
                x = dataView.getInt16(0, true) / 1000; // Scale factor
                y = dataView.getInt16(2, true) / 1000;
                z = dataView.getInt16(4, true) / 1000;
            } else if (data.length >= 3) {
                // 1-byte per axis format
                x = (data[0] - 128) / 16; // Scale and center
                y = (data[1] - 128) / 16;
                z = (data[2] - 128) / 16;
            } else {
                return; // Not enough data
            }

            // Determine which sensor by magnitude
            const magnitude = Math.sqrt(x * x + y * y + z * z);

            if (magnitude < 20) {
                // Likely accelerometer (G range typically < 16G)
                this.accelerometerData.set({
                    timestamp: Date.now(),
                    x, y, z,
                    magnitude
                });

                // Process for features
                this.processAccelSample(x, y, z);

                this.accelerometerStatus.set('active');
                this._lastDataTimestamps['accelerometer'] = Date.now();
                console.log(`Identified as accelerometer: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]G`);
            } else if (magnitude < 1000) {
                // Likely gyroscope (deg/s range typically < 1000)
                this.gyroscopeData.set({
                    timestamp: Date.now(),
                    samples: [{ x, y, z }]
                });
                this.gyroscopeStatus.set('active');
                this._lastDataTimestamps['gyroscope'] = Date.now();
                console.log(`Identified as gyroscope: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]°/s`);
            } else {
                // Likely magnetometer (can have larger values)
                this.magnetometerData.set({
                    timestamp: Date.now(),
                    samples: [{ x, y, z }]
                });
                this.magnetometerStatus.set('active');
                this._lastDataTimestamps['magnetometer'] = Date.now();
                console.log(`Identified as magnetometer: [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}]µT`);
            }
        } catch (error) {
            console.error('Error processing unknown three-axis data:', error);
        }
    }

    /**
     * Process acceleration sample for step detection and posture
     */
    private processAccelSample(x: number, y: number, z: number): void {
        // Update gravity vector using a simple low-pass filter
        if (this._isFirstAccSample) {
            this._gravity = { x, y, z };
            this._isFirstAccSample = false;
        } else {
            // Low-pass filter with alpha = 0.1
            const alpha = 0.1;
            this._gravity.x = this._gravity.x * (1 - alpha) + x * alpha;
            this._gravity.y = this._gravity.y * (1 - alpha) + y * alpha;
            this._gravity.z = this._gravity.z * (1 - alpha) + z * alpha;
        }

        // Remove gravity component to get linear acceleration
        const linearAccX = x - this._gravity.x;
        const linearAccY = y - this._gravity.y;
        const linearAccZ = z - this._gravity.z;

        // Calculate magnitude of linear acceleration
        const magnitude = Math.sqrt(
            Math.pow(linearAccX, 2) +
            Math.pow(linearAccY, 2) +
            Math.pow(linearAccZ, 2)
        );

        // Get current time for timing calculations
        const now = Date.now();

        // ---- Step detection ----
        const stepThreshold = 0.5; // G force threshold for step
        const stepCooldown = 350; // Minimum time between steps (ms)

        if (magnitude > stepThreshold && (now - this._lastStepTimestamp) > stepCooldown) {
            this._lastStepTimestamp = now;
            this.steps.update(steps => steps + 1);

            // Update distance (assuming 0.7m stride length - can be personalized)
            this.distance.update(distance => distance + 0.7);
            console.log(`Step detected - total: ${this.steps()}, distance: ${this.distance().toFixed(1)}m`);
        }

        // ---- Basketball dribble detection ----
        const dribbleThreshold = 1.8; // Higher threshold for dribble
        const dribbleCooldown = 150; // Shorter cooldown for faster dribble rate

        if (magnitude > dribbleThreshold && (now - this._lastDribbleTimestamp) > dribbleCooldown) {
            this._lastDribbleTimestamp = now;
            this.dribbleCount.update(count => count + 1);
            console.log(`Dribble detected - total: ${this.dribbleCount()}`);
        }

        // ---- Posture detection ----
        const verticalAngle = Math.atan2(
            Math.sqrt(this._gravity.x * this._gravity.x + this._gravity.y * this._gravity.y),
            this._gravity.z
        ) * (180 / Math.PI);

        const newPosture = verticalAngle < 30
            ? PostureState.STANDING
            : verticalAngle < 75
                ? PostureState.STOOPED
                : PostureState.LYING;

        if (this.posture() !== newPosture) {
            console.log(`Posture changed to ${newPosture}, angle: ${verticalAngle.toFixed(1)}°`);
        }

        this.posture.set(newPosture);

        // ---- Fall detection ----
        const fallThreshold = 2.5; // G force
        const fallWindow = 1000; // ms

        if (magnitude > fallThreshold) {
            const currentTime = Date.now();
            console.log(`Possible fall detected! Magnitude: ${magnitude.toFixed(2)}G`);
            this.fallDetected.set(true);
            this.lastFallTimestamp.set(currentTime);

            // Reset fall detection after a delay
            setTimeout(() => {
                if (this.lastFallTimestamp() === currentTime) {
                    this.fallDetected.set(false);
                }
            }, fallWindow);
        }
    }

    /**
     * Update calorie burn estimate based on heart rate
     */
    private updateCalories(heartRate: number): void {
        // Skip if no heart rate or invalid
        if (!heartRate || heartRate < 40 || heartRate > 240) return;

        // Initialize activity start time if needed
        if (this._activityStartTime === 0) {
            this._activityStartTime = Date.now();
        }

        // Get activity duration in hours
        const activityDurationHours = (Date.now() - this._activityStartTime) / 3600000;

        // Simple calories burned calculation using heart rate
        // Default values (can be personalized)
        const weight = 70; // kg
        const age = 30;
        const isMale = true;

        // Keytel formula constants
        const gender = isMale ? 1 : 0;

        // Calories per minute
        const caloriesPerMinute = ((-55.0969 + (0.6309 * heartRate) + (0.1988 * weight) + (0.2017 * age)) / 4.184) * (gender ? 1 : 0.85);

        // Total calories
        const totalCalories = caloriesPerMinute * (activityDurationHours * 60);

        // Update the calorie signal
        this.caloriesBurned.set(Math.round(totalCalories));
        console.log(`Calories updated: ${Math.round(totalCalories)} kcal (duration: ${(activityDurationHours * 60).toFixed(1)} min)`);
    }

    /**
     * Start recording ECG data
     */
    startEcgRecording(): void {
        this.recordedEcgSamples.set([]); // Clear previous recording
        this.isEcgRecording.set(true);
        console.log('Started ECG Recording');
    }

    /**
     * Stop recording ECG data
     */
    stopEcgRecording(): void {
        if (!this.isEcgRecording()) return;
        this.isEcgRecording.set(false);
        console.log(`Stopped ECG Recording. Samples recorded: ${this.recordedEcgSamples().length}`);
    }

    /**
     * Get current sensor status as an object
     */
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

    /**
     * Get active sensor count
     */
    getActiveSensorCount(): number {
        const statuses = this.getSensorStatus();
        return Object.values(statuses).filter(status => status === 'active').length;
    }

    /**
     * Update sensor start time for calorie counting
     */
    startActivity(): void {
        this._activityStartTime = Date.now();
        console.log('Activity timing started');
    }

    /**
     * Reset service state
     */
    resetState(): void {
        // Reset all sensor data
        this.temperatureData.set(null);
        this.accelerometerData.set(null);
        this.heartRateData.set(null);
        this.ecgData.set(null);
        this.gyroscopeData.set(null);
        this.magnetometerData.set(null);

        // Reset calculated metrics
        this.steps.set(0);
        this.distance.set(0);
        this.posture.set(PostureState.UNKNOWN);
        this.hrvRmssd.set(null);
        this.stressLevel.set(null);
        this._rrHistory = [];
        this._lastStepTimestamp = 0;
        this._gravity = { x: 0, y: 0, z: 0 };
        this._isFirstAccSample = true;
        this.dribbleCount.set(0);
        this._lastDribbleTimestamp = 0;
        this.caloriesBurned.set(0);
        this._activityStartTime = 0;

        // Reset sensor status
        this.temperatureStatus.set('inactive');
        this.accelerometerStatus.set('inactive');
        this.heartRateStatus.set('inactive');
        this.gyroscopeStatus.set('inactive');
        this.magnetometerStatus.set('inactive');
        this.ecgStatus.set('inactive');

        // Clear ECG recording
        this.isEcgRecording.set(false);
        this.recordedEcgSamples.set([]);

        // Reset fall detection
        this.fallDetected.set(false);
        this.lastFallTimestamp.set(null);

        // Clear timestamp tracking
        this._lastDataTimestamps = {};

        console.log('Data processor state reset');
    }
}