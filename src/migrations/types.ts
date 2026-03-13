import { QueryInterface, Transaction } from "sequelize";

export interface IMigration {
  id: string;
  name: string;
  up: (queryInterface: QueryInterface, transaction: Transaction) => Promise<void>;
  down?: (queryInterface: QueryInterface, transaction: Transaction) => Promise<void>;
}
