export interface StoredMemoryRecording {
    id: string;
    timestamp: number;
    duration: number;
    name?: string;
    sensorData: {
        accelerometer?: number[][];
        temperature?: number[];
        heartRate?: number[];
        gyroscope?: number[][];
        magnetometer?: number[][];
        ecg?: number[];
    };
}