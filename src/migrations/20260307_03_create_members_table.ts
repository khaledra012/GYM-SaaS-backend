import { QueryInterface, Transaction } from "sequelize";

export const upCreateMembersTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`members\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`code\` VARCHAR(255) NOT NULL,
      \`name\` VARCHAR(255) NOT NULL,
      \`phone\` VARCHAR(255) NOT NULL,
      \`email\` VARCHAR(255) NULL,
      \`gender\` ENUM('male','female') NOT NULL DEFAULT 'male',
      \`status\` ENUM('active','inactive','rejected') NOT NULL DEFAULT 'active',
      \`membershipStart\` DATE NULL,
      \`membershipEnd\` DATE NULL,
      \`centerId\` INT NOT NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_members_code\` (\`code\`),
      KEY \`idx_members_center_id\` (\`centerId\`),
      CONSTRAINT \`fk_members_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateMembersTable = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS `members`;", {
    transaction,
  });
};
