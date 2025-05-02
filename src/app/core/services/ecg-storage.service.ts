import { Injectable, Signal, computed, signal } from '@angular/core';
import { StoredEcg } from '../models/ecg-storage.model';

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

    saveEcg(samples: number[], timestamp = Date.now()): string {
        const id = crypto.randomUUID();
        const duration = samples.length / 128;

        const newEcg: StoredEcg = {
            id,
            timestamp,
            samples,
            duration
        };

        this.storedEcgsSignal.update(ecgs => [newEcg, ...ecgs]);
        this.saveToStorage();

        return id;
    }

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

    getEcgById(id: string): StoredEcg | undefined {
        return this.storedEcgsSignal().find(ecg => ecg.id === id);
    }

    private loadFromStorage(): void {
        try {
            const storedData = localStorage.getItem(STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData) as StoredEcg[];
                this.storedEcgsSignal.set(parsedData);
            }
        } catch (error) {
            console.error('Error loading ECG data from storage:', error);
        }
    }

    private saveToStorage(): void {
        try {
            const dataToStore = JSON.stringify(this.storedEcgsSignal());
            console.log('Guardando en localStorage:', {
                key: STORAGE_KEY,
                dataLength: dataToStore.length,
                numEcgs: this.storedEcgsSignal().length
            });
            localStorage.setItem(STORAGE_KEY, dataToStore);
            console.log('ECG guardado correctamente en localStorage');
        } catch (error) {
            console.error('Error saving ECG data to storage:', error);

            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn('localStorage lleno, limitando muestras ECG');

                const limitedEcgs = this.storedEcgsSignal().map(ecg => {
                    if (ecg.samples.length > 2000) {
                        return {
                            ...ecg,
                            samples: ecg.samples.slice(0, 2000),
                            duration: 2000 / 128
                        };
                    }
                    return ecg;
                });

                this.storedEcgsSignal.set(limitedEcgs);
                const reducedData = JSON.stringify(limitedEcgs);
                localStorage.setItem(STORAGE_KEY, reducedData);
                console.log('ECG guardado con muestras limitadas');
            }
        }
    }

    clearAll(): void {
        this.storedEcgsSignal.set([]);
        localStorage.removeItem(STORAGE_KEY);
    }
}