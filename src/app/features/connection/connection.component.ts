import { Component, inject, linkedSignal } from '@angular/core';
import { MovesenseService } from '../../core/services/movesense.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-connection',
    templateUrl: './connection.component.html',
    styleUrls: ['./connection.component.scss'],
    standalone: true,
    imports: [CommonModule]
})
export class ConnectionComponent {
    private movesenseService = inject(MovesenseService);

    readonly isConnected = linkedSignal(this.movesenseService.isConnected);
    readonly deviceName = linkedSignal(this.movesenseService.deviceName);
    readonly connectionError = linkedSignal(this.movesenseService.connectionError);

    connect(): void {
        this.movesenseService.connect();
    }

    disconnect(): void {
        this.movesenseService.disconnect();
    }
}