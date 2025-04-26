import { Injectable, signal, WritableSignal } from '@angular/core';
import { MOVESENSE_BLE, MOVESENSE_COMMANDS } from './models/movesense.model';
import { MovesenseLoggerService } from './movesense-logger.service';

@Injectable({
    providedIn: 'root',
})
export class MovesenseConnectionService {
    // --- Connection State ---
    readonly isConnected: WritableSignal<boolean> = signal(false);
    readonly deviceName: WritableSignal<string> = signal('');
    readonly connectionError: WritableSignal<string | null> = signal(null);
    readonly reconnectAttempts: WritableSignal<number> = signal(0);

    // --- BLE Properties ---
    private bleServer: BluetoothRemoteGATTServer | null = null;
    private commandChar: BluetoothRemoteGATTCharacteristic | null = null;
    private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
    private device: BluetoothDevice | null = null;
    private notificationHandler: ((event: Event) => void) | null = null;

    // --- Command Queue ---
    private commandQueue: { command: Uint8Array, description: string }[] = [];
    private isProcessingQueue = false;
    private lastCommandTime = 0;

    // --- Reconnection ---
    private reconnectTimer: any = null;
    private maxReconnectAttempts = 3;

    constructor(private logger: MovesenseLoggerService) {
        console.log('MovesenseConnectionService initialized');
    }

    /**
     * Connect to a Movesense device
     */
    async connect(): Promise<void> {
        this.connectionError.set(null);
        this.resetReconnectAttempts();
        this.logger.log('Requesting Bluetooth device...');

        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'Movesense' }],
                optionalServices: [MOVESENSE_BLE.SERVICE_UUID],
            });

            if (!this.device.gatt) {
                throw new Error('GATT Server not available.');
            }

            this.deviceName.set(this.device.name || 'Movesense Device');
            this.logger.log(`Connecting to GATT Server on ${this.deviceName()}...`);

            // Setup disconnect handler
            this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

            // Establish connection
            this.bleServer = await this.device.gatt.connect();
            this.logger.log('Connected to GATT Server.');

            // Get service and characteristics
            const service = await this.bleServer.getPrimaryService(MOVESENSE_BLE.SERVICE_UUID);
            this.logger.log(`Got service: ${MOVESENSE_BLE.SERVICE_UUID}`);

            this.commandChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_COMMAND_UUID);
            this.logger.log(`Got command characteristic: ${MOVESENSE_BLE.CHAR_COMMAND_UUID}`);

            this.notifyChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_NOTIFY_UUID);
            this.logger.log(`Got notify characteristic: ${MOVESENSE_BLE.CHAR_NOTIFY_UUID}`);

            // Start notifications
            await this.notifyChar.startNotifications();
            this.logger.log('✅ Notifications started.');

            this.isConnected.set(true);
            this.logger.log('✅ Movesense device connected successfully.');

        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    /**
     * Disconnect from the device
     */
    async disconnect(): Promise<void> {
        if (!this.bleServer || !this.isConnected()) {
            this.logger.log('⚠️ Not connected, no need to disconnect.');
            return;
        }

        this.logger.log('Disconnecting from GATT Server...');
        this.clearReconnectTimer();
        this.bleServer.disconnect();
    }

    /**
     * Register a notification handler
     */
    registerNotificationHandler(handler: (event: Event) => void): void {
        if (!this.notifyChar || !this.isConnected()) {
            this.logger.error('Cannot register notification handler: Not connected');
            return;
        }

        // Remove existing handler if any
        this.unregisterNotificationHandler();

        // Store new handler
        this.notificationHandler = handler;

        // Add event listener
        this.notifyChar.addEventListener('characteristicvaluechanged', handler);

        this.logger.log('Notification handler registered');
    }

    /**
     * Unregister notification handler
     */
    unregisterNotificationHandler(): void {
        if (this.notifyChar && this.notificationHandler) {
            try {
                this.notifyChar.removeEventListener('characteristicvaluechanged', this.notificationHandler);
                this.logger.log('Notification handler unregistered');
            } catch (e) {
                this.logger.error('Error removing notification listener', e);
            }
            this.notificationHandler = null;
        }
    }

    /**
     * Send a raw command with a specific byte array
     * This is the method that actually works with the device
     */
    sendCommandRaw(commandData: Uint8Array, commandDescription: string): void {
        this.enqueueCommand(commandData, commandDescription);
    }

    /**
     * Get notification characteristic for adding event listeners
     */
    getNotifyCharacteristic(): BluetoothRemoteGATTCharacteristic | null {
        return this.notifyChar;
    }

    /**
     * Subscribe to sensors using the device-specific format
     */
    subscribeToSensors(): void {
        if (!this.isConnected()) {
            this.logger.warn('Cannot subscribe to sensors: Not connected');
            return;
        }

        this.logger.log('Subscribing to sensors with specific format commands...');

        // Temperature
        this.sendCommandRaw(MOVESENSE_COMMANDS.TEMPERATURE, 'Temperature sensor');

        // Accelerometer
        this.sendCommandRaw(MOVESENSE_COMMANDS.ACCELEROMETER, 'Accelerometer sensor');

        // Heart rate
        this.sendCommandRaw(MOVESENSE_COMMANDS.HEART_RATE, 'Heart rate sensor');

        // Gyroscope
        this.sendCommandRaw(MOVESENSE_COMMANDS.GYROSCOPE, 'Gyroscope sensor');

        // Magnetometer
        this.sendCommandRaw(MOVESENSE_COMMANDS.MAGNETOMETER, 'Magnetometer sensor');

        // ECG (may not be available on all devices)
        this.sendCommandRaw(MOVESENSE_COMMANDS.ECG, 'ECG sensor');
    }

    // --- Private Methods ---

    /**
     * Add a command to the queue
     */
    private enqueueCommand(command: Uint8Array, description: string): void {
        this.commandQueue.push({ command, description });
        this.processCommandQueue();
    }

    /**
     * Process the command queue
     */
    private async processCommandQueue(): Promise<void> {
        if (this.isProcessingQueue || this.commandQueue.length === 0 || !this.isConnected()) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Rate limit commands
            const now = Date.now();
            const timeSinceLastCommand = now - this.lastCommandTime;

            if (timeSinceLastCommand < 200) {
                await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastCommand));
            }

            const { command, description } = this.commandQueue.shift()!;
            await this.sendCommandDirectly(command, description);
            this.lastCommandTime = Date.now();

        } catch (error) {
            this.logger.error('Error processing command queue', error);
        } finally {
            this.isProcessingQueue = false;

            // Process next command if any
            if (this.commandQueue.length > 0) {
                setTimeout(() => this.processCommandQueue(), 50);
            }
        }
    }

    /**
     * Send command directly to device
     */
    private async sendCommandDirectly(commandData: Uint8Array, commandDescription: string): Promise<void> {
        if (!this.commandChar || !this.isConnected()) {
            this.logger.error(`Cannot send command "${commandDescription}": not connected`);
            return Promise.reject('Device not connected');
        }

        this.logger.log(`Sending command: ${commandDescription}`);

        try {
            await this.commandChar.writeValue(commandData);
            this.logger.log(`✅ Command sent: ${commandDescription}`);
            console.log(`✅ Command sent: ${commandDescription} - data:`, Array.from(commandData));
        } catch (error) {
            this.logger.error(`Failed to send command "${commandDescription}"`, error);
            throw error;
        }
    }

    /**
     * Handle when device disconnects
     */
    private handleDisconnect(event: Event): void {
        this.logger.log('Device disconnected');

        // Check if we should try to reconnect
        if (this.isConnected() && this.reconnectAttempts() < this.maxReconnectAttempts) {
            this.reconnectAttempts.update(attempts => attempts + 1);
            this.logger.log(`Scheduling reconnect attempt ${this.reconnectAttempts()}/${this.maxReconnectAttempts}`);

            // Schedule reconnection
            this.clearReconnectTimer();
            this.reconnectTimer = setTimeout(() => {
                this.attemptReconnect();
            }, 2000); // Wait 2 seconds before reconnecting
        } else {
            this.resetState();
        }
    }

    /**
     * Attempt to reconnect to the device
     */
    private async attemptReconnect(): Promise<void> {
        if (!this.device || !this.device.gatt) {
            this.logger.log('Cannot reconnect: device reference lost');
            this.resetState();
            return;
        }

        try {
            this.logger.log(`Reconnect attempt ${this.reconnectAttempts()}/${this.maxReconnectAttempts}...`);

            // Establish connection
            this.bleServer = await this.device.gatt.connect();
            this.logger.log('Connected to GATT Server.');

            // Get service and characteristics
            const service = await this.bleServer.getPrimaryService(MOVESENSE_BLE.SERVICE_UUID);
            this.commandChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_COMMAND_UUID);
            this.notifyChar = await service.getCharacteristic(MOVESENSE_BLE.CHAR_NOTIFY_UUID);

            // Start notifications
            await this.notifyChar.startNotifications();

            this.isConnected.set(true);
            this.logger.log('✅ Reconnected successfully');

        } catch (error) {
            this.logger.error('Reconnection failed', error);

            // Schedule another attempt if we haven't reached the limit
            if (this.reconnectAttempts() < this.maxReconnectAttempts) {
                this.clearReconnectTimer();
                this.reconnectTimer = setTimeout(() => {
                    this.attemptReconnect();
                }, 3000); // Increasing backoff
            } else {
                this.logger.log('Max reconnection attempts reached. Giving up.');
                this.resetState();
            }
        }
    }

    /**
     * Reset reconnect attempts counter
     */
    private resetReconnectAttempts(): void {
        this.reconnectAttempts.set(0);
        this.clearReconnectTimer();
    }

    /**
     * Clear reconnect timer
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Handle connection error
     */
    private handleConnectionError(error: any): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Connection error', error);
        this.connectionError.set(errorMessage);
        this.isConnected.set(false);
        this.resetState();
    }

    /**
     * Reset all connection state
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

        this.logger.log('Connection state reset');
    }
}