import { QueryInterface, Transaction } from "sequelize";

export const upAddRefundedSubscriptionEvent = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`subscription_events\`
    MODIFY COLUMN \`eventType\` ENUM(
      'created',
      'renewed',
      'frozen',
      'unfrozen',
      'cancelled',
      'refunded',
      'expired',
      'session_used',
      'session_deducted'
    ) NOT NULL;
    `,
    { transaction },
  );
};

export const downAddRefundedSubscriptionEvent = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  await queryInterface.sequelize.query(
    `
    ALTER TABLE \`subscription_events\`
    MODIFY COLUMN \`eventType\` ENUM(
      'created',
      'renewed',
      'frozen',
      'unfrozen',
      'cancelled',
      'expired',
      'session_used',
      'session_deducted'
    ) NOT NULL;
    `,
    { transaction },
  );
};
