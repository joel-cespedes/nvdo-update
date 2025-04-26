import { Component, inject, ChangeDetectionStrategy, Signal } from '@angular/core';
import { MovesenseService } from '../../core/services/movesense.service';
import { DecimalPipe } from '@angular/common';

@Component({
    selector: 'app-magn-display',
    templateUrl: './magn-display.component.html',
    styleUrls: ['./magn-display.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DecimalPipe],
    standalone: true
})
export class MagnDisplayComponent {
    private readonly movesenseService = inject(MovesenseService);

    // Expose the signal (currently 'any', update when interface defined)
    readonly magnData: Signal<any | null> = this.movesenseService.magnetometerData;
    readonly isConnected: Signal<boolean> = this.movesenseService.isConnected;
}