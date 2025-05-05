import { Injectable, signal } from '@angular/core';
import { MOVESENSE_BLE, MOVESENSE_METHOD, createMovesenseCommand } from '../models/movesense-ble.model';
import { MOVESENSE_COMMANDS } from '../models/movesense-commands.model';

export interface CommandQueueItem {
    command: Uint8Array;
    description: string;
    priority?: number;
}

@Injectable({
    providedIn: 'root',
})
export class MovesenseConnectionService {
    // Estado de conexión
    readonly isConnected = signal<boolean>(false);
    readonly deviceName = signal<string>('');
    readonly connectionError = signal<string | null>(null);
    readonly reconnectAttempts = signal<number>(0);
    readonly batteryLevel = signal<number | null>(null);

    // Bluetooth API
    private bleServer: BluetoothRemoteGATTServer | null = null;
    private commandChar: BluetoothRemoteGATTCharacteristic | null = null;
    private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
    private device: BluetoothDevice | null = null;

    // Manejadores
    private notificationHandler: ((event: Event) => void) | null = null;
    private memoryDataCallback: ((data: Uint8Array) => void) | null = null;

    // Cola de comandos
    private commandQueue: CommandQueueItem[] = [];
    private isProcessingQueue = false;
    private lastCommandTime = 0;
    private readonly COMMAND_INTERVAL = 200; // ms entre comandos

    // Reconexión
    private reconnectTimer: number | null = null;
    private maxReconnectAttempts = 3;
    private intentionalDisconnect = false;

    /**
     * Inicia la conexión BLE con un dispositivo Movesense
     */
    async connect(): Promise<void> {
        this.connectionError.set(null);
        this.resetReconnectAttempts();

        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'Movesense' }],
                optionalServices: [MOVESENSE_BLE.SERVICE_UUID],
            });

            if (!this.device.gatt) {
                throw new Error('GATT Server no disponible');
            }

            this.deviceName.set(this.device.name || 'Dispositivo Movesense');
            this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

            this.bleServer = await this.device.gatt.connect();

            const service = await this.bleServer.getPrimaryService(MOVESENSE_BLE.SERVICE_UUID);
            this.commandChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_COMMAND_UUID);
            this.notifyChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_NOTIFY_UUID);

            await this.notifyChar.startNotifications();
            this.isConnected.set(true);

            // Solicitar información básica del dispositivo
            this.requestDeviceInfo();

        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    /**
     * Desconecta del dispositivo Movesense
     */
    async disconnect(): Promise<void> {
        if (!this.bleServer || !this.isConnected()) {
            return;
        }

        this.clearReconnectTimer();
        this.intentionalDisconnect = true;
        this.bleServer.disconnect();

        // Resetear estado después de desconexión
        setTimeout(() => {
            this.resetState();
            this.intentionalDisconnect = false;
        }, 500);
    }

    /**
     * Registra el callback para datos de memoria
     */
    setMemoryDataCallback(callback: (data: Uint8Array) => void): void {
        this.memoryDataCallback = callback;
    }

    /**
     * Registra el manejador para notificaciones
     */
    registerNotificationHandler(handler: (event: Event) => void): void {
        if (!this.notifyChar || !this.isConnected()) {
            return;
        }

        this.unregisterNotificationHandler();
        this.notificationHandler = handler;
        this.notifyChar.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));
    }

    /**
    * Procesa notificaciones entrantes del dispositivo BLE
    */
    private handleNotifications(event: Event): void {
        try {
            const characteristic = (event.target as BluetoothRemoteGATTCharacteristic);
            const dataView = characteristic.value;

            if (!dataView) return;

            const data = new Uint8Array(dataView.buffer);
            if (data.length === 0) return;

            // Detectar si es una respuesta de memoria
            const isMemoryData = this.isMemoryData(data);

            if (isMemoryData && this.memoryDataCallback) {
                // Si es dato de memoria y hay callback configurado, enviarlo allí
                this.memoryDataCallback(data);
            } else if (this.notificationHandler) {
                // Para el resto de datos, usar el manejador general
                this.notificationHandler(event);
            }
        } catch (error) {
            console.error('Error en handleNotifications:', error);
        }
    }

    /**
     * Determina si los datos son de memoria
     */
    private isMemoryData(data: Uint8Array): boolean {
        // Ignorar respuestas "Hello"
        if (data.length === 7 && data[2] === 72) {
            return false;
        }

        // Verificar si son datos de memoria
        if (data.length > 5) {
            if (data[0] === 0x02 || data[0] === 0x03 || data[0] === 0x06) {
                return true;
            }

            if (data[0] === 0x01 && data[1] === 0x2F && data[2] === 0x4D &&
                data[3] === 0x65 && data[4] === 0x6D) {
                return true;
            }
        }

        return false;
    }

    /**
     * Elimina el manejador de notificaciones
     */
    unregisterNotificationHandler(): void {
        if (this.notifyChar && this.notificationHandler) {
            try {
                this.notifyChar.removeEventListener(
                    'characteristicvaluechanged',
                    this.handleNotifications.bind(this)
                );
            } catch (e) {
                // Error silencioso al quitar listener
            }
            this.notificationHandler = null;
        }
    }

    /**
     * Envía un comando al dispositivo
     */
    sendCommandRaw(commandData: Uint8Array, commandDescription: string, priority = 0): void {
        this.enqueueCommand({
            command: commandData,
            description: commandDescription,
            priority
        });
    }

    /**
     * Envía un comando REST al dispositivo
     */
    sendRestCommand(method: number, path: string, description: string): void {
        const command = createMovesenseCommand(method, path);
        this.sendCommandRaw(command, description);
    }

    /**
     * Suscribe a todos los sensores
     */
    subscribeToSensors(): void {
        if (!this.isConnected()) {
            return;
        }

        // Primero detener todas las mediciones
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_TEMP, 'Stop Temperature', 1);
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ACC, 'Stop Accelerometer', 1);
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_HR, 'Stop Heart Rate', 1);
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_GYRO, 'Stop Gyroscope', 1);
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_MAGN, 'Stop Magnetometer', 1);
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ECG, 'Stop ECG', 1);

        // Luego iniciar con un ligero retraso
        setTimeout(() => {
            this.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ACCELEROMETER, 'Accelerometer sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.HEART_RATE, 'Heart rate sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.GYROSCOPE, 'Gyroscope sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG sensor');
        }, 1000);
    }

    /**
     * Solicita información del dispositivo
     */
    requestDeviceInfo(): void {
        if (!this.isConnected()) {
            return;
        }

        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Info', 'Device Info');
        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Energy/Level', 'Battery Level');
        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Sensors', 'Available Sensors');
    }

    /**
     * Añade un comando a la cola
     */
    private enqueueCommand(item: CommandQueueItem): void {
        // Si tiene prioridad alta, ponerlo al principio
        if (item.priority && item.priority > 0) {
            this.commandQueue.unshift(item);
        } else {
            this.commandQueue.push(item);
        }
        this.processCommandQueue();
    }

    /**
     * Procesa la cola de comandos
     */
    private async processCommandQueue(): Promise<void> {
        if (this.isProcessingQueue || this.commandQueue.length === 0 || !this.isConnected()) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Esperar el intervalo correcto entre comandos
            const now = Date.now();
            const timeSinceLastCommand = now - this.lastCommandTime;

            if (timeSinceLastCommand < this.COMMAND_INTERVAL) {
                await new Promise(resolve =>
                    setTimeout(resolve, this.COMMAND_INTERVAL - timeSinceLastCommand)
                );
            }

            const { command, description } = this.commandQueue.shift()!;
            await this.sendCommandDirectly(command, description);
            this.lastCommandTime = Date.now();

        } catch (error) {
            console.error('Error enviando comando:', error);
        } finally {
            this.isProcessingQueue = false;

            // Continuar procesando la cola si hay más comandos
            if (this.commandQueue.length > 0) {
                setTimeout(() => this.processCommandQueue(), 50);
            }
        }
    }

    /**
     * Envía un comando directamente al dispositivo
     */
    private async sendCommandDirectly(commandData: Uint8Array, commandDescription: string): Promise<void> {
        if (!this.commandChar || !this.isConnected()) {
            return Promise.reject('Dispositivo no conectado');
        }

        try {
            await this.commandChar.writeValue(commandData);
            console.log(`✅ Comando enviado: ${commandDescription}`);
        } catch (error) {
            console.error(`❌ Error enviando comando: ${commandDescription}`, error);
            throw error;
        }
    }

    /**
     * Maneja la desconexión del dispositivo
     */
    private handleDisconnect(_event: Event): void {
        if (this.intentionalDisconnect) {
            this.resetState();
            return;
        }

        if (this.isConnected() && this.reconnectAttempts() < this.maxReconnectAttempts) {
            this.reconnectAttempts.update(attempts => attempts + 1);

            this.clearReconnectTimer();
            this.reconnectTimer = window.setTimeout(() => {
                this.attemptReconnect();
            }, 2000);
        } else {
            this.resetState();
        }
    }

    /**
     * Intenta reconectar con el dispositivo
     */
    private async attemptReconnect(): Promise<void> {
        if (!this.device || !this.device.gatt) {
            this.resetState();
            return;
        }

        try {
            console.log(`Intento de reconexión ${this.reconnectAttempts()} de ${this.maxReconnectAttempts}`);

            this.bleServer = await this.device.gatt.connect();
            const service = await this.bleServer.getPrimaryService(MOVESENSE_BLE.SERVICE_UUID);
            this.commandChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_COMMAND_UUID);
            this.notifyChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_NOTIFY_UUID);
            await this.notifyChar.startNotifications();

            this.isConnected.set(true);
            this.reconnectAttempts.set(0);
            console.log('Reconexión exitosa');

        } catch (error) {
            console.error('Error en reconexión:', error);

            if (this.reconnectAttempts() < this.maxReconnectAttempts) {
                this.clearReconnectTimer();
                this.reconnectTimer = window.setTimeout(() => {
                    this.attemptReconnect();
                }, 3000);
            } else {
                console.log('Máximo de intentos de reconexión alcanzado');
                this.resetState();
            }
        }
    }

    /**
     * Resetea los intentos de reconexión
     */
    private resetReconnectAttempts(): void {
        this.reconnectAttempts.set(0);
        this.clearReconnectTimer();
    }

    /**
     * Limpia el temporizador de reconexión
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer !== null) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Maneja errores de conexión
     */
    private handleConnectionError(error: any): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.connectionError.set(errorMessage);
        this.isConnected.set(false);
        this.resetState();
    }

    /**
     * Resetea el estado de la conexión
     */
    private resetState(): void {
        this.isConnected.set(false);
        this.deviceName.set('');
        this.bleServer = null;
        this.device = null;

        this.unregisterNotificationHandler();

        this.notifyChar = null;
        this.commandChar = null;
        this.notificationHandler = null;
        this.commandQueue = [];
        this.isProcessingQueue = false;

        this.clearReconnectTimer();
    }
}