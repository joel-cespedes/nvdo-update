export interface AccelerometerData {
    timestamp: number;
    x: number;
    y: number;
    z: number;
    magnitude: number;
    samples?: { x: number; y: number; z: number }[];
}

export interface TemperatureData {
    timestamp: number;
    measurement: number; // En Celsius
}

export interface HeartRateData {
    timestamp: number;
    hr: number; // Promedio HR (BPM)
    rrIntervals?: number[]; // Intervalos RR en ms
}

export interface EcgData {
    timestamp: number;
    samples: number[];
}

export interface GyroscopeData {
    timestamp: number;
    samples: { x: number; y: number; z: number }[];
}

export interface MagnetometerData {
    timestamp: number;
    samples: { x: number; y: number; z: number }[];
}

export type SensorStatus = 'inactive' | 'active' | 'error';

export enum PostureState {
    UNKNOWN = 'unknown',
    STANDING = 'standing',
    STOOPED = 'stooped',
    LYING = 'lying'
}

// Constantes para límites de sensores - importante para validación
export const SENSOR_LIMITS = {
    HR_MIN: 40,
    HR_MAX: 200,
    TEMP_MIN: 0,
    TEMP_MAX: 50,
    ACC_MAX: 20, // Valor típico para acelerómetro en m/s²
};