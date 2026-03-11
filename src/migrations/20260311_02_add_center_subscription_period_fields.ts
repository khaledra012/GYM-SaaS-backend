import { QueryInterface, Transaction } from "sequelize";

export const upAddCenterSubscriptionPeriodFields = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`centers\`
      ADD COLUMN \`subscriptionStartedAt\` DATETIME NULL AFTER \`trialEndsAt\`,
      ADD COLUMN \`subscriptionEndsAt\` DATETIME NULL AFTER \`subscriptionStartedAt\`,
      ADD INDEX \`idx_centers_subscriptionEndsAt\` (\`subscriptionEndsAt\`);
    `,
    { transaction },
  );
};

export const downAddCenterSubscriptionPeriodFields = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`centers\`
      DROP INDEX \`idx_centers_subscriptionEndsAt\`,
      DROP COLUMN \`subscriptionEndsAt\`,
      DROP COLUMN \`subscriptionStartedAt\`;
    `,
    { transaction },
  );
};
