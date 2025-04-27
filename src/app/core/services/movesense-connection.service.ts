import { Injectable, inject, signal } from '@angular/core';
import { MOVESENSE_BLE, MOVESENSE_METHOD, createMovesenseCommand } from '../models/movesense-ble.model';
import { MOVESENSE_COMMANDS } from '../models/movesense-commands.model';
import { MovesenseDataProcessorService } from './movesense-data-processor.service';

@Injectable({
    providedIn: 'root',
})
export class MovesenseConnectionService {
    // Servicios inyectados
    private dataProcessor = inject(MovesenseDataProcessorService);

    // Signals de estado de conexión
    readonly isConnected = signal<boolean>(false);
    readonly deviceName = signal<string>('');
    readonly connectionError = signal<string | null>(null);
    readonly reconnectAttempts = signal<number>(0);

    // Propiedades BLE
    private bleServer: BluetoothRemoteGATTServer | null = null;
    private commandChar: BluetoothRemoteGATTCharacteristic | null = null;
    private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
    private device: BluetoothDevice | null = null;
    private notificationHandler: ((event: Event) => void) | null = null;

    // Cola de comandos
    private commandQueue: { command: Uint8Array, description: string }[] = [];
    private isProcessingQueue = false;
    private lastCommandTime = 0;

    // Reconexión
    private reconnectTimer: any = null;
    private maxReconnectAttempts = 3;
    private intentionalDisconnect = false;

    async connect(): Promise<void> {
        this.connectionError.set(null);
        this.resetReconnectAttempts();

        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'Movesense' }],
                optionalServices: [MOVESENSE_BLE.SERVICE_UUID],
            });

            if (!this.device.gatt) {
                throw new Error('GATT Server not available.');
            }

            this.deviceName.set(this.device.name || 'Movesense Device');

            // Configurar manejador de desconexión
            this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

            // Establecer conexión
            this.bleServer = await this.device.gatt.connect();

            // Obtener servicio y características
            const service = await this.bleServer.getPrimaryService(MOVESENSE_BLE.SERVICE_UUID);
            this.commandChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_COMMAND_UUID);
            this.notifyChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_NOTIFY_UUID);

            // Iniciar notificaciones
            await this.notifyChar.startNotifications();
            this.isConnected.set(true);

        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    async disconnect(): Promise<void> {
        if (!this.bleServer || !this.isConnected()) {
            return;
        }

        this.clearReconnectTimer();
        this.intentionalDisconnect = true;
        this.bleServer.disconnect();

        setTimeout(() => {
            this.resetState();
            setTimeout(() => {
                this.intentionalDisconnect = false;
            }, 1000);
        }, 500);
    }

    registerNotificationHandler(handler: (event: Event) => void): void {
        if (!this.notifyChar || !this.isConnected()) {
            return;
        }

        this.unregisterNotificationHandler();
        this.notificationHandler = handler;
        this.notifyChar.addEventListener('characteristicvaluechanged', handler);
    }

    unregisterNotificationHandler(): void {
        if (this.notifyChar && this.notificationHandler) {
            try {
                this.notifyChar.removeEventListener('characteristicvaluechanged', this.notificationHandler);
            } catch (e) {
                // Error silencioso intencional
            }
            this.notificationHandler = null;
        }
    }

    sendCommandRaw(commandData: Uint8Array, commandDescription: string): void {
        this.enqueueCommand(commandData, commandDescription);
    }

    getNotifyCharacteristic(): BluetoothRemoteGATTCharacteristic | null {
        return this.notifyChar;
    }

    private enqueueCommand(command: Uint8Array, description: string): void {
        this.commandQueue.push({ command, description });
        this.processCommandQueue();
    }

    private async processCommandQueue(): Promise<void> {
        if (this.isProcessingQueue || this.commandQueue.length === 0 || !this.isConnected()) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Limitar la velocidad de comandos
            const now = Date.now();
            const timeSinceLastCommand = now - this.lastCommandTime;

            if (timeSinceLastCommand < 200) {
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastCommand));
            }

            const { command, description } = this.commandQueue.shift()!;
            await this.sendCommandDirectly(command, description);
            this.lastCommandTime = Date.now();

        } catch (error) {
            // Error silencioso intencional
        } finally {
            this.isProcessingQueue = false;

            if (this.commandQueue.length > 0) {
                setTimeout(() => this.processCommandQueue(), 50);
            }
        }
    }

    private async sendCommandDirectly(commandData: Uint8Array, commandDescription: string): Promise<void> {
        if (!this.commandChar || !this.isConnected()) {
            return Promise.reject('Device not connected');
        }

        try {
            await this.commandChar.writeValue(commandData);
            console.log(`✅ Command sent: ${commandDescription} - data:`, Array.from(commandData));
        } catch (error) {
            throw error;
        }
    }

    private handleDisconnect(event: Event): void {
        if (this.intentionalDisconnect) {
            this.resetState();
            return;
        }

        if (this.isConnected() && this.reconnectAttempts() < this.maxReconnectAttempts) {
            this.reconnectAttempts.update(attempts => attempts + 1);

            this.clearReconnectTimer();
            this.reconnectTimer = setTimeout(() => {
                this.attemptReconnect();
            }, 2000);
        } else {
            this.resetState();
        }
    }

    private async attemptReconnect(): Promise<void> {
        if (!this.device || !this.device.gatt) {
            this.resetState();
            return;
        }

        try {
            this.bleServer = await this.device.gatt.connect();
            const service = await this.bleServer.getPrimaryService(MOVESENSE_BLE.SERVICE_UUID);
            this.commandChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_COMMAND_UUID);
            this.notifyChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_NOTIFY_UUID);
            await this.notifyChar.startNotifications();
            this.isConnected.set(true);

        } catch (error) {
            if (this.reconnectAttempts() < this.maxReconnectAttempts) {
                this.clearReconnectTimer();
                this.reconnectTimer = setTimeout(() => {
                    this.attemptReconnect();
                }, 3000);
            } else {
                this.resetState();
            }
        }
    }

    private resetReconnectAttempts(): void {
        this.reconnectAttempts.set(0);
        this.clearReconnectTimer();
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private handleConnectionError(error: any): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.connectionError.set(errorMessage);
        this.isConnected.set(false);
        this.resetState();
    }

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

    tryAlternativeFormats(): void {
        if (!this.isConnected()) {
            return;
        }

        // Detener todos los sensores primero (para evitar sobrecarga)
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_TEMP, 'Stop Temperature');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ACC, 'Stop Accelerometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_HR, 'Stop Heart Rate');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_GYRO, 'Stop Gyroscope');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_MAGN, 'Stop Magnetometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ECG, 'Stop ECG');

        // Formato alternativo 1
        setTimeout(() => {
            this.sendCommandRaw(MOVESENSE_COMMANDS.TEMP_ALT1, 'Temperature (Alt 1)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ACC_ALT1, 'Accelerometer (Alt 1)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.HR_ALT1, 'Heart Rate (Alt 1)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.GYRO_ALT1, 'Gyroscope (Alt 1)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.MAGN_ALT1, 'Magnetometer (Alt 1)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ECG_ALT1, 'ECG (Alt 1)');
        }, 1000);

        // Formato alternativo 2
        setTimeout(() => {
            this.sendCommandRaw(MOVESENSE_COMMANDS.TEMP_ALT2, 'Temperature (Alt 2)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ACC_ALT2, 'Accelerometer (Alt 2)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.HR_ALT2, 'Heart Rate (Alt 2)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.GYRO_ALT2, 'Gyroscope (Alt 2)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.MAGN_ALT2, 'Magnetometer (Alt 2)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ECG_ALT2, 'ECG (Alt 2)');
        }, 3000);

        // Formato alternativo 3
        setTimeout(() => {
            this.sendCommandRaw(MOVESENSE_COMMANDS.TEMP_ALT3, 'Temperature (Alt 3)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ACC_ALT3, 'Accelerometer (Alt 3)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.HR_ALT3, 'Heart Rate (Alt 3)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.GYRO_ALT3, 'Gyroscope (Alt 3)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.MAGN_ALT3, 'Magnetometer (Alt 3)');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ECG_ALT3, 'ECG (Alt 3)');
        }, 5000);

        // Probar diferentes frecuencias de muestreo
        setTimeout(() => {
            this.sendCommandRaw(MOVESENSE_COMMANDS.ACC_13HZ, 'Accelerometer 13Hz');
            this.sendCommandRaw(MOVESENSE_COMMANDS.GYRO_26HZ, 'Gyroscope 26Hz');
            this.sendCommandRaw(MOVESENSE_COMMANDS.MAGN_13HZ, 'Magnetometer 13Hz');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ECG_125HZ, 'ECG 125Hz');
        }, 7000);

        // Solicitar información del dispositivo
        setTimeout(() => {
            this.sendCommandRaw(MOVESENSE_COMMANDS.INFO, 'Device Info');
            this.sendCommandRaw(MOVESENSE_COMMANDS.BATTERY, 'Battery Level');
        }, 9000);
    }

    subscribeToSensors(): void {
        if (!this.isConnected()) {
            return;
        }

        // Detener todos los sensores primero para obtener sus respuestas "Hello"
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_TEMP, 'Stop Temperature');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ACC, 'Stop Accelerometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_HR, 'Stop Heart Rate');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_GYRO, 'Stop Gyroscope');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_MAGN, 'Stop Magnetometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ECG, 'Stop ECG');

        // Esperar un segundo para las respuestas Hello
        setTimeout(() => {
            // Enviar comandos de activación para todos los sensores
            this.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer sensor');
            this.sendCommandRaw(new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x31, 0x33]), 'Accelerometer 13Hz');
            this.sendCommandRaw(new Uint8Array([0x0c, 0x63, 0x01]), 'Heart Rate (simplified)');
            this.sendCommandRaw(new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x35, 0x32]), 'Gyroscope 52Hz');
        }, 1000);
    }

    sendRestCommand(method: number, path: string, description: string): void {
        const command = createMovesenseCommand(method, path);
        this.sendCommandRaw(command, description);
    }

    requestDeviceInfo(): void {
        if (!this.isConnected()) {
            return;
        }

        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Info', 'Device Info');
        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Energy/Level', 'Battery Level');
        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Sensors', 'Available Sensors');
    }

    tryModel202030001552Format(): void {
        if (!this.isConnected()) {
            return;
        }

        // Detener todos los sensores primero
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_TEMP, 'Stop Temperature');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ACC, 'Stop Accelerometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_HR, 'Stop Heart Rate');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_GYRO, 'Stop Gyroscope');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_MAGN, 'Stop Magnetometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ECG, 'Stop ECG');

        // Esperar a que todo se detenga
        setTimeout(() => {
            // Probar comandos específicos para este modelo en secuencia
            this.sendCommandRaw(new Uint8Array([0x01, 0x11, 0x2f, 0x53, 0x79, 0x73, 0x74, 0x65, 0x6d, 0x2f, 0x49, 0x6e, 0x66, 0x6f]), 'Request System Info');

            // Temperatura - el comando estándar parece funcionar
            this.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature (standard)');

            // Acelerómetro - probar diferentes tasas de muestreo
            setTimeout(() => this.sendCommandRaw(new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x31, 0x33]), 'Accelerometer 13Hz'), 200);
            setTimeout(() => this.sendCommandRaw(new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x35, 0x32]), 'Accelerometer 52Hz'), 400);

            // Ritmo cardíaco - probar formato simplificado
            setTimeout(() => this.sendCommandRaw(new Uint8Array([0x0c, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x48, 0x52]), 'Heart Rate (standard)'), 600);
            setTimeout(() => this.sendCommandRaw(new Uint8Array([0x0c, 0x63, 0x01]), 'Heart Rate (simplified)'), 800);

            // ECG - el formato estándar parece funcionar
            setTimeout(() => this.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG (standard)'), 1000);

            // Giroscopio - probar diferentes tasas de muestreo
            setTimeout(() => this.sendCommandRaw(new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x35, 0x32]), 'Gyroscope 52Hz'), 1200);
            setTimeout(() => this.sendCommandRaw(new Uint8Array([0x0c, 0x64, 0x01]), 'Gyroscope (simplified)'), 1400);

            // Magnetómetro - el formato estándar parece funcionar
            setTimeout(() => this.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer (standard)'), 1600);
        }, 1000);
    }
}