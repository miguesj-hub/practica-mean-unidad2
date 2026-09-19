import app from './app.js';
import { connectDatabase } from './infrastructure/persistence/mongoose/connection.js';

/** Bootstrap: levanta la infraestructura y luego el servidor HTTP. */
const port = app.get('puerto');

await connectDatabase();

app.listen(port, () => {
  console.log('Servidor escuchando en el puerto ' + port);
});
