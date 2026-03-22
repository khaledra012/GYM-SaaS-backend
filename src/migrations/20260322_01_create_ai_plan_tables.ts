import { QueryInterface, Transaction } from "sequelize";

export const upCreateAiPlanTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`member_ai_plans\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`memberId\` INT NOT NULL,
      \`planType\` ENUM('workout_only','nutrition_only','combined') NOT NULL,
      \`status\` ENUM('draft','reviewed','approved','rejected','sent_whatsapp','archived') NOT NULL DEFAULT 'draft',
      \`goal\` VARCHAR(80) NOT NULL,
      \`inputSnapshot\` JSON NOT NULL,
      \`aiOutput\` JSON NOT NULL,
      \`coachEditedOutput\` JSON NULL,
      \`riskFlags\` JSON NOT NULL,
      \`warnings\` JSON NOT NULL,
      \`approvedBy\` INT NULL,
      \`approvedAt\` DATETIME NULL,
      \`rejectedBy\` INT NULL,
      \`rejectedAt\` DATETIME NULL,
      \`rejectionReason\` TEXT NULL,
      \`pdfPath\` VARCHAR(500) NULL,
      \`sentAt\` DATETIME NULL,
      \`createdBy\` INT NOT NULL,
      \`updatedBy\` INT NULL,
      \`localDate\` DATE NOT NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_member_ai_plans_center_member\` (\`centerId\`, \`memberId\`, \`createdAt\`),
      KEY \`idx_member_ai_plans_center_status\` (\`centerId\`, \`status\`, \`createdAt\`),
      CONSTRAINT \`fk_member_ai_plans_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_member_ai_plans_member_id\`
        FOREIGN KEY (\`memberId\`) REFERENCES \`members\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`member_ai_plan_versions\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`planId\` INT NOT NULL,
      \`versionNumber\` INT NOT NULL,
      \`source\` ENUM('ai_generated','coach_edited','approved_snapshot','rejected_snapshot') NOT NULL,
      \`payload\` JSON NOT NULL,
      \`createdBy\` INT NOT NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_member_ai_plan_versions_plan\` (\`planId\`, \`versionNumber\`),
      CONSTRAINT \`fk_member_ai_plan_versions_plan_id\`
        FOREIGN KEY (\`planId\`) REFERENCES \`member_ai_plans\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`member_ai_plan_delivery_logs\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`planId\` INT NOT NULL,
      \`channel\` ENUM('whatsapp') NOT NULL,
      \`status\` ENUM('queued','sent','failed') NOT NULL,
      \`whatsappMessageId\` INT NULL,
      \`failureReason\` TEXT NULL,
      \`sentAt\` DATETIME NULL,
      \`createdBy\` INT NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_member_ai_plan_delivery_logs_plan\` (\`planId\`, \`createdAt\`),
      CONSTRAINT \`fk_member_ai_plan_delivery_logs_plan_id\`
        FOREIGN KEY (\`planId\`) REFERENCES \`member_ai_plans\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_member_ai_plan_delivery_logs_whatsapp_message_id\`
        FOREIGN KEY (\`whatsappMessageId\`) REFERENCES \`whatsapp_messages\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_templates\`
    MODIFY \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test','campaign_broadcast','ai_plan_pdf') NOT NULL;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_messages\`
    MODIFY \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test','campaign_broadcast','ai_plan_pdf') NOT NULL;
    `,
    { transaction },
  );
};

export const downCreateAiPlanTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    DELETE FROM \`whatsapp_messages\` WHERE \`eventType\` = 'ai_plan_pdf';
    DELETE FROM \`whatsapp_templates\` WHERE \`eventType\` = 'ai_plan_pdf';
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_messages\`
    MODIFY \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test','campaign_broadcast') NOT NULL;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_templates\`
    MODIFY \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test','campaign_broadcast') NOT NULL;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    DROP TABLE IF EXISTS \`member_ai_plan_delivery_logs\`;
    DROP TABLE IF EXISTS \`member_ai_plan_versions\`;
    DROP TABLE IF EXISTS \`member_ai_plans\`;
    `,
    { transaction },
  );
};
