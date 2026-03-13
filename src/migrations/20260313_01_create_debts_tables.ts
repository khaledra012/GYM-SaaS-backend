import { QueryInterface, Transaction } from "sequelize";

export const upCreateDebtsTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE \`debts\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`memberId\` INT NOT NULL,
      \`source\` ENUM('manual', 'subscription') NOT NULL,
      \`referenceType\` VARCHAR(50) NULL,
      \`referenceId\` INT NULL,
      \`title\` VARCHAR(191) NOT NULL,
      \`note\` TEXT NULL,
      \`originalAmountCents\` INT NOT NULL,
      \`paidAmountCents\` INT NOT NULL DEFAULT 0,
      \`remainingAmountCents\` INT NOT NULL,
      \`status\` ENUM('unpaid', 'partially_paid', 'paid') NOT NULL DEFAULT 'unpaid',
      \`localDate\` DATE NOT NULL,
      \`createdBy\` INT NOT NULL,
      \`version\` INT NOT NULL DEFAULT 0,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`fk_debts_center_id\` FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_debts_member_id\` FOREIGN KEY (\`memberId\`) REFERENCES \`members\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_debts_created_by\` FOREIGN KEY (\`createdBy\`) REFERENCES \`centers\` (\`id\`) ON DELETE RESTRICT,
      INDEX \`idx_debts_center_status_local_date\` (\`centerId\`, \`status\`, \`localDate\`),
      INDEX \`idx_debts_center_member\` (\`centerId\`, \`memberId\`),
      INDEX \`idx_debts_center_reference\` (\`centerId\`, \`referenceType\`, \`referenceId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE \`debt_payments\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`debtId\` INT NOT NULL,
      \`type\` ENUM('cash', 'adjustment') NOT NULL,
      \`amountCents\` INT NOT NULL,
      \`note\` TEXT NULL,
      \`affectsAccounting\` TINYINT(1) NOT NULL,
      \`paidAt\` DATETIME NOT NULL,
      \`localDate\` DATE NOT NULL,
      \`createdBy\` INT NOT NULL,
      \`accountingTransactionId\` INT NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`fk_debt_payments_center_id\` FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_debt_payments_debt_id\` FOREIGN KEY (\`debtId\`) REFERENCES \`debts\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_debt_payments_created_by\` FOREIGN KEY (\`createdBy\`) REFERENCES \`centers\` (\`id\`) ON DELETE RESTRICT,
      CONSTRAINT \`fk_debt_payments_transaction_id\` FOREIGN KEY (\`accountingTransactionId\`) REFERENCES \`transactions\` (\`id\`) ON DELETE SET NULL,
      INDEX \`idx_debt_payments_center_debt\` (\`centerId\`, \`debtId\`),
      INDEX \`idx_debt_payments_center_local_date\` (\`centerId\`, \`localDate\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateDebtsTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    DROP TABLE IF EXISTS \`debt_payments\`;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    DROP TABLE IF EXISTS \`debts\`;
    `,
    { transaction },
  );
};
