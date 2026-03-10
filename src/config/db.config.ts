import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
const sslEnabled =
  process.env.DB_SSL === "true" || process.env.DB_SSL === "1";
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";
const sslCaPath = process.env.DB_SSL_CA_PATH;

const sslOptions =
  sslEnabled && sslCaPath
    ? {
        rejectUnauthorized,
        ca: fs.readFileSync(sslCaPath, "utf8"),
      }
    : sslEnabled
      ? {
          rejectUnauthorized,
        }
      : undefined;

const sequelize = new Sequelize(
  process.env.DB_NAME as string,
  process.env.DB_USER as string,
  process.env.DB_PASS as string,
  {
    host: process.env.DB_HOST as string,
    port: Number.isFinite(dbPort) ? dbPort : 3306,
    dialect: "mysql",
    logging: false,
    timezone: "+00:00",
    dialectOptions: sslOptions
      ? {
          ssl: sslOptions,
        }
      : undefined,
  },
);

export default sequelize;
