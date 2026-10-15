import { Module } from '@nestjs/common';
import { CoreModule } from './core.module.js';

/**
 * Point d'entrée du worker : le socle commun et les processors, qui ne sont déclarés qu'ici.
 * L'API ajoute des jobs dans les files mais ne les exécute jamais.
 */
@Module({
  imports: [CoreModule],
})
export class WorkerModule {}
