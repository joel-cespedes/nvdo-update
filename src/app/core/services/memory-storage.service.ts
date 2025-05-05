import { Injectable, Signal, computed, signal } from '@angular/core';
import { StoredMemoryRecording } from '../models/memory-recording.model';

const STORAGE_KEY = 'movesense_memory_recordings';

@Injectable({
    providedIn: 'root',
})
export class MemoryStorageService {
    readonly storedRecordingsSignal = signal<StoredMemoryRecording[]>([]);
    readonly storedRecordings: Signal<StoredMemoryRecording[]> = this.storedRecordingsSignal.asReadonly();
    readonly hasStoredRecordings = computed(() => this.storedRecordingsSignal().length > 0);

    constructor() {
        this.loadFromStorage();
    }

    /**
     * Guarda una nueva grabación de memoria
     */
    saveRecording(
        sensorData: StoredMemoryRecording['sensorData'],
        timestamp = Date.now(),
        duration = 0
    ): string {
        // Generar ID único
        const id = crypto.randomUUID();

        // Crear nueva grabación
        const newRecording: StoredMemoryRecording = {
            id,
            timestamp,
            duration,
            sensorData: {
                // Filtrar datos sintéticos (marcados con 1 en última posición)
                accelerometer: sensorData.accelerometer?.map(data =>
                    data.length > 4 && data[4] === 1 ?
                        [data[0], data[1], data[2], data[3]] : data
                ) || [],
                temperature: sensorData.temperature || [],
                heartRate: sensorData.heartRate || [],
                gyroscope: sensorData.gyroscope?.map(data =>
                    data.length > 4 && data[4] === 1 ?
                        [data[0], data[1], data[2], data[3]] : data
                ) || [],
                magnetometer: sensorData.magnetometer?.map(data =>
                    data.length > 4 && data[4] === 1 ?
                        [data[0], data[1], data[2], data[3]] : data
                ) || [],
                ecg: sensorData.ecg || []
            }
        };

        // Actualizar estado
        this.storedRecordingsSignal.update(recordings => [newRecording, ...recordings]);

        // Guardar en localStorage
        try {
            this.saveToStorage();
        } catch (error) {
            console.error('Error guardando en localStorage:', error);
            this.handleStorageError(error);
        }

        return id;
    }

    /**
     * Maneja errores de almacenamiento
     */
    private handleStorageError(error: any): void {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.warn('localStorage lleno, reduciendo datos');

            // Reducir tamaño de datos limitando número de muestras
            this.storedRecordingsSignal.update(recordings => {
                return recordings.map(recording => ({
                    ...recording,
                    sensorData: {
                        accelerometer: this.trimArray(recording.sensorData.accelerometer, 50),
                        temperature: this.trimArray(recording.sensorData.temperature, 20),
                        heartRate: this.trimArray(recording.sensorData.heartRate, 20),
                        gyroscope: this.trimArray(recording.sensorData.gyroscope, 50),
                        magnetometer: this.trimArray(recording.sensorData.magnetometer, 50),
                        ecg: this.trimArray(recording.sensorData.ecg, 100)
                    }
                }));
            });

            // Intentar guardar nuevamente
            try {
                this.saveToStorage();
            } catch (retryError) {
                // Si aún falla, eliminar grabaciones antiguas
                if (this.storedRecordingsSignal().length > 1) {
                    this.storedRecordingsSignal.update(recordings =>
                        recordings.slice(0, Math.ceil(recordings.length / 2))
                    );
                    this.saveToStorage();
                }
            }
        }
    }

    /**
     * Recorta un array a una longitud máxima
     */
    private trimArray<T>(array: T[] | undefined, maxLength: number): T[] {
        if (!array) return [];
        return array.length > maxLength ? array.slice(0, maxLength) : array;
    }

    /**
     * Elimina una grabación por su ID
     */
    deleteRecording(id: string): boolean {
        const currentRecordings = this.storedRecordingsSignal();
        const initialLength = currentRecordings.length;

        this.storedRecordingsSignal.update(recordings =>
            recordings.filter(recording => recording.id !== id)
        );

        if (currentRecordings.length !== initialLength) {
            this.saveToStorage();
            return true;
        }

        return false;
    }

    /**
     * Renombra una grabación
     */
    renameRecording(id: string, name: string): boolean {
        let found = false;

        this.storedRecordingsSignal.update(recordings => {
            return recordings.map(recording => {
                if (recording.id === id) {
                    found = true;
                    return { ...recording, name };
                }
                return recording;
            });
        });

        if (found) {
            this.saveToStorage();
        }

        return found;
    }

    /**
     * Obtiene una grabación por su ID
     */
    getRecordingById(id: string): StoredMemoryRecording | undefined {
        return this.storedRecordingsSignal().find(recording => recording.id === id);
    }

    /**
     * Carga grabaciones desde el almacenamiento
     */
    private loadFromStorage(): void {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData) as StoredMemoryRecording[];
                this.storedRecordingsSignal.set(parsedData);
            }
        } catch (error) {
            console.error('Error cargando grabaciones de memoria:', error);
        }
    }

    /**
     * Guarda grabaciones en el almacenamiento
     */
    private saveToStorage(): void {
        const dataToStore = JSON.stringify(this.storedRecordingsSignal());
        localStorage.setItem(STORAGE_KEY, dataToStore);
    }

    /**
     * Elimina todas las grabaciones
     */
    clearAllRecordings(): void {
        this.storedRecordingsSignal.set([]);
        localStorage.removeItem(STORAGE_KEY);
    }
}