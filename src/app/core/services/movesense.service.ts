import { Injectable, signal, WritableSignal, computed, Signal, effect } from '@angular/core';

// --- Interfaces for Sensor Data ---

export interface AccelerometerData {
    timestamp: number;
    x: number;
    y: number;
    z: number;
}

export interface TemperatureData {
    timestamp: number;
    measurement: number;
}

export interface HeartRateData {
    timestamp: number;
    hr: number;
    rrIntervals?: number[]; // Optional RR intervals if available
}

export interface EcgData {
    timestamp: number;
    samples: number[]; // Array of ECG sample values
}

// Add interfaces for other sensors like Gyroscope, Magnetometer, IMU as needed
// export interface ImuData { ... }

// --- Service Implementation ---

@Injectable({
    providedIn: 'root',
})
export class MovesenseService {
    // --- Connection State ---
    readonly isConnected: WritableSignal<boolean> = signal(false);
    readonly deviceName: WritableSignal<string> = signal('');
    readonly connectionError: WritableSignal<string | null> = signal(null);

    // --- Sensor Data Signals ---
    readonly rawData: WritableSignal<ArrayBuffer | null> = signal(null); // Store raw ArrayBuffer
    readonly temperatureData: WritableSignal<TemperatureData | null> = signal(null);
    readonly accelerometerData: WritableSignal<AccelerometerData[] | null> = signal(null); // Acc often sends multiple samples
    readonly heartRateData: WritableSignal<HeartRateData | null> = signal(null);
    readonly ecgData: WritableSignal<EcgData | null> = signal(null);
    // Add signals for other sensors:
    // readonly imuData: WritableSignal<ImuData | null> = signal(null);

    // --- Private BLE Properties ---
    private readonly MOVESENSE_SERVICE_UUID = '34802252-7185-4d5d-b431-630e7050e8f0';
    private readonly MOVESENSE_COMMAND_CHAR_UUID = '34800001-7185-4d5d-b431-630e7050e8f0';
    private readonly MOVESENSE_NOTIFY_CHAR_UUID = '34800002-7185-4d5d-b431-630e7050e8f0';

    private bleServer: BluetoothRemoteGATTServer | null = null;
    private commandChar: BluetoothRemoteGATTCharacteristic | null = null;
    private notifyChar: BluetoothRemoteGATTCharacteristic | null = null;

    // --- Movesense Command Payloads (Hex Arrays) ---
    // Note: These need verification against documentation. Prefixes like 0x01/0x02 are likely request IDs.
    //       Paths are URI-encoded strings.
    // Format: [RequestID, Verb (1=SUB, 2=UNSUB, 3=GET...), PathLength, ...Path] {Optional JSON Payload}

    // Subscribe commands (using Request ID 1 for SUB)
    private readonly SUBSCRIBE_TEMP = this.buildCommand(1, '/Meas/Temp'); // Temperature
    private readonly SUBSCRIBE_ACC_104 = this.buildCommand(2, '/Meas/Acc/104'); // Accelerometer 104 Hz
    private readonly SUBSCRIBE_HR = this.buildCommand(3, '/Meas/HR'); // Heart Rate
    // --- Guessed Commands (NEED VERIFICATION) ---
    private readonly SUBSCRIBE_ECG_128 = this.buildCommand(4, '/Meas/ECG/128'); // ECG 128 Hz
    private readonly SUBSCRIBE_IMU6_52 = this.buildCommand(5, '/Meas/IMU6/52'); // IMU 6-axis 52 Hz (Acc+Gyro)

    // Unsubscribe commands (using Request ID + 100 for UNSUB, arbitrary choice)
    private readonly UNSUBSCRIBE_TEMP = this.buildCommand(101, '/Meas/Temp', 2); // 2 = UNSUBSCRIBE
    private readonly UNSUBSCRIBE_ACC_104 = this.buildCommand(102, '/Meas/Acc/104', 2);
    private readonly UNSUBSCRIBE_HR = this.buildCommand(103, '/Meas/HR', 2);
    private readonly UNSUBSCRIBE_ECG_128 = this.buildCommand(104, '/Meas/ECG/128', 2);
    private readonly UNSUBSCRIBE_IMU6_52 = this.buildCommand(105, '/Meas/IMU6/52', 2);

    // --- Logging Commands (PLACEHOLDERS - NEED VERIFICATION) ---
    // These likely require JSON payloads specifying log details
    private readonly START_LOGGING = this.buildCommand(201, '/Mem/Log/Start'); // Needs payload
    private readonly STOP_LOGGING = this.buildCommand(202, '/Mem/Log/Stop');
    private readonly GET_LOG_ENTRIES = this.buildCommand(203, '/Mem/Log/Entries', 3); // 3 = GET
    // private readonly GET_LOG_DATA = (entryId: number) => this.buildCommand(204, `/Mem/Data/${entryId}`, 3); // Needs dynamic entryId

    constructor() {
        // Effect to log raw data changes (for debugging)
        effect(() => {
            const data = this.rawData();
            if (data) {
                const rawBytes = Array.from(new Uint8Array(data));
                console.log('📥 Raw Data Received:', rawBytes);
                this.parseNotification(data); // Parse the data when it changes
            }
        });
    }

    // --- Public Methods ---

    async connect(): Promise<void> {
        this.connectionError.set(null);
        try {
            console.log('Requesting Bluetooth device...');
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'Movesense' }],
                optionalServices: [this.MOVESENSE_SERVICE_UUID],
            });

            if (!device.gatt) {
                throw new Error('GATT Server not available.');
            }

            this.deviceName.set(device.name || 'Movesense Device');
            console.log(`Connecting to GATT Server on ${this.deviceName()}...`);
            this.bleServer = await device.gatt.connect();
            console.log('Connected to GATT Server.');

            // Handle disconnects
            device.addEventListener('gattserverdisconnected', () => this.onDisconnected());

            console.log(`Getting Service: ${this.MOVESENSE_SERVICE_UUID}`);
            const service = await this.bleServer.getPrimaryService(this.MOVESENSE_SERVICE_UUID);

            console.log(`Getting Command Characteristic: ${this.MOVESENSE_COMMAND_CHAR_UUID}`);
            this.commandChar = await service.getCharacteristic(this.MOVESENSE_COMMAND_CHAR_UUID);

            console.log(`Getting Notify Characteristic: ${this.MOVESENSE_NOTIFY_CHAR_UUID}`);
            this.notifyChar = await service.getCharacteristic(this.MOVESENSE_NOTIFY_CHAR_UUID);

            console.log('Starting notifications...');
            await this.notifyChar.startNotifications();
            this.notifyChar.addEventListener('characteristicvaluechanged', (event) => this.handleNotification(event));
            console.log('✅ Notifications started.');

            this.isConnected.set(true);
            console.log('✅ Movesense device connected successfully.');

            // Automatically subscribe to sensors upon connection
            await this.subscribeToSensors();

        } catch (error) {
            console.error('❌ Error connecting to Movesense device:', error);
            this.connectionError.set(error instanceof Error ? error.message : String(error));
            this.isConnected.set(false);
            this.resetState();
        }
    }

    async disconnect(): Promise<void> {
        if (!this.bleServer || !this.isConnected()) {
            console.warn('⚠️ Not connected.');
            return;
        }

        try {
            // Unsubscribe before disconnecting (optional, but good practice)
            await this.unsubscribeFromAllSensors();

            console.log('Disconnecting from GATT Server...');
            this.bleServer.disconnect();
            // onDisconnected() will handle state reset
        } catch (error) {
            console.error('❌ Error disconnecting:', error);
            // Force state reset even if unsubscribe fails
            this.onDisconnected();
        }
    }

    async subscribeToTemperature(): Promise<void> {
        await this.sendCommand(this.SUBSCRIBE_TEMP, 'Subscribe Temperature');
    }

    async subscribeToAccelerometer(): Promise<void> {
        await this.sendCommand(this.SUBSCRIBE_ACC_104, 'Subscribe Accelerometer (104Hz)');
    }

    async subscribeToHeartRate(): Promise<void> {
        await this.sendCommand(this.SUBSCRIBE_HR, 'Subscribe Heart Rate');
    }

    async subscribeToEcg(): Promise<void> {
        await this.sendCommand(this.SUBSCRIBE_ECG_128, 'Subscribe ECG (128Hz)');
    }

    async subscribeToImu(): Promise<void> {
        await this.sendCommand(this.SUBSCRIBE_IMU6_52, 'Subscribe IMU (52Hz)');
    }

    async subscribeToSensors(): Promise<void> {
        console.log('Subscribing to all sensors...');
        await this.subscribeToTemperature();
        await this.subscribeToAccelerometer();
        await this.subscribeToHeartRate();
        await this.subscribeToEcg(); // Add ECG
        // await this.subscribeToImu(); // Add IMU if needed
        console.log('✅ Subscribed to sensors.');
    }

    async unsubscribeFromAllSensors(): Promise<void> {
        console.log('Unsubscribing from all sensors...');
        // Send unsubscribe commands - implement based on actual API if needed
        await this.sendCommand(this.UNSUBSCRIBE_TEMP, 'Unsubscribe Temperature');
        await this.sendCommand(this.UNSUBSCRIBE_ACC_104, 'Unsubscribe Accelerometer');
        await this.sendCommand(this.UNSUBSCRIBE_HR, 'Unsubscribe Heart Rate');
        await this.sendCommand(this.UNSUBSCRIBE_ECG_128, 'Unsubscribe ECG');
        // await this.sendCommand(this.UNSUBSCRIBE_IMU6_52, 'Unsubscribe IMU');
        console.log('✅ Unsubscribed from sensors.');
    }

    // --- Placeholder Logging Methods ---
    async startLogging(): Promise<void> {
        console.warn('⚠️ startLogging() needs implementation with correct command and payload.');
        // await this.sendCommand(this.START_LOGGING, 'Start Logging'); // Needs payload
    }

    async stopLogging(): Promise<void> {
        console.warn('⚠️ stopLogging() needs implementation with correct command.');
        // await this.sendCommand(this.STOP_LOGGING, 'Stop Logging');
    }

    async getLogEntries(): Promise<void> {
        console.warn('⚠️ getLogEntries() needs implementation with correct command.');
        // await this.sendCommand(this.GET_LOG_ENTRIES, 'Get Log Entries');
        // Response should be parsed in handleNotification
    }

    async getLogData(entryId: number): Promise<void> {
        console.warn(`⚠️ getLogData(${entryId}) needs implementation with correct command.`);
        // const command = this.GET_LOG_DATA(entryId);
        // await this.sendCommand(command, `Get Log Data ${entryId}`);
        // Response should be parsed in handleNotification
    }


    // --- Private Helper Methods ---

    private onDisconnected(): void {
        console.log('Disconnected from GATT Server.');
        this.isConnected.set(false);
        this.resetState();
    }

    private resetState(): void {
        this.deviceName.set('');
        this.bleServer = null;
        this.commandChar = null;
        this.notifyChar = null;
        this.rawData.set(null);
        this.temperatureData.set(null);
        this.accelerometerData.set(null);
        this.heartRateData.set(null);
        this.ecgData.set(null);
        // Reset other sensor signals
    }

    /**
     * Builds a Movesense command buffer.
     * Format: [RequestID, Verb (1=SUB, 2=UNSUB, 3=GET...), PathLength, ...Path] {Optional JSON Payload}
     * @param requestId A unique ID for the request (byte).
     * @param path The resource path string (e.g., "/Meas/Temp").
     * @param verb The operation type (1=SUB, 2=UNSUB, 3=GET, default=1).
     * @param payload Optional JSON object payload.
     * @returns Uint8Array representing the command.
     */
    private buildCommand(requestId: number, path: string, verb: number = 1, payload?: object): Uint8Array {
        const pathEncoder = new TextEncoder();
        const pathBytes = pathEncoder.encode(path);
        let payloadBytes = new Uint8Array(0);

        if (payload) {
            // TODO: Implement JSON payload handling if needed for specific commands (like logging)
            console.warn(`Payload ignored for command ${path}. JSON serialization not implemented.`);
            // const payloadString = JSON.stringify(payload);
            // payloadBytes = pathEncoder.encode(payloadString);
        }

        const bufferLength = 3 + pathBytes.length + payloadBytes.length;
        const command = new Uint8Array(bufferLength);
        const dataView = new DataView(command.buffer);

        dataView.setUint8(0, requestId); // Request ID
        dataView.setUint8(1, verb);      // Verb (1: SUB, 2: UNSUB, 3: GET)
        dataView.setUint8(2, pathBytes.length); // Path length

        command.set(pathBytes, 3); // Path bytes
        command.set(payloadBytes, 3 + pathBytes.length); // Payload bytes (if any)

        return command;
    }


    private async sendCommand(command: Uint8Array, description: string): Promise<void> {
        if (!this.commandChar || !this.isConnected()) {
            console.error(`❌ Cannot send command "${description}": Not connected or characteristic not available.`);
            this.connectionError.set(`Cannot send command "${description}": Not connected.`);
            return;
        }

        try {
            // console.log(`➡️ Sending command "${description}":`, Array.from(command));
            await this.commandChar.writeValueWithoutResponse(command.buffer); // Use writeValueWithoutResponse for commands
            console.log(`✅ Command "${description}" sent.`);
        } catch (error) {
            console.error(`❌ Error sending command "${description}":`, error);
            this.connectionError.set(`Error sending command "${description}": ${error instanceof Error ? error.message : String(error)}`);
            // Consider attempting to disconnect or reset state on send failure
            // await this.disconnect();
        }
    }

    private handleNotification(event: Event): void {
        console.log('--- Notification Received ---', event); // <-- ADD THIS LOG
        const target = event.target as BluetoothRemoteGATTCharacteristic | null;
        if (!target?.value) {
            console.warn('⚠️ Notification received with empty value.');
            return;
        }
        // Set the raw data signal, the effect will trigger parsing
        this.rawData.set(target.value.buffer);
    }

    /**
     * Parses incoming data from the notification characteristic.
     * Needs detailed implementation based on Movesense data formats.
     * @param data The ArrayBuffer received from the device.
     */
    private parseNotification(data: ArrayBuffer): void {
        const dataView = new DataView(data);
        if (data.byteLength < 2) {
            console.warn('❓ Received data too short:', Array.from(new Uint8Array(data)));
            return;
        }

        const responseId = dataView.getUint8(0); // Usually matches the request ID
        const statusCode = dataView.getUint8(1); // 200 OK, 201 Created, 4xx Error, etc.

        // console.log(`Response ID: ${responseId}, Status: ${statusCode}`);

        if (statusCode >= 400) {
            console.error(`❌ Error response received (ID: ${responseId}, Status: ${statusCode}):`, Array.from(new Uint8Array(data)));
            // Optionally parse error message if format is known
            return;
        }

        // --- Data Parsing Logic (Needs Refinement based on Documentation) ---
        // This switch uses the *responseId* which should correspond to the *requestId* sent
        // when subscribing. This assumes the device echoes the ID back.
        // Alternatively, parsing might depend solely on the *path* or *data structure/length*.

        switch (responseId) {
            case 1: // Temperature (Assuming responseId 1 corresponds to SUBSCRIBE_TEMP requestId 1)
                if (data.byteLength >= 10 && statusCode === 200) { // Example length check
                    try {
                        // Assuming format: { Timestamp: uint32, Measurement: float32 } starting at byte 2
                        const timestamp = dataView.getUint32(2, true); // Little-endian
                        const measurement = dataView.getFloat32(6, true); // Little-endian
                        this.temperatureData.set({ timestamp, measurement });
                        // console.log('🌡️ Temperature:', this.temperatureData());
                    } catch (e) { console.error("Error parsing Temp:", e, Array.from(new Uint8Array(data))); }
                } else { console.warn('❓ Unexpected Temp data format/status:', statusCode, Array.from(new Uint8Array(data))); }
                break;

            case 2: // Accelerometer (Assuming responseId 2 corresponds to SUBSCRIBE_ACC_104 requestId 2)
                if (data.byteLength >= 14 && statusCode === 200) { // Example: Timestamp (4) + 3 * Float32 (12) = 16? Or multiple samples?
                    try {
                        // This parsing is a GUESS - assumes single sample: Timestamp + X + Y + Z
                        // Format: { Timestamp: uint32, Array[{x: float32, y: float32, z: float32}] }
                        // The actual format might contain multiple samples per notification.
                        const timestamp = dataView.getUint32(2, true);
                        // Assuming only ONE sample per notification for simplicity here.
                        // Adjust if multiple samples are packed (check byteLength).
                        const x = dataView.getFloat32(6, true);
                        const y = dataView.getFloat32(10, true);
                        const z = dataView.getFloat32(14, true); // Needs byteLength >= 18
                        if (data.byteLength >= 18) {
                            this.accelerometerData.set([{ timestamp, x, y, z }]);
                            // console.log('📏 Accelerometer:', this.accelerometerData());
                        } else { console.warn('❓ Unexpected Acc data length for full sample:', Array.from(new Uint8Array(data))); }
                    } catch (e) { console.error("Error parsing Acc:", e, Array.from(new Uint8Array(data))); }
                } else { console.warn('❓ Unexpected Acc data format/status:', statusCode, Array.from(new Uint8Array(data))); }
                break;

            case 3: // Heart Rate (Assuming responseId 3 corresponds to SUBSCRIBE_HR requestId 3)
                if (data.byteLength >= 8 && statusCode === 200) { // Example: Timestamp (4)? + HR (float32/uint16?)
                    try {
                        // Assuming format: { hr: float32 } starting at byte 2 (NO Timestamp?)
                        // Or maybe { Timestamp: uint32, hr: uint16 } ?
                        // The example code used getFloat32(2, true) on length 8 data. Let's try that.
                        const hr = dataView.getFloat32(2, true); // Assuming float HR starting at byte 2
                        // Timestamp might be missing or elsewhere. Using Date.now() for now.
                        this.heartRateData.set({ timestamp: Date.now(), hr });
                        // console.log('❤️ Heart Rate:', this.heartRateData());
                    } catch (e) { console.error("Error parsing HR:", e, Array.from(new Uint8Array(data))); }
                } else { console.warn('❓ Unexpected HR data format/status:', statusCode, Array.from(new Uint8Array(data))); }
                break;

            case 4: // ECG (Assuming responseId 4 corresponds to SUBSCRIBE_ECG_128 requestId 4)
                if (data.byteLength > 6 && statusCode === 200) { // Example: Timestamp (4) + Samples[]
                    try {
                        const timestamp = dataView.getUint32(2, true); // Assuming timestamp at byte 2
                        const samples: number[] = [];
                        // Assuming samples start at byte 6 and are int16? uint16? float32?
                        // Let's assume int16 for now.
                        for (let i = 6; i < data.byteLength; i += 2) {
                            if (i + 1 < data.byteLength) { // Ensure we don't read past the buffer
                                samples.push(dataView.getInt16(i, true)); // Little-endian
                            }
                        }
                        this.ecgData.set({ timestamp, samples });
                        // console.log('📈 ECG Data:', this.ecgData());
                    } catch (e) { console.error("Error parsing ECG:", e, Array.from(new Uint8Array(data))); }
                } else { console.warn('❓ Unexpected ECG data format/status:', statusCode, Array.from(new Uint8Array(data))); }
                break;

            // Add cases for IMU (5), Log responses (201-204), etc.

            default:
                console.warn(`❓ Unhandled response ID ${responseId} or status ${statusCode}:`, Array.from(new Uint8Array(data)));
        }
    }
}