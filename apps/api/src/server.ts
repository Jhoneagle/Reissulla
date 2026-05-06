import { config } from "./config.js";
import { redis } from "./cache/redis.js";
import { buildServer } from "./app.js";

async function start() {
  const server = await buildServer();

  server.addHook("onClose", async () => {
    await redis.quit();
  });

  try {
    await redis.connect();
    await server.listen({ port: config.port, host: config.host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
