import { Injectable, signal } from '@angular/core';
import { MOVESENSE_BLE, MOVESENSE_METHOD, createMovesenseCommand } from '../models/movesense-ble.model';
import { MOVESENSE_COMMANDS } from '../models/movesense-commands.model';

@Injectable({
    providedIn: 'root',
})
export class MovesenseConnectionService {
    readonly isConnected = signal<boolean>(false);
    readonly deviceName = signal<string>('');
    readonly connectionError = signal<string | null>(null);
    readonly reconnectAttempts = signal<number>(0);

    private bleServer: BluetoothRemoteGATTServer | null = null;
    private commandChar: BluetoothRemoteGATTCharacteristic | null = null;
    private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
    private device: BluetoothDevice | null = null;
    private notificationHandler: ((event: Event) => void) | null = null;
    private logbookCallback: ((data: Uint8Array) => void) | null = null;

    private commandQueue: { command: Uint8Array, description: string }[] = [];
    private isProcessingQueue = false;
    private lastCommandTime = 0;

    private reconnectTimer: number | null = null;
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

            this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

            this.bleServer = await this.device.gatt.connect();

            const service = await this.bleServer.getPrimaryService(MOVESENSE_BLE.SERVICE_UUID);
            this.commandChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_COMMAND_UUID);
            this.notifyChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_NOTIFY_UUID);

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

    setLogbookCallback(callback: (data: Uint8Array) => void): void {
        this.logbookCallback = callback;
    }

    registerNotificationHandler(handler: (event: Event) => void): void {
        if (!this.notifyChar || !this.isConnected()) {
            return;
        }

        this.unregisterNotificationHandler();
        this.notificationHandler = handler;
        this.notifyChar.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));
    }

    private handleNotifications(event: Event): void {
        try {
            const characteristic = (event.target as BluetoothRemoteGATTCharacteristic);
            const dataView = characteristic.value;

            if (!dataView) return;

            const data = new Uint8Array(dataView.buffer);
            if (data.length === 0) return;

            console.log('Notificación recibida, longitud:', data.length);

            // Verificar si es una respuesta del LogBook
            const isLogbook = this.checkIfLogbookResponse(data);

            if (isLogbook && this.logbookCallback) {
                this.logbookCallback(data);
            } else if (this.notificationHandler) {
                this.notificationHandler(event);
            }
        } catch (error) {
            console.error('Error en handleNotifications:', error);
        }
    }
    private checkIfLogbookResponse(data: Uint8Array): boolean {
        // Ignorar respuestas "Hello" (empiezan con byte 72 'H' en tercera posición)
        if (data.length === 7 && data[2] === 72) {
            return false;
        }

        // Solo aceptar mensajes que realmente vengan del LogBook
        if (data.length > 5 && (data[0] === 0x01 || data[0] === 0x02)) {
            if (data[1] === 0x2F && // '/'
                data[2] === 0x4D && // 'M'
                data[3] === 0x65 && // 'e'
                data[4] === 0x6D) { // 'm'
                console.log("Respuesta genuina de LogBook detectada");
                return true;
            }
        }

        return false;
    }


    unregisterNotificationHandler(): void {
        if (this.notifyChar && this.notificationHandler) {
            try {
                this.notifyChar.removeEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));
            } catch (e) {
                // Error silencioso
            }
            this.notificationHandler = null;
        }
    }

    sendCommandRaw(commandData: Uint8Array, commandDescription: string): void {
        this.enqueueCommand(commandData, commandDescription);
    }

    sendRestCommand(method: number, path: string, description: string): void {
        const command = createMovesenseCommand(method, path);
        this.sendCommandRaw(command, description);
    }

    subscribeToSensors(): void {
        if (!this.isConnected()) {
            return;
        }

        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_TEMP, 'Stop Temperature');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ACC, 'Stop Accelerometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_HR, 'Stop Heart Rate');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_GYRO, 'Stop Gyroscope');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_MAGN, 'Stop Magnetometer');
        this.sendCommandRaw(MOVESENSE_COMMANDS.STOP_ECG, 'Stop ECG');

        setTimeout(() => {
            this.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG sensor');
            this.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer sensor');
            this.sendCommandRaw(new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x31, 0x33]), 'Accelerometer 13Hz');
            this.sendCommandRaw(new Uint8Array([0x0c, 0x63, 0x01]), 'Heart Rate (simplified)');
            this.sendCommandRaw(new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x35, 0x32]), 'Gyroscope 52Hz');
        }, 1000);
    }

    requestDeviceInfo(): void {
        if (!this.isConnected()) {
            return;
        }

        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Info', 'Device Info');
        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Energy/Level', 'Battery Level');
        this.sendRestCommand(MOVESENSE_METHOD.GET, '/System/Sensors', 'Available Sensors');
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
            const now = Date.now();
            const timeSinceLastCommand = now - this.lastCommandTime;

            if (timeSinceLastCommand < 200) {
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastCommand));
            }

            const { command, description } = this.commandQueue.shift()!;
            await this.sendCommandDirectly(command, description);
            this.lastCommandTime = Date.now();

        } catch (error) {
            // Error silencioso
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
            this.reconnectTimer = window.setTimeout(() => {
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
                this.reconnectTimer = window.setTimeout(() => {
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
        if (this.reconnectTimer !== null) {
            window.clearTimeout(this.reconnectTimer);
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
}