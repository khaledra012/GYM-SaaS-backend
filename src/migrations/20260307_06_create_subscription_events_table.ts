import { QueryInterface, Transaction } from "sequelize";

export const upCreateSubscriptionEventsTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`subscription_events\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`subscriptionId\` INT NOT NULL,
      \`centerId\` INT NOT NULL,
      \`eventType\` ENUM('created','renewed','frozen','unfrozen','cancelled','expired','session_used','session_deducted') NOT NULL,
      \`metadata\` JSON NOT NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_subscription_events_subscription_id\` (\`subscriptionId\`),
      KEY \`idx_subscription_events_center_id\` (\`centerId\`),
      CONSTRAINT \`fk_subscription_events_subscription_id\`
        FOREIGN KEY (\`subscriptionId\`) REFERENCES \`subscriptions\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_subscription_events_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateSubscriptionEventsTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    "DROP TABLE IF EXISTS `subscription_events`;",
    { transaction },
  );
};
