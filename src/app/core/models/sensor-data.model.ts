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
    measurement: number; // In Celsius
}

export interface HeartRateData {
    timestamp: number;
    hr: number; // Average HR (BPM)
    rrIntervals?: number[]; // RR intervals in ms
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

export interface ImuData {
    timestamp: number;
    samples: {
        acc: { x: number; y: number; z: number };
        gyro: { x: number; y: number; z: number };
        magn: { x: number; y: number; z: number };
    }[];
}

export type SensorStatus = 'inactive' | 'active' | 'error';

export enum PostureState {
    UNKNOWN = 'unknown',
    STANDING = 'standing',
    STOOPED = 'stooped',
    LYING = 'lying'
}