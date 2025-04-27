import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { StoredEcg } from '../../core/models/ecg-storage.model';
import { MovesenseService } from '../../core/services/movesense.service';
import { FormsModule } from '@angular/forms';
import { StoredEcgViewerComponent } from '../stored-ecg-viewer/stored-ecg-viewer.component';

@Component({
  selector: 'app-stored-ecg-list',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, StoredEcgViewerComponent],
  templateUrl: './stored-ecg-list.component.html',
  styleUrl: './stored-ecg-list.component.scss'
})
export class StoredEcgListComponent {
  private movesenseService = inject(MovesenseService);

  readonly storedEcgs = computed(() => this.movesenseService.storedEcgs());
  readonly hasStoredEcgs = computed(() => this.movesenseService.hasStoredEcgs());

  selectedEcgId = signal<string | null>(null);
  newEcgName = signal<string>('');

  selectEcg(id: string): void {
    if (this.selectedEcgId() === id) {
      this.selectedEcgId.set(null);
    } else {
      this.selectedEcgId.set(id);

      // Obtener el ECG seleccionado para establecer un nombre predeterminado
      const ecg = this.movesenseService.getEcgById(id);
      if (ecg) {
        this.newEcgName.set(ecg.name || '');
      }
    }
  }

  saveEcgName(): void {
    const id = this.selectedEcgId();
    if (id && this.newEcgName()) {
      this.movesenseService.saveStoredEcg(this.newEcgName(), id);
    }
  }

  deleteEcg(id: string, event: Event): void {
    event.stopPropagation(); // Evitar que se seleccione al eliminar

    if (confirm('¿Estás seguro de que deseas eliminar este ECG?')) {
      this.movesenseService.deleteStoredEcg(id);

      if (this.selectedEcgId() === id) {
        this.selectedEcgId.set(null);
      }
    }
  }

  formatDateShort(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}