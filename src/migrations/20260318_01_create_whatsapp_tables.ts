import { QueryInterface, Transaction } from "sequelize";

export const upCreateWhatsAppTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`whatsapp_sessions\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`status\` ENUM('connecting','qr_ready','connected','degraded','paused','disconnected') NOT NULL DEFAULT 'disconnected',
      \`phone\` VARCHAR(30) NULL,
      \`qrCodeDataUrl\` LONGTEXT NULL,
      \`pauseReason\` VARCHAR(191) NULL,
      \`lastConnectedAt\` DATETIME NULL,
      \`lastDisconnectedAt\` DATETIME NULL,
      \`lastQrAt\` DATETIME NULL,
      \`lastHealthCheckAt\` DATETIME NULL,
      \`metadata\` JSON NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_whatsapp_sessions_center_id\` (\`centerId\`),
      KEY \`idx_whatsapp_sessions_status\` (\`status\`),
      CONSTRAINT \`fk_whatsapp_sessions_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`whatsapp_templates\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NULL,
      \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test') NOT NULL,
      \`name\` VARCHAR(120) NOT NULL,
      \`body\` TEXT NOT NULL,
      \`isActive\` TINYINT(1) NOT NULL DEFAULT 1,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_whatsapp_templates_center_event\` (\`centerId\`, \`eventType\`, \`isActive\`),
      CONSTRAINT \`fk_whatsapp_templates_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`whatsapp_messages\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`sessionId\` INT NULL,
      \`memberId\` INT NULL,
      \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test') NOT NULL,
      \`templateId\` INT NULL,
      \`dedupeKey\` VARCHAR(191) NULL,
      \`phone\` VARCHAR(30) NOT NULL,
      \`renderedBody\` TEXT NOT NULL,
      \`status\` ENUM('pending','processing','sent','failed_retryable','deferred','permanent_failed') NOT NULL DEFAULT 'pending',
      \`failureType\` ENUM('retryable','fatal') NULL,
      \`failureCode\` VARCHAR(120) NULL,
      \`failureReason\` TEXT NULL,
      \`attempts\` INT NOT NULL DEFAULT 0,
      \`nextAttemptAt\` DATETIME NULL,
      \`lastAttemptAt\` DATETIME NULL,
      \`sentAt\` DATETIME NULL,
      \`metadata\` JSON NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_whatsapp_messages_center_dedupe\` (\`centerId\`, \`dedupeKey\`),
      KEY \`idx_whatsapp_messages_dispatch\` (\`status\`, \`nextAttemptAt\`, \`createdAt\`),
      KEY \`idx_whatsapp_messages_center_member\` (\`centerId\`, \`memberId\`, \`createdAt\`),
      CONSTRAINT \`fk_whatsapp_messages_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_whatsapp_messages_session_id\`
        FOREIGN KEY (\`sessionId\`) REFERENCES \`whatsapp_sessions\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`fk_whatsapp_messages_member_id\`
        FOREIGN KEY (\`memberId\`) REFERENCES \`members\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`fk_whatsapp_messages_template_id\`
        FOREIGN KEY (\`templateId\`) REFERENCES \`whatsapp_templates\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`whatsapp_delivery_logs\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`messageId\` INT NOT NULL,
      \`sessionId\` INT NULL,
      \`status\` ENUM('queued','processing','sent','failed_retryable','deferred','permanent_failed') NOT NULL,
      \`details\` TEXT NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_whatsapp_delivery_logs_center_created_at\` (\`centerId\`, \`createdAt\`),
      KEY \`idx_whatsapp_delivery_logs_session_created_at\` (\`sessionId\`, \`createdAt\`),
      CONSTRAINT \`fk_whatsapp_delivery_logs_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_whatsapp_delivery_logs_message_id\`
        FOREIGN KEY (\`messageId\`) REFERENCES \`whatsapp_messages\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_whatsapp_delivery_logs_session_id\`
        FOREIGN KEY (\`sessionId\`) REFERENCES \`whatsapp_sessions\` (\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`whatsapp_opt_ins\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`memberId\` INT NOT NULL,
      \`isOptedIn\` TINYINT(1) NOT NULL DEFAULT 0,
      \`source\` VARCHAR(80) NULL,
      \`updatedBy\` INT NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_whatsapp_opt_ins_center_member\` (\`centerId\`, \`memberId\`),
      CONSTRAINT \`fk_whatsapp_opt_ins_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_whatsapp_opt_ins_member_id\`
        FOREIGN KEY (\`memberId\`) REFERENCES \`members\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`whatsapp_module_states\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`scopeKey\` VARCHAR(50) NOT NULL,
      \`status\` ENUM('healthy','paused') NOT NULL DEFAULT 'healthy',
      \`reason\` VARCHAR(191) NULL,
      \`pausedAt\` DATETIME NULL,
      \`resumedAt\` DATETIME NULL,
      \`failureRate\` DECIMAL(5,4) NULL,
      \`attemptsCount\` INT NULL,
      \`evaluatedAt\` DATETIME NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_whatsapp_module_state_scope\` (\`scopeKey\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `,
    { transaction },
  );
};

export const downCreateWhatsAppTables = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    DROP TABLE IF EXISTS \`whatsapp_module_states\`;
    DROP TABLE IF EXISTS \`whatsapp_opt_ins\`;
    DROP TABLE IF EXISTS \`whatsapp_delivery_logs\`;
    DROP TABLE IF EXISTS \`whatsapp_messages\`;
    DROP TABLE IF EXISTS \`whatsapp_templates\`;
    DROP TABLE IF EXISTS \`whatsapp_sessions\`;
    `,
    { transaction },
  );
};
