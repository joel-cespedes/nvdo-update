
export interface StoredEcg {
    id: string;
    timestamp: number;
    samples: number[];
    duration: number; // Duración en segundos
    name?: string;    // Nombre opcional para el registro
}