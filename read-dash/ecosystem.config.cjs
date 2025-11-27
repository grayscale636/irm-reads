module.exports = {
  apps: [{
    name: 'irmreads-frontend',
    script: 'server.cjs',
    cwd: 'E:/projects/IrmReads/read-dash',
    env_production: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000
  }]
};
