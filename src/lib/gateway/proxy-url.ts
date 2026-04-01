export const resolveStudioProxyGatewayUrl = (): string => {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const hostname =
    window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  const host = window.location.port ? `${hostname}:${window.location.port}` : hostname;
  return `${protocol}://${host}/api/gateway/ws`;
};

