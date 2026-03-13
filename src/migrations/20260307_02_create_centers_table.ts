import { QueryInterface, Transaction } from "sequelize";

export const upCreateCentersTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`centers\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(255) NOT NULL,
      \`email\` VARCHAR(255) NOT NULL,
      \`password\` VARCHAR(255) NOT NULL,
      \`phone\` VARCHAR(255) NULL,
      \`timezone\` VARCHAR(255) NOT NULL DEFAULT 'UTC',
      \`passwordResetToken\` VARCHAR(255) NULL,
      \`passwordResetExpires\` DATETIME NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_centers_email\` (\`email\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateCentersTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS `centers`;", {
    transaction,
  });
};
