import { Injectable, Signal, computed, signal } from '@angular/core';
import { StoredEcg } from '../models/ecg-storage.model';
import { DATA_CONSTANTS } from '../models/movesense-commands.model';


const STORAGE_KEY = 'movesense_ecg_records';

@Injectable({
    providedIn: 'root',
})
export class EcgStorageService {
    private storedEcgsSignal = signal<StoredEcg[]>([]);

    readonly storedEcgs: Signal<StoredEcg[]> = this.storedEcgsSignal.asReadonly();
    readonly hasStoredEcgs = computed(() => this.storedEcgsSignal().length > 0);

    constructor() {
        this.loadFromStorage();
    }

    /**
     * Guarda un nuevo ECG
     * @param samples Muestras de ECG
     * @param timestamp Timestamp de la grabación
     * @returns ID del ECG guardado
     */
    saveEcg(samples: number[], timestamp = Date.now()): string {
        const id = crypto.randomUUID();
        const duration = samples.length / DATA_CONSTANTS.ECG_SAMPLE_RATE;

        const newEcg: StoredEcg = {
            id,
            timestamp,
            samples,
            duration
        };

        console.log(`Guardando ECG en almacenamiento: ${samples.length} muestras, duración: ${duration.toFixed(2)}s`);

        this.storedEcgsSignal.update(ecgs => [newEcg, ...ecgs]);

        try {
            this.saveToStorage();
            console.log('ECG guardado con éxito en localStorage');
        } catch (error) {
            console.error('Error al guardar en localStorage:', error);

            // Manejo de error de almacenamiento
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn('localStorage lleno, reduciendo tamaño de muestras ECG');
                this.reduceStoredSamplesSize();
            }
        }

        return id;
    }

    /**
     * Reduce el tamaño de las muestras almacenadas cuando hay error de cuota
     */
    private reduceStoredSamplesSize(): void {
        // Reducir el tamaño de las muestras de cada ECG
        const limitedEcgs = this.storedEcgsSignal().map(ecg => {
            if (ecg.samples.length > 2000) {
                return {
                    ...ecg,
                    samples: ecg.samples.slice(0, 2000),
                    duration: 2000 / DATA_CONSTANTS.ECG_SAMPLE_RATE
                };
            }
            return ecg;
        });

        // Si aún tenemos muchos ECGs, conservar solo los más recientes
        if (limitedEcgs.length > 10) {
            const reducedEcgs = limitedEcgs
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);

            this.storedEcgsSignal.set(reducedEcgs);
        } else {
            this.storedEcgsSignal.set(limitedEcgs);
        }

        // Intentar guardar nuevamente
        try {
            const reducedData = JSON.stringify(this.storedEcgsSignal());
            localStorage.setItem(STORAGE_KEY, reducedData);
            console.log('ECG guardado con muestras reducidas');
        } catch (e) {
            console.error('Error guardando incluso con datos reducidos:', e);
        }
    }

    /**
     * Elimina un ECG por su ID
     */
    deleteEcg(id: string): boolean {
        const currentEcgs = this.storedEcgsSignal();
        const initialLength = currentEcgs.length;

        this.storedEcgsSignal.update(ecgs => ecgs.filter(ecg => ecg.id !== id));

        if (currentEcgs.length !== initialLength) {
            this.saveToStorage();
            return true;
        }

        return false;
    }

    /**
     * Renombra un ECG
     */
    renameEcg(id: string, name: string): boolean {
        let found = false;

        this.storedEcgsSignal.update(ecgs => {
            return ecgs.map(ecg => {
                if (ecg.id === id) {
                    found = true;
                    return { ...ecg, name };
                }
                return ecg;
            });
        });

        if (found) {
            this.saveToStorage();
        }

        return found;
    }

    /**
     * Obtiene un ECG por su ID
     */
    getEcgById(id: string): StoredEcg | undefined {
        return this.storedEcgsSignal().find(ecg => ecg.id === id);
    }

    /**
     * Carga los ECGs desde el almacenamiento local
     */
    private loadFromStorage(): void {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData) as StoredEcg[];
                this.storedEcgsSignal.set(parsedData);
            }
        } catch (error) {
            console.error('Error cargando datos ECG desde almacenamiento:', error);
        }
    }

    /**
     * Guarda los ECGs en el almacenamiento local
     */
    private saveToStorage(): void {
        try {
            const dataToStore = JSON.stringify(this.storedEcgsSignal());
            localStorage.setItem(STORAGE_KEY, dataToStore);
        } catch (error) {
            console.error('Error guardando datos ECG en almacenamiento:', error);

            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                this.handleStorageQuotaExceeded();
            }
        }
    }

    /**
     * Maneja el error de cuota excedida en localStorage
     */
    private handleStorageQuotaExceeded(): void {
        console.warn('localStorage lleno, limitando muestras ECG');

        // Reducir el tamaño de las muestras de cada ECG
        const limitedEcgs = this.storedEcgsSignal().map(ecg => {
            if (ecg.samples.length > 2000) {
                return {
                    ...ecg,
                    samples: ecg.samples.slice(0, 2000),
                    duration: 2000 / DATA_CONSTANTS.ECG_SAMPLE_RATE
                };
            }
            return ecg;
        });

        // Si aún tenemos muchos ECGs, conservar solo los más recientes
        if (limitedEcgs.length > 10) {
            const reducedEcgs = limitedEcgs
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);

            this.storedEcgsSignal.set(reducedEcgs);
        } else {
            this.storedEcgsSignal.set(limitedEcgs);
        }

        // Intentar guardar nuevamente
        try {
            const reducedData = JSON.stringify(this.storedEcgsSignal());
            localStorage.setItem(STORAGE_KEY, reducedData);
        } catch (e) {
            console.error('Error guardando incluso con datos reducidos:', e);
        }
    }

    /**
     * Limpia todos los ECGs
     */
    clearAll(): void {
        this.storedEcgsSignal.set([]);
        localStorage.removeItem(STORAGE_KEY);
    }
}