import dotenv from "dotenv";
import sequelize from "./config/db.config";
import app from "./app";
import { setupAssociations } from "./config/associations";
import { logger } from "./shared";
import { startSubscriptionAutoExpireJob } from "./modules/subscriptions";
import { startWhatsAppJobs } from "./modules/whatsapp";

dotenv.config();

// Must be first — catches any sync errors from startup
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...", {
    name: err.name,
    message: err.message,
  });
  process.exit(1);
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    logger.info("Connection to MySQL has been established successfully");

    setupAssociations();

    const shouldAlter = process.env.DB_SYNC_ALTER === "true";
    await sequelize.sync(shouldAlter ? { alter: true } : undefined);
    logger.info("Database models synchronized", { alter: shouldAlter });

    startSubscriptionAutoExpireJob();
    startWhatsAppJobs();

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      logger.info(
        `Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`,
      );
    });

    process.on("unhandledRejection", (err: any) => {
      logger.error("UNHANDLED REJECTION! Shutting down...", {
        name: err?.name,
        message: err?.message,
      });
      server.close(() => {
        process.exit(1);
      });
    });
  } catch (error) {
    logger.error("Unable to connect to the database", {
      error: String(error),
    });
    process.exit(1);
  }
};

startServer();
