// Conexión al motor de persistencia. Detalle de infraestructura.
import mongoose from 'mongoose';

/**
 * Pool de conexiones precalentado.
 *
 * Contra Atlas, cada conexión nueva cuesta alrededor de 1 s (DNS SRV, TCP,
 * TLS y autenticación). Con el pool por defecto se empieza con una sola
 * conexión y las siguientes se abren bajo demanda, así que ese segundo lo
 * paga la petición que llega cuando no hay una libre: son los máximos de
 * ~1,000 ms que aparecen en cada ventana de la prueba de estrés.
 *
 * - minPoolSize: conexiones que el driver mantiene abiertas siempre.
 * - maxConnecting: cuántas puede abrir en paralelo. Por defecto son 2, y
 *   con ese valor el pool tarda ~10 s en llegar al mínimo.
 */
const POOL_OPTIONS = {
  minPoolSize: 20,
  maxPoolSize: 100,
  maxConnecting: 20
} as const;

/**
 * Abre de una vez las conexiones mínimas antes de aceptar tráfico.
 *
 * Por sí solo, minPoolSize llena el pool en segundo plano a razón de una
 * conexión por segundo. Una ráfaga de pings concurrentes obliga al driver
 * a abrirlas todas en paralelo (~1.3 s contra Atlas).
 */
const warmUpPool = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) return;
  await Promise.all(
    Array.from({ length: POOL_OPTIONS.minPoolSize }, () => db.command({ ping: 1 }))
  );
};

export const connectDatabase = async (): Promise<void> => {
  const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1/usuarios_db';
  try {
    await mongoose.connect(MONGO_URI, POOL_OPTIONS);
    await warmUpPool();
    console.log(
      `🔄 [Database]: Conexión exitosa a MongoDB (pool precalentado: ${POOL_OPTIONS.minPoolSize} conexiones)`
    );
  } catch (error) {
    console.error('❌ Error crítico al conectar a la base de datos:', error);
    process.exit(1);
  }
};
