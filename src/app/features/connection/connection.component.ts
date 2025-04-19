import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
    selector: 'app-connection',
    templateUrl: './connection.component.html',
    styleUrls: ['./connection.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    // standalone: true is default in Angular 19+ schematics, but explicit for clarity if needed
})
export class ConnectionComponent {
    private readonly movesenseService = inject(MovesenseService);

    // Expose signals directly from the service
    readonly isConnected = this.movesenseService.isConnected;
    readonly deviceName = this.movesenseService.deviceName;
    readonly connectionError = this.movesenseService.connectionError;

    connect(): void {
        // No need for async/await here, the service handles it
        this.movesenseService.connect();
    }

    disconnect(): void {
        this.movesenseService.disconnect();
    }
}