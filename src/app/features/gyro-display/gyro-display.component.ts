import { Component, inject, ChangeDetectionStrategy, Signal } from '@angular/core';
import { MovesenseService } from '../../core/services/movesense.service';
import { DecimalPipe } from '@angular/common';

@Component({
    selector: 'app-gyro-display',
    templateUrl: './gyro-display.component.html',
    styleUrls: ['./gyro-display.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DecimalPipe],
    standalone: true
})
export class GyroDisplayComponent {
    private readonly movesenseService = inject(MovesenseService);

    // Expose the signal
    readonly gyroData: Signal<any | null> = this.movesenseService.gyroscopeData;
    readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;
}