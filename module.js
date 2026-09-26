module.exports = {
    apps: [{
        name: "mi-node-app",
        script: "./index.js",
        instances: "max", // Modo Cluster: usa todos los núcleos de la CPU
        exec_mode: "cluster",
        // Producción: Variables de entorno protegidas
        env: {
            NODE_ENV: "production",
            PORT: 3000,
            DB_HOST: "://amazonaws.com",
            DB_USER: "",
            DB_PASS: ""
        },
        // Logs y Monitoreo del Servidor
        error_file: "/var/www/empleados/logs/err.log",
        out_file: "/var/www/empleados/logs/out.log",
        log_date_format: "YYYY-MM-DD HH:mm:ss Z",
        merge_logs: true
    }],
    // Automatización del Despliegue desde tu PC local
    deploy: {
        production: {
            user: 'ubuntu',
            host: '18.116.22.239',
            ref: 'origin/main',
            repo: 'git@github.com:miguesj-hub/practica-mean-unidad2.git',
            path: '/var/www/empleados',
            'post-deploy': 'mkdir -p logs && npm install && pm2 reload ecosystem.config.js --env production && pm2 save',
            ssh_options: "IdentityFile=~/.ssh/id_ed25519.pub" // Ruta a tu llave .pem local
        }
    }
}