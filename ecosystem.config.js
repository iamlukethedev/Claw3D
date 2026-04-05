module.exports = {
  apps: [
    {
      name: "zeus-gateway",
      script: "server/zeus-gateway-adapter.js",
      cwd: "C:/Users/user/Downloads/claw3d-fork",
      node_args: "--env-file .env",
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      log_file: "logs/zeus-gateway.log",
      error_file: "logs/zeus-gateway-error.log",
      time: true,
    },
  ],
};
