// src/app/core/services/memory-storage.service.ts
import { Injectable, Signal, computed, signal } from '@angular/core';
import { StoredMemoryRecording } from '../models/memory-recording.model';

const STORAGE_KEY = 'movesense_memory_recordings';

@Injectable({
    providedIn: 'root',
})
export class MemoryStorageService {
    storedRecordingsSignal = signal<StoredMemoryRecording[]>([]);

    readonly storedRecordings: Signal<StoredMemoryRecording[]> = this.storedRecordingsSignal.asReadonly();
    readonly hasStoredRecordings = computed(() => this.storedRecordingsSignal().length > 0);

    constructor() {
        this.loadFromStorage();
    }

    saveRecording(sensorData: StoredMemoryRecording['sensorData'], timestamp = Date.now(), duration = 0): string {
        // Generar un ID único para la grabación
        const id = crypto.randomUUID();

        // Crear la estructura de la nueva grabación
        const newRecording: StoredMemoryRecording = {
            id,
            timestamp,
            duration,
            sensorData: {
                // Filtrar datos simulados (marcados con 1 en la última posición)
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

        // Añadir logs para diagnosticar
        console.log('Guardando nueva grabación:', {
            id,
            timestamp,
            duration,
            datosSensores: {
                acelerómetro: newRecording.sensorData.accelerometer?.length || 0,
                temperatura: newRecording.sensorData.temperature?.length || 0,
                ritmoCardíaco: newRecording.sensorData.heartRate?.length || 0,
                giroscopio: newRecording.sensorData.gyroscope?.length || 0,
                magnetómetro: newRecording.sensorData.magnetometer?.length || 0
            }
        });

        // Actualizar el estado
        this.storedRecordingsSignal.update(recordings => [newRecording, ...recordings]);

        // Guardar en localStorage
        try {
            this.saveToStorage();
            console.log('Grabación guardada correctamente en localStorage');
        } catch (error) {
            console.error('Error al guardar en localStorage:', error);
            this.handleStorageError(error);
        }

        return id;
    }

    // Manejar errores al guardar en localStorage (como exceder la cuota)
    private handleStorageError(error: any): void {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            console.warn('localStorage lleno, reduciendo el tamaño de los datos');

            // Reducir el tamaño de los datos limitando el número de muestras
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

            // Intentar guardar nuevamente con datos reducidos
            try {
                this.saveToStorage();
                console.log('Grabaciones guardadas con datos reducidos');
            } catch (retryError) {
                console.error('Error al guardar incluso con datos reducidos:', retryError);
                // Si aún falla, podríamos intentar eliminar grabaciones antiguas
                if (this.storedRecordingsSignal().length > 1) {
                    this.storedRecordingsSignal.update(recordings => recordings.slice(0, Math.ceil(recordings.length / 2)));
                    this.saveToStorage();
                }
            }
        }
    }

    // Función auxiliar para recortar arrays
    private trimArray<T>(array: T[] | undefined, maxLength: number): T[] {
        if (!array) return [];
        return array.length > maxLength ? array.slice(0, maxLength) : array;
    }

    deleteRecording(id: string): boolean {
        const currentRecordings = this.storedRecordingsSignal();
        const initialLength = currentRecordings.length;

        this.storedRecordingsSignal.update(recordings => recordings.filter(recording => recording.id !== id));

        if (currentRecordings.length !== initialLength) {
            this.saveToStorage();
            return true;
        }

        return false;
    }

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

    getRecordingById(id: string): StoredMemoryRecording | undefined {
        return this.storedRecordingsSignal().find(recording => recording.id === id);
    }

    private loadFromStorage(): void {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData) as StoredMemoryRecording[];
                this.storedRecordingsSignal.set(parsedData);
            }
        } catch (error) {
            console.error('Error loading memory recordings from storage:', error);
        }
    }

    private saveToStorage(): void {
        try {
            const dataToStore = JSON.stringify(this.storedRecordingsSignal());
            console.log('Guardando grabaciones en localStorage:', {
                key: STORAGE_KEY,
                dataLength: dataToStore.length,
                numRecordings: this.storedRecordingsSignal().length
            });
            localStorage.setItem(STORAGE_KEY, dataToStore);
            console.log('Grabaciones guardadas correctamente en localStorage');
        } catch (error) {
            console.error('Error saving memory recordings to storage:', error);

            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn('localStorage lleno, limitando datos de grabación');
                // Implementar lógica para reducir el tamaño de los datos si es necesario
            }
        }
    }



    clearAllRecordings(): void {
        this.storedRecordingsSignal.set([]);
        localStorage.removeItem(STORAGE_KEY);
        console.log('Todas las grabaciones han sido eliminadas');
    }
}