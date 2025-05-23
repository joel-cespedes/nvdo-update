export const MOVESENSE_COMMANDS = {
    // Original commands
    TEMPERATURE: new Uint8Array([0x01, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x54, 0x65, 0x6d, 0x70]),
    ACCELEROMETER: new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x31, 0x30, 0x34]),
    HEART_RATE: new Uint8Array([0x0c, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x48, 0x52]),
    ECG: new Uint8Array([0x01, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x45, 0x43, 0x47, 0x2f, 0x31, 0x32, 0x35]),
    GYROSCOPE: new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x31, 0x30, 0x34]),
    MAGNETOMETER: new Uint8Array([0x0c, 0x65, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x4d, 0x61, 0x67, 0x6e, 0x2f, 0x31, 0x30, 0x34]),

    // Alternative formats
    TEMP_ALT1: new Uint8Array([0x01, 0x62, 0x01]),
    ACC_ALT1: new Uint8Array([0x0c, 0x62, 0x01]),
    HR_ALT1: new Uint8Array([0x0c, 0x63, 0x01]),
    GYRO_ALT1: new Uint8Array([0x0c, 0x64, 0x01]),
    MAGN_ALT1: new Uint8Array([0x0c, 0x65, 0x01]),
    ECG_ALT1: new Uint8Array([0x01, 0x63, 0x01]),

    TEMP_ALT2: new Uint8Array([0x01, 0x01, 0x00, 0x06]),
    ACC_ALT2: new Uint8Array([0x0c, 0x01, 0x00, 0x07]),
    HR_ALT2: new Uint8Array([0x0c, 0x01, 0x00, 0x08]),
    GYRO_ALT2: new Uint8Array([0x0c, 0x01, 0x00, 0x09]),
    MAGN_ALT2: new Uint8Array([0x0c, 0x01, 0x00, 0x0A]),
    ECG_ALT2: new Uint8Array([0x01, 0x01, 0x00, 0x0B]),

    TEMP_ALT3: new Uint8Array([0x02, 0x62, 0x01]),
    ACC_ALT3: new Uint8Array([0x02, 0x62, 0x02]),
    HR_ALT3: new Uint8Array([0x02, 0x63, 0x01]),
    GYRO_ALT3: new Uint8Array([0x02, 0x64, 0x01]),
    MAGN_ALT3: new Uint8Array([0x02, 0x65, 0x01]),
    ECG_ALT3: new Uint8Array([0x02, 0x63, 0x02]),

    // Sample rate specific commands
    ACC_13HZ: new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x31, 0x33]),
    ACC_26HZ: new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x32, 0x36]),
    ACC_52HZ: new Uint8Array([0x0c, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63, 0x2f, 0x35, 0x32]),
    GYRO_13HZ: new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x31, 0x33]),
    GYRO_26HZ: new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x32, 0x36]),
    GYRO_52HZ: new Uint8Array([0x0c, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f, 0x2f, 0x35, 0x32]),
    MAGN_13HZ: new Uint8Array([0x0c, 0x65, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x4d, 0x61, 0x67, 0x6e, 0x2f, 0x31, 0x33]),
    MAGN_26HZ: new Uint8Array([0x0c, 0x65, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x4d, 0x61, 0x67, 0x6e, 0x2f, 0x32, 0x36]),

    // ECG sample rates
    ECG_125HZ: new Uint8Array([0x01, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x45, 0x43, 0x47, 0x2f, 0x31, 0x32, 0x35]),
    ECG_250HZ: new Uint8Array([0x01, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x45, 0x43, 0x47, 0x2f, 0x32, 0x35, 0x30]),
    ECG_500HZ: new Uint8Array([0x01, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x45, 0x43, 0x47, 0x2f, 0x35, 0x30, 0x30]),

    // Stop commands
    STOP_TEMP: new Uint8Array([0x00, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x54, 0x65, 0x6d, 0x70]),
    STOP_ACC: new Uint8Array([0x00, 0x62, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x41, 0x63, 0x63]),
    STOP_HR: new Uint8Array([0x00, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x48, 0x52]),
    STOP_GYRO: new Uint8Array([0x00, 0x64, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x47, 0x79, 0x72, 0x6f]),
    STOP_MAGN: new Uint8Array([0x00, 0x65, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x4d, 0x61, 0x67, 0x6e]),
    STOP_ECG: new Uint8Array([0x00, 0x63, 0x2f, 0x4d, 0x65, 0x61, 0x73, 0x2f, 0x45, 0x43, 0x47]),

    // Information commands
    INFO: new Uint8Array([0x01, 0x11, 0x2f, 0x53, 0x79, 0x73, 0x74, 0x65, 0x6d, 0x2f, 0x49, 0x6e, 0x66, 0x6f]),
    BATTERY: new Uint8Array([0x01, 0x11, 0x2f, 0x53, 0x79, 0x73, 0x74, 0x65, 0x6d, 0x2f, 0x45, 0x6e, 0x65, 0x72, 0x67, 0x79, 0x2f, 0x4c, 0x65, 0x76, 0x65, 0x6c]),
};