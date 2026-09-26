// Ecosistema PM2 (CommonJS: backend/package.json declara "type": "module").
// La URI de Atlas NO vive aquí: está en /var/www/empleados/shared/.env en el servidor.
const path = require('node:path');

const APP_DIR = '/var/www/empleados';

module.exports = {
  apps: [
    {
      name: 'gestion-empleados',
      cwd: path.join(__dirname, 'backend'),
      script: 'dist/index.js',
      node_args: '--env-file=.env',
      instances: 'max', // Modo cluster: una réplica por vCPU
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: `${APP_DIR}/logs/err.log`,
      out_file: `${APP_DIR}/logs/out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ],

  // Despliegue desde la PC local: pm2 deploy ecosystem.config.cjs production
  deploy: {
    production: {
      user: 'ubuntu',
      host: '18.116.22.239',
      ref: 'origin/main',
      repo: 'git@github.com:miguesj-hub/practica-mean-unidad2.git',
      path: APP_DIR,
      'post-deploy': [
        `mkdir -p ${APP_DIR}/logs`,
        `ln -sf ${APP_DIR}/shared/.env backend/.env`,
        'npm ci --prefix backend',
        'npm run build --prefix backend',
        'npm ci --prefix frontend',
        'NG_CLI_ANALYTICS=false npm run build --prefix frontend',
        'pm2 reload ecosystem.config.cjs --env production',
        'pm2 save'
      ].join(' && '),
      ssh_options: 'IdentityFile=~/.ssh/id_ed25519' // llave privada de la Mac, autorizada en el servidor
    }
  }
};
