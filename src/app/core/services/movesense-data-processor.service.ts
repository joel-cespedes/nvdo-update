import { Injectable, inject, linkedSignal, signal } from '@angular/core';
import {
    AccelerometerData, TemperatureData, HeartRateData,
    EcgData, GyroscopeData, MagnetometerData,
    SensorStatus, SENSOR_LIMITS
} from '../models/sensor-data.model';
import { ActivityDataProcessorService } from './activity-data-processor.service';
import { DATA_CONSTANTS } from '../models/movesense-commands.model';

@Injectable({
    providedIn: 'root',
})
export class MovesenseDataProcessorService {
    private activityProcessor = inject(ActivityDataProcessorService);

    // Señales de datos de sensores
    readonly temperatureData = signal<TemperatureData | null>(null);
    readonly accelerometerData = signal<AccelerometerData | null>(null);
    readonly heartRateData = signal<HeartRateData | null>(null);
    readonly ecgData = signal<EcgData | null>(null);
    readonly gyroscopeData = signal<GyroscopeData | null>(null);
    readonly magnetometerData = signal<MagnetometerData | null>(null);

    // Señales de estado de sensores
    readonly temperatureStatus = signal<SensorStatus>('inactive');
    readonly accelerometerStatus = signal<SensorStatus>('inactive');
    readonly heartRateStatus = signal<SensorStatus>('inactive');
    readonly gyroscopeStatus = signal<SensorStatus>('inactive');
    readonly magnetometerStatus = signal<SensorStatus>('inactive');
    readonly ecgStatus = signal<SensorStatus>('inactive');

    // Señales para grabación de ECG
    readonly isEcgRecording = signal<boolean>(false);
    readonly recordedEcgSamples = signal<number[]>([]);

    // Enlaces a señales de ActivityDataProcessor
    readonly steps = linkedSignal(this.activityProcessor.steps);
    readonly distance = linkedSignal(this.activityProcessor.distance);
    readonly posture = linkedSignal(this.activityProcessor.posture);
    readonly hrvRmssd = linkedSignal(this.activityProcessor.hrvRmssd);
    readonly stressLevel = linkedSignal(this.activityProcessor.stressLevel);
    readonly dribbleCount = linkedSignal(this.activityProcessor.dribbleCount);
    readonly caloriesBurned = linkedSignal(this.activityProcessor.caloriesBurned);
    readonly fallDetected = linkedSignal(this.activityProcessor.fallDetected);
    readonly lastFallTimestamp = linkedSignal(this.activityProcessor.lastFallTimestamp);

    // Seguimiento de actualizaciones de datos
    private _lastDataTimestamps: Record<string, number> = {};
    private _lastEcgTimestamp = 0;

    /**
       * Inicia una nueva actividad y resetea los datos
       */
    startActivity(): void {
        this.activityProcessor.startActivity();
        // También podemos reiniciar el estado de los sensores si es necesario
        this.resetState();
    }


    /**
     * Procesa datos de notificación recibidos del dispositivo
     */
    processNotification(data: Uint8Array): void {
        if (data.length < 1) return;

        // Identificar el tipo de mensaje según su estructura
        const msgType = data[0];
        const resourceId = data.length > 1 ? data[1] : 0;

        console.log(`Procesando notificación - tipo: ${msgType}, resourceId: ${resourceId}, longitud: ${data.length}`);

        // Analizar tipo de datos
        switch (resourceId) {
            case 0x62: // Temperatura o Acelerómetro
                if (msgType === 0x01) {
                    this.processTemperatureData(data);
                } else if (msgType === 0x02) {
                    this.processAccelerometerData(data);
                }
                break;

            case 0x63: // Ritmo Cardíaco o ECG - Identificador específico para ECG
                console.log('Detectados datos de ECG/HR, analizando formato...');

                if (msgType === 0x01 || msgType === 0x02) {
                    // Verificar si es mensaje ECG - tiene estructura distinta
                    const isEcgData = (data.length % 2 === 0) ||
                        (data.length >= 3 && data[2] === 0xEC) ||
                        (data.length >= 3 && data[2] >= 0xF0);

                    if (isEcgData) {
                        console.log('Formato identificado como ECG, procesando...');
                        this.processEcgData(data);
                    } else {
                        this.processHeartRateData(data);
                    }
                } else {
                    // Intentar procesar como ECG por defecto en caso de duda
                    console.log('Formato no identificado, intentando como ECG...');
                    this.processEcgData(data);
                }
                break;

            // ... resto igual ...
        }
    }

    /**
     * Procesa datos de temperatura
     */
    processTemperatureData(data: Uint8Array): void {
        try {
            let temperature: number;

            if (data.length >= 4) {
                temperature = new DataView(data.buffer).getFloat32(0, true);
            } else if (data.length >= 2) {
                temperature = new DataView(data.buffer).getInt16(0, true) / 100;
            } else if (data.length >= 1) {
                temperature = data[0];
                // Ajustar temperaturas negativas en formato 2's complement
                if (temperature > 127) {
                    temperature = temperature - 256;
                }
            } else {
                return;
            }

            // Validar que la temperatura esté en un rango razonable
            if (temperature < SENSOR_LIMITS.TEMP_MIN || temperature > SENSOR_LIMITS.TEMP_MAX) {
                // Ajustar la temperatura si está fuera del rango esperado
                temperature = Math.max(SENSOR_LIMITS.TEMP_MIN,
                    Math.min(SENSOR_LIMITS.TEMP_MAX, temperature));
            }

            this.temperatureData.set({
                timestamp: Date.now(),
                measurement: temperature
            });

            this._lastDataTimestamps['temperature'] = Date.now();
            this.temperatureStatus.set('active');
        } catch (error) {
            console.error('Error procesando datos de temperatura:', error);
            this.temperatureStatus.set('error');
        }
    }

    /**
     * Procesa datos de acelerómetro
     */
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
                // Formato comprimido - cada byte representa un valor de aceleración
                x = (data[0] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;
                y = (data[1] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;
                z = (data[2] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;
                samples = [{ x, y, z }];
            } else {
                return;
            }

            // Procesar para actividad (pasos, postura, etc.)
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
            console.error('Error procesando datos de acelerómetro:', error);
            this.accelerometerStatus.set('error');
        }
    }

    /**
     * Procesa datos de giroscopio
     */
    processGyroscopeData(data: Uint8Array): void {
        try {
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
            } else if (data.length >= 3) {
                // Formato comprimido
                const x = (data[0] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;
                const y = (data[1] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;
                const z = (data[2] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;
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
            console.error('Error procesando datos de giroscopio:', error);
            this.gyroscopeStatus.set('error');
        }
    }

    /**
     * Procesa datos de magnetómetro
     */
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
            } else if (data.length >= 3) {
                // Formato comprimido
                const x = (data[0] - 128) * DATA_CONSTANTS.MAGNETOMETER_SCALE;
                const y = (data[1] - 128) * DATA_CONSTANTS.MAGNETOMETER_SCALE;
                const z = (data[2] - 128) * DATA_CONSTANTS.MAGNETOMETER_SCALE;
                samples.push({ x, y, z });
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
            console.error('Error procesando datos de magnetómetro:', error);
            this.magnetometerStatus.set('error');
        }
    }

    /**
     * Procesa datos de ritmo cardíaco
     */
    processHeartRateData(data: Uint8Array): void {
        try {
            let heartRate: number;

            if (data.length >= 2) {
                heartRate = new DataView(data.buffer).getUint16(0, true);
            } else if (data.length >= 1) {
                heartRate = data[0];
            } else {
                return;
            }

            // Validación de rangos
            if (heartRate < SENSOR_LIMITS.HR_MIN || heartRate > SENSOR_LIMITS.HR_MAX) {
                // Limitar a rangos válidos
                heartRate = Math.max(SENSOR_LIMITS.HR_MIN,
                    Math.min(SENSOR_LIMITS.HR_MAX, heartRate));
            }

            this.heartRateData.set({
                timestamp: Date.now(),
                hr: heartRate
            });

            // Actualizar calorías quemadas basadas en HR
            this.activityProcessor.updateCalories(heartRate);

            this._lastDataTimestamps['heartrate'] = Date.now();
            this.heartRateStatus.set('active');
        } catch (error) {
            console.error('Error procesando datos de ritmo cardíaco:', error);
            this.heartRateStatus.set('error');
        }
    }

    /**
  * Procesa datos de ECG para uso médico
  * Implementación optimizada según especificaciones técnicas Movesense
  */
    processEcgData(data: Uint8Array): void {
        try {
            console.log(`Procesando ECG médico, formato [${data[0]},${data[1]}], longitud: ${data.length}`);

            const samples: number[] = [];

            // Factor de conversión específico para los dispositivos Movesense
            // El LSB (Least Significant Bit) para Movesense es 0.38147 µV
            const LSB_UV = 0.38147;

            // Extraer muestras según formato Movesense
            if (data.length >= 4) {
                const dataView = new DataView(data.buffer);

                // Determinar offset según el tipo de mensaje
                let startOffset = 2;
                if (data[0] === 0x02) startOffset = 4;

                // Extraer valores Int16 (según documentación Movesense)
                for (let i = startOffset; i < data.length; i += 2) {
                    if (i + 1 < data.length) {
                        // Convertir dos bytes a Int16 (little-endian)
                        const rawSample = dataView.getInt16(i, true);

                        // El valor crudo es el que debemos almacenar para máxima precisión
                        samples.push(rawSample);
                    }
                }
            }

            if (samples.length === 0) {
                console.log('No se pudieron extraer muestras del paquete ECG');
                return;
            }

            // Actualizar datos ECG
            this.ecgData.set({
                timestamp: Date.now(),
                samples
            });

            // Si estamos grabando ECG, añadir muestras
            if (this.isEcgRecording()) {
                console.log(`Añadiendo ${samples.length} muestras de ECG a la grabación médica`);
                this._lastEcgTimestamp = Date.now();
                this.recordedEcgSamples.update(existing => [...existing, ...samples]);
                console.log(`Total muestras acumuladas: ${this.recordedEcgSamples().length}`);
            }

            this._lastDataTimestamps['ecg'] = Date.now();
            this.ecgStatus.set('active');
        } catch (error) {
            console.error('Error procesando datos ECG médicos:', error);
            this.ecgStatus.set('error');
        }
    }
    /**
     * Intenta identificar el tipo de datos por heurística
     */
    private tryIdentifyDataByHeuristics(data: Uint8Array): void {
        // Analizar los primeros bytes para identificar patrones
        if (data.length >= 4 && data[0] === 0x01 && data[1] === 0x62) {
            // Posible temperatura
            this.processTemperatureData(new Uint8Array(data.buffer, 2));
            return;
        }

        if (data.length >= 6) {
            try {
                const dataView = new DataView(data.buffer);

                // Ver si los valores parecen ser de acelerómetro
                const x = dataView.getInt16(0, true) / 1000;
                const y = dataView.getInt16(2, true) / 1000;
                const z = dataView.getInt16(4, true) / 1000;

                const magnitude = Math.sqrt(x * x + y * y + z * z);

                if (magnitude < SENSOR_LIMITS.ACC_MAX) {
                    // Posible acelerómetro
                    this.processAccelerometerData(data);
                    return;
                } else if (magnitude < 500) {
                    // Posible giroscopio
                    this.processGyroscopeData(data);
                    return;
                } else {
                    // Posible magnetómetro
                    this.processMagnetometerData(data);
                    return;
                }
            } catch (e) {
                // Continuar con otras heurísticas
            }
        }

        if (data.length === 1 && data[0] >= 40 && data[0] <= 200) {
            // Posible ritmo cardíaco
            this.processHeartRateData(data);
            return;
        }
    }

    /**
     * Inicia la grabación de ECG
     */
    startEcgRecording(): void {
        console.log('Iniciando grabación de ECG');
        this.recordedEcgSamples.set([]);
        this.isEcgRecording.set(true);
        this._lastEcgTimestamp = Date.now();
    }

    /**
     * Detiene la grabación de ECG
     */
    stopEcgRecording(): void {
        if (!this.isEcgRecording()) return;

        console.log(`Deteniendo grabación de ECG. Muestras capturadas: ${this.recordedEcgSamples().length}`);
        this.isEcgRecording.set(false);
    }

    /**
       * Obtiene el estado de todos los sensores
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
     * Cuenta cuántos sensores están activos
     */
    getActiveSensorCount(): number {
        const statuses = this.getSensorStatus();
        return Object.values(statuses).filter(status => status === 'active').length;
    }

    /**
     * Reinicia el estado del procesador
     */
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