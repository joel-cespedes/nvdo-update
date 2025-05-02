import { Component, inject, linkedSignal } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { MovesenseService } from '../../core/services/movesense.service';

@Component({
    selector: 'app-temperature-display',
    templateUrl: './temperature-display.component.html',
    styleUrls: ['./temperature-display.component.scss'],
    standalone: true,
    imports: [CommonModule, DecimalPipe, DatePipe]
})
export class TemperatureDisplayComponent {
    private movesenseService = inject(MovesenseService);

    // Link signals directly from service
    readonly temperatureData = linkedSignal(this.movesenseService.temperatureData);
    readonly isConnected = linkedSignal(this.movesenseService.isConnected);
}