module.exports = {
  apps: [{
    name: 'irmreads-api',
    script: './dist/index.js',
    instances: 1, // Single instance
    exec_mode: 'fork', // Fork mode untuk single instance
    env: {
      NODE_ENV: 'development',
      PORT: 8114
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 8114
    },
    // Auto restart jika memory > 500MB
    max_memory_restart: '500M',
    // Logging
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    // Restart policy
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
    // Watch (disable in production)
    watch: false,
    ignore_watch: ['node_modules', 'logs']
  }]
};
