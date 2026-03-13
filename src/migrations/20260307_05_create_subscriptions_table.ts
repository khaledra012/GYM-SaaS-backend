import { QueryInterface, Transaction } from "sequelize";

export const upCreateSubscriptionsTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`subscriptions\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`memberId\` INT NOT NULL,
      \`planId\` INT NULL,
      \`centerId\` INT NOT NULL,
      \`source\` ENUM('plan','manual') NOT NULL DEFAULT 'plan',
      \`type\` ENUM('time_based','session_based') NOT NULL,
      \`status\` ENUM('active','frozen','expired','cancelled') NOT NULL DEFAULT 'active',
      \`startDate\` DATETIME NOT NULL,
      \`endDate\` DATETIME NULL,
      \`totalSessions\` INT NULL,
      \`remainingSessions\` INT NULL,
      \`pricePaidCents\` INT NOT NULL,
      \`notes\` TEXT NULL,
      \`freezeCount\` INT NOT NULL DEFAULT 0,
      \`totalFreezeMinutes\` INT NOT NULL DEFAULT 0,
      \`frozenAt\` DATETIME NULL,
      \`version\` INT NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_subscriptions_center_id_member_id\` (\`centerId\`,\`memberId\`),
      KEY \`idx_subscriptions_center_id_status_end_date\` (\`centerId\`,\`status\`,\`endDate\`),
      KEY \`idx_subscriptions_center_id_plan_id\` (\`centerId\`,\`planId\`),
      CONSTRAINT \`fk_subscriptions_member_id\`
        FOREIGN KEY (\`memberId\`) REFERENCES \`members\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_subscriptions_plan_id\`
        FOREIGN KEY (\`planId\`) REFERENCES \`plans\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`fk_subscriptions_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateSubscriptionsTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS `subscriptions`;", {
    transaction,
  });
};
