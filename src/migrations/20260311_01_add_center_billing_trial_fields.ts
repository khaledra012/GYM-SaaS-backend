import { QueryInterface, Transaction } from "sequelize";

export const upAddCenterBillingTrialFields = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`centers\`
      ADD COLUMN \`billingStatus\` ENUM('trial','subscribed','unsubscribed') NOT NULL DEFAULT 'trial' AFTER \`timezone\`,
      ADD COLUMN \`trialStartedAt\` DATETIME NULL AFTER \`billingStatus\`,
      ADD COLUMN \`trialEndsAt\` DATETIME NULL AFTER \`trialStartedAt\`,
      ADD INDEX \`idx_centers_billingStatus\` (\`billingStatus\`),
      ADD INDEX \`idx_centers_trialEndsAt\` (\`trialEndsAt\`);
    `,
    { transaction },
  );

  await queryInterface.sequelize.query(
    `
    UPDATE \`centers\`
    SET \`billingStatus\` = 'subscribed'
    WHERE \`trialEndsAt\` IS NULL;
    `,
    { transaction },
  );
};

export const downAddCenterBillingTrialFields = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`centers\`
      DROP INDEX \`idx_centers_trialEndsAt\`,
      DROP INDEX \`idx_centers_billingStatus\`,
      DROP COLUMN \`trialEndsAt\`,
      DROP COLUMN \`trialStartedAt\`,
      DROP COLUMN \`billingStatus\`;
    `,
    { transaction },
  );
};

