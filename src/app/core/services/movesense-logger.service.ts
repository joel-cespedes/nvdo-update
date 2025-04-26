import { Injectable, signal, WritableSignal } from '@angular/core';

/**
 * Service for logging and debugging Movesense operations
 */
@Injectable({
    providedIn: 'root',
})
export class MovesenseLoggerService {
    // Log signal contains all logs as timestamp + message
    readonly logEntries: WritableSignal<string[]> = signal([]);
    readonly maxLogSize = 100; // Maximum number of log entries to keep

    constructor() {
        console.log('MovesenseLoggerService initialized');
    }

    /**
     * Add an entry to the log
     */
    log(message: string): void {
        const timestampedMessage = `${new Date().toLocaleTimeString()}: ${message}`;
        console.log(`Movesense: ${message}`);

        this.logEntries.update(entries => {
            const newEntries = [...entries, timestampedMessage];
            // Keep log size within limits
            return newEntries.slice(-this.maxLogSize);
        });
    }

    /**
     * Clear all log entries
     */
    clearLogs(): void {
        this.logEntries.set([]);
    }

    /**
     * Log with error level
     */
    error(message: string, error?: any): void {
        let errorMessage = message;

        if (error) {
            if (error instanceof Error) {
                errorMessage += `: ${error.message}`;
            } else {
                errorMessage += `: ${String(error)}`;
            }
        }

        console.error(`Movesense Error: ${errorMessage}`);
        this.log(`❌ ERROR: ${errorMessage}`);
    }

    /**
     * Log with warning level
     */
    warn(message: string): void {
        console.warn(`Movesense Warning: ${message}`);
        this.log(`⚠️ WARNING: ${message}`);
    }

    /**
     * Log with success level
     */
    success(message: string): void {
        console.log(`Movesense Success: ${message}`);
        this.log(`✅ ${message}`);
    }

    /**
     * Log buffer as hex for debugging
     */
    bufferToHex(buffer: Uint8Array): string {
        return Array.from(buffer)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ');
    }
}