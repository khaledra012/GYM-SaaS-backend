import { QueryInterface, Transaction } from "sequelize";

const hasOwn = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export const upSubscriptionManualSource = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  const table = await queryInterface.describeTable("subscriptions");

  if (!hasOwn(table, "source")) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subscriptions` ADD COLUMN `source` ENUM('plan','manual') NOT NULL DEFAULT 'plan';",
      { transaction },
    );
  }

  const refreshed = await queryInterface.describeTable("subscriptions");

  if (hasOwn(refreshed, "planId") && refreshed.planId.allowNull === false) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `subscriptions` MODIFY `planId` INT NULL;",
      { transaction },
    );
  }
};

export const downSubscriptionManualSource = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  const table = await queryInterface.describeTable("subscriptions");

  if (!hasOwn(table, "source")) {
    return;
  }

  const [rows] = (await queryInterface.sequelize.query(
    "SELECT COUNT(*) AS count FROM `subscriptions` WHERE `source` = 'manual' OR `planId` IS NULL;",
    { transaction },
  )) as any[];

  const count = Number(rows?.[0]?.count ?? 0);
  if (count > 0) {
    throw new Error(
      "لا يمكن التراجع عن migration الاشتراكات لأن هناك اشتراكات يدوية أو planId فارغ",
    );
  }

  await queryInterface.sequelize.query(
    "ALTER TABLE `subscriptions` MODIFY `planId` INT NOT NULL;",
    { transaction },
  );

  await queryInterface.sequelize.query(
    "ALTER TABLE `subscriptions` DROP COLUMN `source`;",
    { transaction },
  );
};
