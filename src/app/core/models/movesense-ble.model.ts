export const MOVESENSE_BLE = {
    SERVICE_UUID: '34802252-7185-4d5d-b431-630e7050e8f0',
    CHAR_COMMAND_UUID: '34800001-7185-4d5d-b431-630e7050e8f0', // Write
    CHAR_NOTIFY_UUID: '34800002-7185-4d5d-b431-630e7050e8f0',  // Notify
};

export const MOVESENSE_METHOD = {
    GET: 0x01,
    PUT: 0x02,
    POST: 0x03,
    DELETE: 0x04,
    SUBSCRIBE: 0x0c,
    UNSUBSCRIBE: 0x00
};

export function createMovesenseCommand(method: number, path: string): Uint8Array {
    const pathBytes = new TextEncoder().encode(path);
    const command = new Uint8Array(pathBytes.length + 1);
    command[0] = method;
    command.set(pathBytes, 1);
    return command;
}