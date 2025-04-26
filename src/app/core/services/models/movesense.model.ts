/**
 * Modelos para los diferentes tipos de datos de sensores Movesense
 */

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

// Define UUIDs for Movesense BLE service and characteristics
export const MOVESENSE_BLE = {
    SERVICE_UUID: '34802252-7185-4d5d-b431-630e7050e8f0',
    CHAR_COMMAND_UUID: '34800001-7185-4d5d-b431-630e7050e8f0', // Write
    CHAR_NOTIFY_UUID: '34800002-7185-4d5d-b431-630e7050e8f0',  // Notify
};

// Specific commands for Movesense device
export const MOVESENSE_COMMANDS = {
    TEMPERATURE: new Uint8Array([0x01, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x54, 0x65, 0x6d, 0x70]),
    ACCELEROMETER: new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x31, 0x30, 0x34]),
    HEART_RATE: new Uint8Array([0x0c, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x48, 0x52]),
    ECG: new Uint8Array([0x01, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x45, 0x43, 0x47, 0x2f, 0x31, 0x32, 0x35]),
    GYROSCOPE: new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x31, 0x30, 0x34]),
    MAGNETOMETER: new Uint8Array([0x0c, 0x65, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x4d, 0x61, 0x67, 0x6e, 0x2f, 0x31, 0x30, 0x34])
};