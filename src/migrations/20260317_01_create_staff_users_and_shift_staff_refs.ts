import { QueryInterface, Transaction } from "sequelize";

export const upCreateStaffUsersAndShiftStaffRefs = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`staff_users\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`name\` VARCHAR(120) NOT NULL,
      \`email\` VARCHAR(191) NOT NULL,
      \`phone\` VARCHAR(30) NULL,
      \`password\` VARCHAR(255) NOT NULL,
      \`role\` ENUM('owner','manager','receptionist') NOT NULL DEFAULT 'receptionist',
      \`status\` ENUM('active','inactive') NOT NULL DEFAULT 'active',
      \`lastLoginAt\` DATETIME NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_staff_users_email\` (\`email\`),
      KEY \`idx_staff_users_center_role_status\` (\`centerId\`, \`role\`, \`status\`),
      KEY \`idx_staff_users_center_created_at\` (\`centerId\`, \`createdAt\`),
      CONSTRAINT \`fk_staff_users_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`shifts\`
      ADD COLUMN \`openedByStaffId\` INT NULL AFTER \`openedBy\`,
      ADD COLUMN \`closedByStaffId\` INT NULL AFTER \`closedBy\`,
      ADD KEY \`idx_shifts_opened_by_staff\` (\`openedByStaffId\`),
      ADD KEY \`idx_shifts_closed_by_staff\` (\`closedByStaffId\`),
      ADD CONSTRAINT \`fk_shifts_opened_by_staff\`
        FOREIGN KEY (\`openedByStaffId\`) REFERENCES \`staff_users\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE,
      ADD CONSTRAINT \`fk_shifts_closed_by_staff\`
        FOREIGN KEY (\`closedByStaffId\`) REFERENCES \`staff_users\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE;
    `,
    { transaction },
  );
};

export const downCreateStaffUsersAndShiftStaffRefs = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`shifts\`
      DROP FOREIGN KEY \`fk_shifts_opened_by_staff\`,
      DROP FOREIGN KEY \`fk_shifts_closed_by_staff\`,
      DROP INDEX \`idx_shifts_opened_by_staff\`,
      DROP INDEX \`idx_shifts_closed_by_staff\`,
      DROP COLUMN \`openedByStaffId\`,
      DROP COLUMN \`closedByStaffId\`;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    DROP TABLE IF EXISTS \`staff_users\`;
    `,
    { transaction },
  );
};

