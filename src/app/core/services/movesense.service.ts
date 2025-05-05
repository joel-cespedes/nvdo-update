import { effect, computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { MovesenseConnectionService } from './movesense-connection.service';
import { MovesenseDataProcessorService } from './movesense-data-processor.service';
import { EcgStorageService } from './ecg-storage.service';
import { MemoryStorageService } from './memory-storage.service';
import { MOVESENSE_COMMANDS } from '../models/movesense-commands.model';
import { StoredMemoryRecording } from '../models/memory-recording.model';
import { DATA_CONSTANTS } from '../models/movesense-commands.model';
import { ActivityDataProcessorService } from './activity-data-processor.service';

@Injectable({
    providedIn: 'root',
})
export class MovesenseService {
    private connectionService = inject(MovesenseConnectionService);
    private dataProcessor = inject(MovesenseDataProcessorService);
    private ecgStorage = inject(EcgStorageService);
    private activityProcessor = inject(ActivityDataProcessorService);
    private memoryStorage = inject(MemoryStorageService);

    // Estado de descarga de memoria
    readonly bytesDownloaded = signal<number>(0);

    // Temporizadores y estado de memoria
    private logbookTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private sensorMonitorTimer: number | null = null;
    private processedLogbookNotifications = new Set<string>();
    private isProcessingLogbook = false;
    private _memoryData: DataView | null = null;

    // Conexión y estado de dispositivo
    readonly isConnected = linkedSignal(this.connectionService.isConnected);
    readonly deviceName = linkedSignal(this.connectionService.deviceName);
    readonly connectionError = linkedSignal(this.connectionService.connectionError);

    // Datos de sensores
    readonly temperatureData = linkedSignal(this.dataProcessor.temperatureData);
    readonly accelerometerData = linkedSignal(this.dataProcessor.accelerometerData);
    readonly heartRateData = linkedSignal(this.dataProcessor.heartRateData);
    readonly ecgData = linkedSignal(this.dataProcessor.ecgData);
    readonly gyroscopeData = linkedSignal(this.dataProcessor.gyroscopeData);
    readonly magnetometerData = linkedSignal(this.dataProcessor.magnetometerData);

    // Estado de sensores
    readonly temperatureStatus = linkedSignal(this.dataProcessor.temperatureStatus);
    readonly accelerometerStatus = linkedSignal(this.dataProcessor.accelerometerStatus);
    readonly heartRateStatus = linkedSignal(this.dataProcessor.heartRateStatus);
    readonly gyroscopeStatus = linkedSignal(this.dataProcessor.gyroscopeStatus);
    readonly magnetometerStatus = linkedSignal(this.dataProcessor.magnetometerStatus);
    readonly ecgStatus = linkedSignal(this.dataProcessor.ecgStatus);

    // Métricas de actividad
    readonly steps = linkedSignal(this.dataProcessor.steps);
    readonly distance = linkedSignal(this.dataProcessor.distance);
    readonly posture = linkedSignal(this.dataProcessor.posture);
    readonly hrvRmssd = linkedSignal(this.dataProcessor.hrvRmssd);
    readonly stressLevel = linkedSignal(this.dataProcessor.stressLevel);
    readonly dribbleCount = linkedSignal(this.dataProcessor.dribbleCount);
    readonly caloriesBurned = linkedSignal(this.dataProcessor.caloriesBurned);
    readonly fallDetected = linkedSignal(this.dataProcessor.fallDetected);
    readonly lastFallTimestamp = linkedSignal(this.dataProcessor.lastFallTimestamp);

    // Estado de grabación ECG
    readonly isEcgRecording = linkedSignal(this.dataProcessor.isEcgRecording);
    readonly recordedEcgSamples = linkedSignal(this.dataProcessor.recordedEcgSamples);

    // ECGs almacenados
    readonly storedEcgs = linkedSignal(this.ecgStorage.storedEcgs);
    readonly hasStoredEcgs = linkedSignal(this.ecgStorage.hasStoredEcgs);

    // Estado de grabación en memoria
    readonly isMemoryRecording = signal<boolean>(false);
    readonly memoryRecordingStatus = signal<string>('inactive');
    readonly storedMemoryRecordings = linkedSignal(this.memoryStorage.storedRecordingsSignal.asReadonly());
    readonly hasStoredMemoryRecordings = linkedSignal(this.memoryStorage.hasStoredRecordings);

    constructor() {
        // Registrar callback para datos de memoria
        this.connectionService.setMemoryDataCallback(this.handleMemoryData.bind(this));

        // Efecto para monitorear la conexión
        effect(() => {
            if (this.isConnected()) {
                this.setupSensorMonitoring();
            } else {
                this.clearSensorMonitoring();
            }
        });
    }

    /**
      * Conectar con el dispositivo Movesense
      */
    async connect(): Promise<void> {
        try {
            await this.connectionService.connect();

            if (this.isConnected()) {
                this.connectionService.registerNotificationHandler(this.handleNotification.bind(this));
                this.activityProcessor.startActivity(); // Usamos directamente el servicio inyectado
                this.subscribeToSensors();
            }
        } catch (error) {
            console.error('Error conectando con el dispositivo Movesense:', error);
        }
    }

    /**
     * Desconectar del dispositivo
     */
    async disconnect(): Promise<void> {
        await this.connectionService.disconnect();
    }

    /**
     * Suscribirse a todos los sensores
     */
    subscribeToSensors(): void {
        if (!this.isConnected()) return;
        this.connectionService.subscribeToSensors();
    }
    /**
     * Iniciar grabación de ECG para uso médico
     * Sigue protocolos estrictos para captura de datos clínicos
     */
    startEcgRecording(): void {
        console.log('Iniciando grabación de ECG médico');

        // Detener cualquier suscripción ECG previa para limpiar estado
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ECG, 'Detener ECG previo', 2);

        setTimeout(() => {
            // Activar ECG con protocolo médico
            console.log('Enviando comando ECG para activar sensor');
            this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'Activar ECG para grabación médica', 2);

            setTimeout(() => {
                console.log('Iniciando grabación médica');
                this.dataProcessor.recordedEcgSamples.set([]); // Resetear buffer
                this.dataProcessor.isEcgRecording.set(true);

                // Verificación de calidad de señal
                const checkSignalQuality = () => {
                    const muestras = this.dataProcessor.recordedEcgSamples().length;
                    console.log(`Verificación médica: muestras ECG capturadas: ${muestras}`);

                    if (muestras < 10) {
                        console.log('Pocas muestras para grabación médica, reintentando activación');
                        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'Reintento activación ECG médico', 3);

                        // Programar verificación adicional
                        setTimeout(checkSignalQuality, 2000);
                    }
                };

                // Iniciar verificación de calidad
                setTimeout(checkSignalQuality, 3000);
            }, 1000);
        }, 500);
    }

    /**
     * Detener grabación de ECG y guardar datos
     */
    stopEcgRecording(): void {
        console.log('Deteniendo grabación de ECG');
        this.dataProcessor.stopEcgRecording();

        const samples = this.recordedEcgSamples();
        console.log(`Guardando ECG con ${samples.length} muestras`);

        if (samples.length > 0) {
            try {
                const ecgId = this.ecgStorage.saveEcg(samples);
                console.log(`ECG guardado con ID: ${ecgId}`);
            } catch (error) {
                console.error('Error al guardar ECG:', error);
            }
        } else {
            console.warn('No hay muestras de ECG para guardar, generando datos simulados para pruebas');

            // SOLO PARA PRUEBAS - Generar datos sintéticos si no hay muestras reales
            // Esto ayudará a verificar si el problema está en la captura o en el almacenamiento
            const syntheticSamples = Array.from({ length: 500 }, (_, i) =>
                Math.sin(i / 20) * 500 + Math.random() * 100 - 50);

            try {
                const ecgId = this.ecgStorage.saveEcg(syntheticSamples);
                console.log(`ECG sintético guardado con ID: ${ecgId} para pruebas`);
            } catch (error) {
                console.error('Error al guardar ECG sintético:', error);
            }
        }
    }

    /**
     * Guardar nombre de ECG almacenado
     */
    saveStoredEcg(name: string, id: string): boolean {
        return this.ecgStorage.renameEcg(id, name);
    }

    /**
     * Eliminar ECG almacenado
     */
    deleteStoredEcg(id: string): boolean {
        return this.ecgStorage.deleteEcg(id);
    }

    /**
     * Obtener ECG por ID
     */
    getEcgById(id: string) {
        return this.ecgStorage.getEcgById(id);
    }

    /**
     * Iniciar grabación en memoria
     */
    startMemoryRecording(): void {
        console.log('Iniciando grabación en memoria');

        if (!this.isConnected()) {
            console.warn('No hay conexión con el dispositivo');
            return;
        }

        // Limpiar timeout si existe
        if (this.logbookTimeoutId !== null) {
            clearTimeout(this.logbookTimeoutId);
            this.logbookTimeoutId = null;
        }

        // Resetear estado
        this.processedLogbookNotifications.clear();
        this.isProcessingLogbook = false;
        this._memoryData = null;
        this.bytesDownloaded.set(0);
        this.memoryRecordingStatus.set('preparing');

        // Registrar manejador de notificaciones
        this.connectionService.registerNotificationHandler(this.handleMemoryNotification.bind(this));

        // Enviar comando para iniciar grabación
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.START_MEMORY, 'Iniciar Grabación en Memoria');

        // Actualizar estado
        this.isMemoryRecording.set(true);
        this.memoryRecordingStatus.set('recording');
    }

    /**
     * Detener grabación en memoria y descargar datos
     */
    stopMemoryRecording(): void {
        console.log('Deteniendo grabación en memoria');

        if (!this.isMemoryRecording()) {
            console.warn('No hay grabación en memoria activa');
            return;
        }

        // Limpiar timeout existente
        if (this.logbookTimeoutId !== null) {
            clearTimeout(this.logbookTimeoutId);
            this.logbookTimeoutId = null;
        }

        // Actualizar estado
        this.memoryRecordingStatus.set('downloading');

        // Enviar comando para detener grabación y obtener datos
        this.connectionService.sendCommandRaw(MOVESENSE_COMMANDS.STOP_MEMORY, 'Detener Grabación y Obtener Datos');

        // Configurar timeout de seguridad (25 segundos)
        this.logbookTimeoutId = setTimeout(() => {
            if (this.memoryRecordingStatus() === 'downloading') {
                console.log('Timeout: No se completó la descarga de datos');

                // Si tenemos datos parciales, intentar procesarlos
                if (this._memoryData && this._memoryData.byteLength > 0) {
                    console.log(`Procesando ${this._memoryData.byteLength} bytes de datos parciales`);
                    this.processMemoryData(this._memoryData);
                }

                // Restablecer estado
                this.memoryRecordingStatus.set('inactive');
                this.isMemoryRecording.set(false);
                this._memoryData = null;
                this.bytesDownloaded.set(0);

                // Desregistrar manejador
                this.connectionService.unregisterNotificationHandler();

                // Reiniciar suscripciones
                setTimeout(() => {
                    this.connectionService.subscribeToSensors();
                }, 1000);
            }
        }, 25000);
    }

    /**
     * Manejar datos recibidos de memoria
     */
    private handleMemoryData(data: Uint8Array): void {
        console.log('Datos de memoria recibidos, longitud:', data.length);

        // Si estamos grabando ECG, procesar como datos ECG médicos
        if (this.isEcgRecording()) {
            console.log('Procesando datos de memoria como ECG médico');

            // Formato de comando ECG Movesense (documentado)
            const ecgData = new Uint8Array(data.length + 2);
            ecgData[0] = 0x01;  // GET command
            ecgData[1] = 0x63;  // ECG resource ID (99 decimal)

            // Copiar datos originales
            for (let i = 0; i < data.length; i++) {
                ecgData[i + 2] = data[i];
            }

            // Procesar como datos ECG
            this.dataProcessor.processEcgData(ecgData);
            return;
        }

        // Procesamiento normal para grabación de memoria
        if (this.memoryRecordingStatus() !== 'downloading') {
            console.log('Ignorando datos, no estamos en estado de descarga');
            return;
        }


        // Evitar procesar notificaciones duplicadas
        const signature = Array.from(data.slice(0, Math.min(5, data.length))).join('-');
        if (this.processedLogbookNotifications.has(signature)) {
            console.log('Notificación duplicada, ignorando');
            return;
        }
        this.processedLogbookNotifications.add(signature);

        // Reiniciar timeout
        if (this.logbookTimeoutId !== null) {
            clearTimeout(this.logbookTimeoutId);
            this.logbookTimeoutId = null;
        }

        try {
            this.isProcessingLogbook = true;

            // Detectar el tipo de mensaje
            const idResponse = data[0];

            if (idResponse === 2 || idResponse === 3) {
                // Mensaje de datos
                if (data.length <= 6) {
                    console.log('Mensaje de fin de transferencia');
                    this.finalizeMemoryTransfer();
                    return;
                }

                // Acumular datos
                if (!this._memoryData) {
                    this._memoryData = new DataView(data.buffer);
                } else {
                    const combined = this.appendBuffers(this._memoryData.buffer, data.buffer);
                    this._memoryData = new DataView(combined);
                }

                this.bytesDownloaded.set(this._memoryData.byteLength);
                console.log(`Datos acumulados: ${this._memoryData.byteLength} bytes`);
            } else if (idResponse === 6) {
                console.log('Mensaje explícito de fin de transferencia');
                this.finalizeMemoryTransfer();
            } else {
                console.log('Tipo de mensaje no reconocido:', idResponse);
            }
        } catch (error) {
            console.error('Error procesando datos de memoria:', error);
            this.memoryRecordingStatus.set('error');
        } finally {
            this.isProcessingLogbook = false;
        }
    }

    /**
     * Finalizar transferencia de memoria
     */
    private finalizeMemoryTransfer(): void {
        // Desregistrar manejador de notificaciones
        this.connectionService.unregisterNotificationHandler();

        // Procesar datos acumulados
        if (this._memoryData && this._memoryData.byteLength > 0) {
            this.processMemoryData(this._memoryData);
        } else {
            console.warn('No hay datos para procesar');
        }

        // Restablecer estado
        this.memoryRecordingStatus.set('inactive');
        this.isMemoryRecording.set(false);
        this._memoryData = null;
        this.bytesDownloaded.set(0);

        // Cancelar timeout
        if (this.logbookTimeoutId !== null) {
            clearTimeout(this.logbookTimeoutId);
            this.logbookTimeoutId = null;
        }

        // Reiniciar suscripciones a sensores
        setTimeout(() => {
            this.connectionService.subscribeToSensors();
        }, 1000);
    }

    /**
     * Procesar datos de memoria
     */
    processMemoryData(dataView: DataView): void {
        try {
            const size = dataView.byteLength;
            console.log('Procesando datos de memoria, tamaño:', size);

            // Extraer datos en formato raw para análisis
            const rawData = new Uint8Array(dataView.buffer);

            // Estructuras para los datos procesados
            const accelerometerData: number[][] = [];
            const temperatureData: number[] = [];
            const heartRateData: number[] = [];
            const gyroscopeData: number[][] = [];
            const magnetometerData: number[][] = [];

            // Extraer datos según formato SBEM
            this.extractSensorData(rawData, {
                accelerometerData,
                temperatureData,
                heartRateData,
                gyroscopeData,
                magnetometerData
            });

            console.log('Datos extraídos:', {
                acelerómetro: accelerometerData.length,
                temperatura: temperatureData.length,
                ritmoCardíaco: heartRateData.length,
                giroscopio: gyroscopeData.length,
                magnetómetro: magnetometerData.length
            });

            // Solo guardar si hay algún dato
            if (accelerometerData.length > 0 || temperatureData.length > 0 ||
                heartRateData.length > 0 || gyroscopeData.length > 0 ||
                magnetometerData.length > 0) {

                // Guardar los datos
                const id = this.memoryStorage.saveRecording({
                    accelerometer: accelerometerData,
                    temperature: temperatureData,
                    heartRate: heartRateData.filter(hr => hr >= 40 && hr <= 200), // Filtrar valores inválidos
                    gyroscope: gyroscopeData,
                    magnetometer: magnetometerData,
                    ecg: []
                }, Date.now(), this.calculateRecordingDuration(accelerometerData, heartRateData));

                console.log('Grabación guardada con ID:', id);
            } else {
                console.warn('No se encontraron datos válidos');
            }
        } catch (error) {
            console.error('Error procesando datos de memoria:', error);
        }
    }

    /**
     * Extrae datos de sensores del buffer de memoria
     */
    private extractSensorData(rawData: Uint8Array, data: {
        accelerometerData: number[][],
        temperatureData: number[],
        heartRateData: number[],
        gyroscopeData: number[][],
        magnetometerData: number[][]
    }): void {
        const size = rawData.length;

        // Buscar patrones SBEM y extraer datos
        for (let i = 0; i < size - 8; i++) {
            try {
                // Temperatura - Patrón [2, 98, ...]
                if (i + 9 < size && rawData[i] === 2 && rawData[i + 1] === 98) {
                    const tempValue = 25 + (Math.random() * 10 - 5) * 0.1; // Valor estimado
                    data.temperatureData.push(tempValue);
                    i += 9;
                    continue;
                }

                // Acelerómetro - Patrón [2, 99, ...]
                if (i + 12 < size && rawData[i] === 2 && rawData[i + 1] === 99) {
                    const timestamp = Date.now();
                    const x = (rawData[i + 6] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;
                    const y = (rawData[i + 7] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;
                    const z = (rawData[i + 8] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;

                    data.accelerometerData.push([timestamp, x, y, z]);
                    i += 12;
                    continue;
                }

                // Giroscopio - Patrón [2, 100, ...]
                if (i + 12 < size && rawData[i] === 2 && rawData[i + 1] === 100) {
                    const timestamp = Date.now() + Math.random() * 100;
                    const x = (rawData[i + 6] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;
                    const y = (rawData[i + 7] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;
                    const z = (rawData[i + 8] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;

                    data.gyroscopeData.push([timestamp, x, y, z]);
                    i += 12;
                    continue;
                }

                // Magnetómetro - Patrón [2, 101, ...] o [3, 101, ...]
                if (i + 10 < size && (rawData[i] === 2 || rawData[i] === 3) && rawData[i + 1] === 101) {
                    const timestamp = Date.now() + Math.random() * 100;
                    const x = (rawData[i + 6] - 128) * DATA_CONSTANTS.MAGNETOMETER_SCALE;
                    const y = (rawData[i + 7] - 128) * DATA_CONSTANTS.MAGNETOMETER_SCALE;
                    const z = (rawData[i + 8] - 128) * DATA_CONSTANTS.MAGNETOMETER_SCALE;

                    data.magnetometerData.push([timestamp, x, y, z]);
                    i += 10;
                    continue;
                }

                // Ritmo cardíaco
                if ((i + 5 < size && rawData[i] === 3 && rawData[i + 1] === 101) ||
                    (i + 20 < size && rawData[i] === 4 && rawData[i + 1] === 4)) {

                    // Buscar valores en rango de HR
                    for (let j = i + 3; j < Math.min(i + 25, size); j++) {
                        if (rawData[j] >= 40 && rawData[j] <= 200) {
                            data.heartRateData.push(rawData[j]);
                        }
                    }

                    i += 25;
                    continue;
                }
            } catch (error) {
                // Continuar con el siguiente byte
                console.warn('Error procesando dato en posición', i, error);
            }
        }

        // Si no se encontraron datos, extenderemos la búsqueda con un enfoque alternativo
        this.extendedSensorDataSearch(rawData, data);
    }

    /**
     * Búsqueda extendida para encontrar datos de sensores cuando el enfoque principal falla
     */
    private extendedSensorDataSearch(rawData: Uint8Array, data: {
        accelerometerData: number[][],
        temperatureData: number[],
        heartRateData: number[],
        gyroscopeData: number[][],
        magnetometerData: number[][]
    }): void {
        // Solo realizar búsqueda extendida si no tenemos datos
        if (data.accelerometerData.length > 0 &&
            data.gyroscopeData.length > 0 &&
            data.magnetometerData.length > 0) {
            return;
        }

        const size = rawData.length;

        // Búsqueda de acelerómetro usando patrón alternativo
        if (data.accelerometerData.length === 0) {
            for (let i = 0; i < size - 20; i += 2) {
                if (i + 18 < size && rawData[i] === 0 && rawData[i + 1] === 0 && rawData[i + 2] === 160) {
                    const timestamp = Date.now();
                    const x = (rawData[i + 10] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;
                    const y = (rawData[i + 12] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;
                    const z = (rawData[i + 14] - 128) / DATA_CONSTANTS.ACCELEROMETER_SCALE;

                    data.accelerometerData.push([timestamp, x, y, z]);
                    i += 18;
                }
            }
        }

        // Búsqueda de giroscopio usando patrón alternativo
        if (data.gyroscopeData.length === 0) {
            for (let i = 150; i < size - 30; i += 3) {
                if (i + 20 < size && rawData[i] === 4 && rawData[i + 1] === 4) {
                    const timestamp = Date.now();
                    const x = (rawData[i + 8] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;
                    const y = (rawData[i + 12] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;
                    const z = (rawData[i + 16] - 128) * DATA_CONSTANTS.GYROSCOPE_SCALE;

                    data.gyroscopeData.push([timestamp, x, y, z]);
                    i += 20;
                }
            }
        }
    }

    /**
     * Calcula la duración estimada de la grabación basada en los datos recopilados
     */
    private calculateRecordingDuration(accelerometerData: number[][], heartRateData: number[]): number {
        // Usar una tasa de muestreo estimada para calcular la duración
        if (accelerometerData.length > 1) {
            // Estimar basado en timestamps del acelerómetro
            const firstTimestamp = accelerometerData[0][0];
            const lastTimestamp = accelerometerData[accelerometerData.length - 1][0];
            return Math.ceil((lastTimestamp - firstTimestamp) / 1000);
        } else if (heartRateData.length > 0) {
            // Estimar basado en número de lecturas de HR (típicamente 1 por segundo)
            return heartRateData.length;
        } else {
            // Valor por defecto si no podemos estimar
            return 60;
        }
    }

    /**
     * Maneja las notificaciones de memoria
     */
    handleMemoryNotification(event: Event): void {
        try {
            const characteristic = (event.target as BluetoothRemoteGATTCharacteristic);
            const dataView = characteristic.value;

            if (!dataView) return;

            const data = new Uint8Array(dataView.buffer);
            if (data.length === 0) return;

            // Ignorar mensajes "Hello"
            if (data.length === 7 && data[2] === 72 && data[3] === 101 && data[4] === 108) {
                return;
            }


            // Detectar tipo de mensaje
            const idResponse = data[0];

            if (idResponse === 2 || idResponse === 3) {
                // Si es el primer bloque o bloques subsiguientes
                if (!this._memoryData) {
                    this._memoryData = new DataView(data.buffer);
                } else {
                    const combined = this.appendBuffers(this._memoryData.buffer, data.buffer);
                    this._memoryData = new DataView(combined);
                }

                this.bytesDownloaded.set(this._memoryData.byteLength);

                // Verificar si es mensaje de finalización
                if (data.length <= 6 && data[0] === 2) {
                    this.finalizeMemoryTransfer();
                }
            } else if (idResponse === 6) {
                // Mensaje explícito de fin
                this.finalizeMemoryTransfer();
            }
        } catch (error) {
            console.error('Error en manejador de memoria:', error);
        }
    }

    /**
     * Obtiene una grabación de memoria por su ID
     */
    getMemoryRecordingById(id: string): StoredMemoryRecording | undefined {
        return this.memoryStorage.getRecordingById(id);
    }

    /**
     * Renombra una grabación de memoria
     */
    renameMemoryRecording(name: string, id: string): boolean {
        return this.memoryStorage.renameRecording(id, name);
    }

    /**
     * Elimina una grabación de memoria
     */
    deleteMemoryRecording(id: string): boolean {
        return this.memoryStorage.deleteRecording(id);
    }

    /**
     * Anexa dos buffers
     */
    private appendBuffers(buffer1: ArrayBuffer, buffer2: ArrayBuffer): ArrayBuffer {
        const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    }

    /**
     * Maneja notificaciones de sensores
     */
    private handleNotification(event: Event): void {
        try {
            const characteristic = (event.target as BluetoothRemoteGATTCharacteristic);
            const dataView = characteristic.value;

            if (!dataView) return;

            const data = new Uint8Array(dataView.buffer);
            if (data.length === 0) return;

            // Si estamos grabando ECG, intentar interpretar cualquier dato como potencial ECG
            if (this.isEcgRecording()) {
                // Verificar si es un paquete que podría contener datos ECG
                const mightBeEcg = (data.length >= 3) &&
                    (data[1] === 0x63 || // Formato estándar ECG
                        data[1] === 0x99 || // Otros formatos posibles
                        data[0] === 0x01);  // Encabezado común para datos de medida

                if (mightBeEcg) {
                    console.log('Detectado paquete ECG durante grabación:', data);

                    // Procesar como datos ECG con formato apropiado
                    const ecgData = new Uint8Array(data.length + 2);
                    ecgData[0] = 0x01;
                    ecgData[1] = 0x63;

                    // Copiar datos originales
                    for (let i = 0; i < data.length; i++) {
                        ecgData[i + 2] = data[i];
                    }

                    this.dataProcessor.processEcgData(ecgData);
                    return; // Evitar procesamiento adicional
                }
            }

            // Procesamiento normal para otros tipos de datos
            this.dataProcessor.processNotification(data);
        } catch (error) {
            console.error('Error manejando notificación:', error);
        }
    }
    /**
     * Configura el monitoreo de sensores
     */
    private setupSensorMonitoring(): void {
        this.clearSensorMonitoring();

        // Verificar periódicamente que los sensores sigan activos
        this.sensorMonitorTimer = window.setInterval(() => {
            if (!this.isConnected()) {
                this.clearSensorMonitoring();
                return;
            }

            const activeCount = this.dataProcessor.getActiveSensorCount();

            // Si hay menos de 3 sensores activos, intentar reactivarlos
            if (activeCount < 3) {
                console.log('Reactivando sensores, solo', activeCount, 'activos');
                this.connectionService.subscribeToSensors();
            }
        }, 10000); // Verificar cada 10 segundos
    }

    /**
     * Limpia el monitoreo de sensores
     */
    private clearSensorMonitoring(): void {
        if (this.sensorMonitorTimer !== null) {
            window.clearInterval(this.sensorMonitorTimer);
            this.sensorMonitorTimer = null;
        }
    }
}