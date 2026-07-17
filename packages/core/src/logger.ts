import pino from "pino";
import { serverEnv } from "./env.js";

const isDev = serverEnv.NODE_ENV === "development";
const isTest = serverEnv.NODE_ENV === "test";

const level = isTest ? "silent" : serverEnv.LOG_LEVEL;

const transport = isDev
  ? {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:standard",
      },
    }
  : undefined;

export const logger = pino({
  name: serverEnv.APP_NAME,
  level,
  transport,
});

export default logger;
