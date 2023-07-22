import setupLogger from "@monitorss/logger";
import config from "../config/config";

const configValues = config();

const logger = setupLogger({
  env: process.env.NODE_ENV as string,
  datadog: {
    apiKey: configValues.BACKEND_API_DATADOG_API_KEY as string,
    service: process.env.SERVICE_NAME || "monitorss-web-v2",
  },
  enableDebugLogs: process.env.LOG_LEVEL === "debug",
});

export default logger;
