import { DataTypes, QueryInterface, Transaction } from "sequelize";

export const upDropMembershipEndFromMembers = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  const table = await queryInterface.describeTable("members");

  if (table.membershipEnd) {
    await queryInterface.removeColumn("members", "membershipEnd", { transaction });
  }
};

export const downDropMembershipEndFromMembers = async (
  queryInterface: QueryInterface,
  transaction: Transaction,
) => {
  const table = await queryInterface.describeTable("members");

  if (!table.membershipEnd) {
    await queryInterface.addColumn(
      "members",
      "membershipEnd",
      {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      { transaction },
    );
  }
};

