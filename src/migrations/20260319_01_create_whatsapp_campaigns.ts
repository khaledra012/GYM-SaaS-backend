import { QueryInterface, Transaction } from "sequelize";

export const upCreateWhatsAppCampaigns = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    CREATE TABLE IF NOT EXISTS \`whatsapp_campaigns\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`centerId\` INT NOT NULL,
      \`name\` VARCHAR(160) NOT NULL,
      \`audienceType\` ENUM('all_members','active_subscriptions','expired_subscriptions') NOT NULL,
      \`messageTemplate\` TEXT NOT NULL,
      \`status\` ENUM('queued','running','paused','completed','cancelled') NOT NULL DEFAULT 'queued',
      \`totalRecipients\` INT NOT NULL DEFAULT 0,
      \`createdBy\` INT NULL,
      \`launchedAt\` DATETIME NULL,
      \`pausedAt\` DATETIME NULL,
      \`resumedAt\` DATETIME NULL,
      \`cancelledAt\` DATETIME NULL,
      \`completedAt\` DATETIME NULL,
      \`createdAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_whatsapp_campaigns_center_status\` (\`centerId\`, \`status\`, \`createdAt\`),
      CONSTRAINT \`fk_whatsapp_campaigns_center_id\`
        FOREIGN KEY (\`centerId\`) REFERENCES \`centers\` (\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
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
    ALTER TABLE \`whatsapp_messages\`
    MODIFY \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test','campaign_broadcast') NOT NULL;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_messages\`
    ADD COLUMN \`campaignId\` INT NULL AFTER \`memberId\`,
    ADD KEY \`idx_whatsapp_messages_campaign_status\` (\`campaignId\`, \`status\`, \`createdAt\`),
    ADD CONSTRAINT \`fk_whatsapp_messages_campaign_id\`
      FOREIGN KEY (\`campaignId\`) REFERENCES \`whatsapp_campaigns\` (\`id\`)
      ON DELETE SET NULL ON UPDATE CASCADE;
    `,
    { transaction },
  );
};

export const downCreateWhatsAppCampaigns = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    DELETE FROM \`whatsapp_messages\` WHERE \`eventType\` = 'campaign_broadcast';
    DELETE FROM \`whatsapp_templates\` WHERE \`eventType\` = 'campaign_broadcast';
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_messages\`
    DROP FOREIGN KEY \`fk_whatsapp_messages_campaign_id\`,
    DROP INDEX \`idx_whatsapp_messages_campaign_status\`,
    DROP COLUMN \`campaignId\`;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_messages\`
    MODIFY \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test') NOT NULL;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`whatsapp_templates\`
    MODIFY \`eventType\` ENUM('member_welcome','subscription_expiry','debt_created','payment_receipt','debt_follow_up','manual_test') NOT NULL;
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    DROP TABLE IF EXISTS \`whatsapp_campaigns\`;
    `,
    { transaction },
  );
};
