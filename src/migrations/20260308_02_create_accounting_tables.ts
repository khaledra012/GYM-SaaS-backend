import { QueryInterface, Transaction } from "sequelize";

export const upCreateAccountingTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`shifts\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`status\` ENUM('open','closed') NOT NULL DEFAULT 'open',
      \`localDate\` DATE NOT NULL,
      \`startingCash\` DECIMAL(10,2) NOT NULL,
      \`expectedEndingCash\` DECIMAL(10,2) NOT NULL,
      \`actualEndingCash\` DECIMAL(10,2) NULL,
      \`discrepancy\` DECIMAL(10,2) NULL,
      \`openedAt\` DATETIME NOT NULL,
      \`closedAt\` DATETIME NULL,
      \`openedBy\` INT NOT NULL,
      \`closedBy\` INT NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_shifts_center_status\` (\`centerId\`, \`status\`),
      KEY \`idx_shifts_center_local_date\` (\`centerId\`, \`localDate\`),
      KEY \`idx_shifts_center_opened_at\` (\`centerId\`, \`openedAt\`),
      CONSTRAINT \`fk_shifts_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_shifts_opened_by\`
        FOREIGN KEY (\`openedBy\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`fk_shifts_closed_by\`
        FOREIGN KEY (\`closedBy\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`transactions\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`shiftId\` INT NOT NULL,
      \`type\` ENUM('IN','OUT') NOT NULL,
      \`amount\` DECIMAL(10,2) NOT NULL,
      \`category\` ENUM('subscription','pos_sales','salaries','maintenance','rent_utilities','owner_draw','other') NOT NULL,
      \`description\` VARCHAR(500) NULL,
      \`referenceType\` VARCHAR(50) NULL,
      \`referenceId\` INT NULL,
      \`localDate\` DATE NOT NULL,
      \`occurredAt\` DATETIME NOT NULL,
      \`source\` ENUM('manual','automated','automated_reversal') NOT NULL DEFAULT 'manual',
      \`idempotencyKey\` VARCHAR(191) NULL,
      \`reversalOfTransactionId\` INT NULL,
      \`createdBy\` INT NOT NULL,
      \`metadata\` JSON NULL,
      \`createdAt\` DATETIME NOT NULL,
      \`updatedAt\` DATETIME NOT NULL,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_transactions_center_idempotency\` (\`centerId\`, \`idempotencyKey\`),
      KEY \`idx_transactions_center_local_date_type\` (\`centerId\`, \`localDate\`, \`type\`),
      KEY \`idx_transactions_center_shift_id\` (\`centerId\`, \`shiftId\`),
      KEY \`idx_transactions_center_reference\` (\`centerId\`, \`referenceType\`, \`referenceId\`),
      KEY \`idx_transactions_reversal_of_transaction_id\` (\`reversalOfTransactionId\`),
      CONSTRAINT \`fk_transactions_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_transactions_shift_id\`
        FOREIGN KEY (\`shiftId\`) REFERENCES \`shifts\` (\`id\`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`fk_transactions_created_by\`
        FOREIGN KEY (\`createdBy\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT \`fk_transactions_reversal_of_transaction_id\`
        FOREIGN KEY (\`reversalOfTransactionId\`) REFERENCES \`transactions\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateAccountingTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query("DROP TABLE IF EXISTS `transactions`", {
    transaction,
  });

  await queryInterface.sequelize.query("DROP TABLE IF EXISTS `shifts`", {
    transaction,
  });
};
