/**
 * PM2 ecosystem config for OFSP backend
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs   # zero-downtime reload
 *   pm2 stop ofsp-backend
 *   pm2 logs ofsp-backend
 */
module.exports = {
  apps: [
    {
      name: 'ofsp-backend',
      script: 'dist/src/main.js',
      cwd: __dirname,
      node_args: '--enable-source-maps',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      merge_logs: true,
      time: true,
    },
  ],
};
