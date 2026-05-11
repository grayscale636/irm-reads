module.exports = {
  apps: [{
    name: 'irmreads-api',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 8211
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8211
    },
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    watch: false,
    ignore_watch: ['node_modules', 'logs']
  }]
};
