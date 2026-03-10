import { QueryInterface, Transaction } from "sequelize";

export const upCreatePlansTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`plans\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(120) NOT NULL,
      \`description\` TEXT NULL,
      \`price\` DECIMAL(12,2) NOT NULL,
      \`type\` ENUM('time_based','session_based') NOT NULL,
      \`durationInDays\` INT NULL,
      \`sessionCount\` INT NULL,
      \`centerId\` INT NOT NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      \`deletedAt\` DATETIME NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_plans_center_id\` (\`centerId\`),
      CONSTRAINT \`fk_plans_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreatePlansTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS `plans`;", {
    transaction,
  });
};
