import { DataTypes, Sequelize } from "sequelize";
import sequelize from "../../config/db.config";
import WhatsAppDeliveryLog from "./whatsapp-delivery-log.model";
import WhatsAppMessage from "./whatsapp-message.model";
import WhatsAppModuleState from "./whatsapp-module-state.model";
import WhatsAppOptIn from "./whatsapp-opt-in.model";
import WhatsAppSession from "./whatsapp-session.model";
import WhatsAppTemplate from "./whatsapp-template.model";

let initialized = false;

export const initWhatsAppModels = (db: Sequelize = sequelize) => {
  if (initialized) {
    return;
  }

  WhatsAppSession.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      centerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: "uq_whatsapp_sessions_center_id",
        references: { model: "centers", key: "id" },
        onDelete: "CASCADE",
      },
      status: {
        type: DataTypes.ENUM(
          "connecting",
          "qr_ready",
          "connected",
          "degraded",
          "paused",
          "disconnected",
        ),
        allowNull: false,
        defaultValue: "disconnected",
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: true,
      },
      qrCodeDataUrl: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
      },
      pauseReason: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      lastConnectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastDisconnectedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastQrAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastHealthCheckAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: "whatsapp_sessions",
      timestamps: true,
      indexes: [
        {
          name: "idx_whatsapp_sessions_status",
          fields: ["status"],
        },
      ],
    },
  );

  WhatsAppTemplate.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      centerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "centers", key: "id" },
        onDelete: "CASCADE",
      },
      eventType: {
        type: DataTypes.ENUM(
          "member_welcome",
          "subscription_expiry",
          "debt_created",
          "payment_receipt",
          "debt_follow_up",
          "manual_test",
        ),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      body: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize: db,
      tableName: "whatsapp_templates",
      timestamps: true,
      indexes: [
        {
          name: "idx_whatsapp_templates_center_event",
          fields: ["centerId", "eventType", "isActive"],
        },
      ],
    },
  );

  WhatsAppMessage.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      centerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "centers", key: "id" },
        onDelete: "CASCADE",
      },
      sessionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "whatsapp_sessions", key: "id" },
        onDelete: "SET NULL",
      },
      memberId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "members", key: "id" },
        onDelete: "SET NULL",
      },
      eventType: {
        type: DataTypes.ENUM(
          "member_welcome",
          "subscription_expiry",
          "debt_created",
          "payment_receipt",
          "debt_follow_up",
          "manual_test",
        ),
        allowNull: false,
      },
      templateId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "whatsapp_templates", key: "id" },
        onDelete: "SET NULL",
      },
      dedupeKey: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      phone: {
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      renderedBody: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "processing",
          "sent",
          "failed_retryable",
          "deferred",
          "permanent_failed",
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      failureType: {
        type: DataTypes.ENUM("retryable", "fatal"),
        allowNull: true,
      },
      failureCode: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      failureReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
          min: 0,
        },
      },
      nextAttemptAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastAttemptAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: "whatsapp_messages",
      timestamps: true,
      indexes: [
        {
          name: "uq_whatsapp_messages_center_dedupe",
          unique: true,
          fields: ["centerId", "dedupeKey"],
        },
        {
          name: "idx_whatsapp_messages_dispatch",
          fields: ["status", "nextAttemptAt", "createdAt"],
        },
        {
          name: "idx_whatsapp_messages_center_member",
          fields: ["centerId", "memberId", "createdAt"],
        },
      ],
    },
  );

  WhatsAppDeliveryLog.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      centerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "centers", key: "id" },
        onDelete: "CASCADE",
      },
      messageId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "whatsapp_messages", key: "id" },
        onDelete: "CASCADE",
      },
      sessionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "whatsapp_sessions", key: "id" },
        onDelete: "SET NULL",
      },
      status: {
        type: DataTypes.ENUM(
          "queued",
          "processing",
          "sent",
          "failed_retryable",
          "deferred",
          "permanent_failed",
        ),
        allowNull: false,
      },
      details: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: "whatsapp_delivery_logs",
      timestamps: true,
      indexes: [
        {
          name: "idx_whatsapp_delivery_logs_center_created_at",
          fields: ["centerId", "createdAt"],
        },
        {
          name: "idx_whatsapp_delivery_logs_session_created_at",
          fields: ["sessionId", "createdAt"],
        },
      ],
    },
  );

  WhatsAppOptIn.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      centerId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "centers", key: "id" },
        onDelete: "CASCADE",
      },
      memberId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "members", key: "id" },
        onDelete: "CASCADE",
      },
      isOptedIn: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      source: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      updatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: "whatsapp_opt_ins",
      timestamps: true,
      indexes: [
        {
          name: "uq_whatsapp_opt_ins_center_member",
          unique: true,
          fields: ["centerId", "memberId"],
        },
      ],
    },
  );

  WhatsAppModuleState.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      scopeKey: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: "uq_whatsapp_module_state_scope",
      },
      status: {
        type: DataTypes.ENUM("healthy", "paused"),
        allowNull: false,
        defaultValue: "healthy",
      },
      reason: {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      pausedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      resumedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      failureRate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true,
      },
      attemptsCount: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      evaluatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize: db,
      tableName: "whatsapp_module_states",
      timestamps: true,
    },
  );

  initialized = true;
};
