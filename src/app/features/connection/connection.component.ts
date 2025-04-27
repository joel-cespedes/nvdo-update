import { Component, inject, computed } from '@angular/core';
import { MovesenseService } from '../../core/services/movesense.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-connection',
    templateUrl: './connection.component.html',
    styleUrls: ['./connection.component.scss'],
    imports: [CommonModule]
})
export class ConnectionComponent {
    private movesenseService = inject(MovesenseService);

    // Exponer signals como computeds
    readonly isConnected = computed(() => this.movesenseService.isConnected());
    readonly deviceName = computed(() => this.movesenseService.deviceName());
    readonly connectionError = computed(() => this.movesenseService.connectionError());

    connect(): void {
        this.movesenseService.connect();
    }

    disconnect(): void {
        this.movesenseService.disconnect();
    }
}