import { QueryInterface, Transaction } from "sequelize";

export const upCreateCheckinsTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`checkins\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`memberId\` INT NULL,
      \`subscriptionId\` INT NULL,
      \`memberCode\` VARCHAR(255) NOT NULL,
      \`status\` ENUM('approved','denied') NOT NULL,
      \`denyReasonCode\` ENUM('member_not_found','member_inactive','no_subscription','subscription_expired','subscription_frozen','subscription_cancelled','sessions_depleted','cooldown_active','concurrency_conflict') NULL,
      \`denyReasonMessage\` VARCHAR(255) NULL,
      \`checkinAt\` DATETIME NOT NULL,
      \`localDate\` DATE NOT NULL,
      \`metadata\` JSON NOT NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_checkins_center_id_checkin_at\` (\`centerId\`,\`checkinAt\`),
      KEY \`idx_checkins_center_id_member_id_checkin_at\` (\`centerId\`,\`memberId\`,\`checkinAt\`),
      KEY \`idx_checkins_center_id_local_date\` (\`centerId\`,\`localDate\`),
      KEY \`idx_checkins_center_id_status_local_date\` (\`centerId\`,\`status\`,\`localDate\`),
      CONSTRAINT \`fk_checkins_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_checkins_member_id\`
        FOREIGN KEY (\`memberId\`) REFERENCES \`members\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`fk_checkins_subscription_id\`
        FOREIGN KEY (\`subscriptionId\`) REFERENCES \`subscriptions\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateCheckinsTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS `checkins`;", {
    transaction,
  });
};
