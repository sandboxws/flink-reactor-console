// ---------------------------------------------------------------------------
// Mock tap manifest — static manifest with sample tapped operators for mock mode.
// Covers Kafka source, Filter transform, and Kafka sink to exercise all UI paths.
// ---------------------------------------------------------------------------

import type { TapManifest } from "./tap-types";

/**
 * Generate a mock tap manifest with realistic observation SQL.
 *
 * Includes:
 * - KafkaSource reading raw order events
 * - Filter transform filtering high-value orders
 * - KafkaSink writing enriched order events
 * - JdbcSource reading product catalog (periodic-poll strategy)
 */
export function generateMockTapManifest(): TapManifest {
  return {
    pipelineName: "ecommerce-pipeline",
    flinkVersion: "1.20",
    generatedAt: new Date().toISOString(),
    taps: [
      {
        nodeId: "orders-source",
        name: "KafkaSource (orders)",
        componentType: "source",
        componentName: "KafkaSource",
        schema: {
          order_id: "BIGINT",
          customer_id: "BIGINT",
          product_id: "VARCHAR(255)",
          quantity: "INT",
          unit_price: "DECIMAL(10, 2)",
          order_time: "TIMESTAMP(3)",
          status: "VARCHAR(50)",
        },
        connectorType: "kafka",
        observationSql: [
          "CREATE TEMPORARY TABLE `_tap_orders-source` (",
          "  `order_id` BIGINT,",
          "  `customer_id` BIGINT,",
          "  `product_id` VARCHAR(255),",
          "  `quantity` INT,",
          "  `unit_price` DECIMAL(10, 2),",
          "  `order_time` TIMESTAMP(3),",
          "  `status` VARCHAR(50)",
          ") WITH (",
          "  'connector' = 'kafka',",
          "  'topic' = 'orders',",
          "  'format' = 'json',",
          "  'properties.bootstrap.servers' = 'kafka:9092',",
          "  'properties.group.id' = 'flink-reactor-tap-ecommerce-pipeline-orders-source-a1b2c3d4',",
          "  'scan.startup.mode' = 'latest-offset'",
          ");",
          "",
          "SELECT * FROM `_tap_orders-source`;",
        ].join("\n"),
        consumerGroupId:
          "flink-reactor-tap-ecommerce-pipeline-orders-source-a1b2c3d4",
        config: {
          name: "KafkaSource (orders)",
          groupIdPrefix: "",
          offsetMode: "latest",
          startTimestamp: "",
          endTimestamp: "",
        },
        connectorProperties: {
          connector: "kafka",
          topic: "orders",
          format: "json",
          "properties.bootstrap.servers": "kafka:9092",
          "properties.group.id":
            "flink-reactor-tap-ecommerce-pipeline-orders-source-a1b2c3d4",
          "scan.startup.mode": "latest-offset",
        },
      },
      {
        nodeId: "high-value-filter",
        name: "Filter (high-value orders)",
        componentType: "transform",
        componentName: "Filter",
        schema: {
          order_id: "BIGINT",
          customer_id: "BIGINT",
          product_id: "VARCHAR(255)",
          quantity: "INT",
          unit_price: "DECIMAL(10, 2)",
          order_time: "TIMESTAMP(3)",
          status: "VARCHAR(50)",
        },
        connectorType: "kafka",
        observationSql: [
          "CREATE TEMPORARY TABLE `_tap_high-value-filter` (",
          "  `order_id` BIGINT,",
          "  `customer_id` BIGINT,",
          "  `product_id` VARCHAR(255),",
          "  `quantity` INT,",
          "  `unit_price` DECIMAL(10, 2),",
          "  `order_time` TIMESTAMP(3),",
          "  `status` VARCHAR(50)",
          ") WITH (",
          "  'connector' = 'kafka',",
          "  'topic' = 'orders',",
          "  'format' = 'json',",
          "  'properties.bootstrap.servers' = 'kafka:9092',",
          "  'properties.group.id' = 'flink-reactor-tap-ecommerce-pipeline-high-value-filter-e5f6a7b8',",
          "  'scan.startup.mode' = 'latest-offset'",
          ");",
          "",
          "SELECT * FROM `_tap_high-value-filter`;",
        ].join("\n"),
        consumerGroupId:
          "flink-reactor-tap-ecommerce-pipeline-high-value-filter-e5f6a7b8",
        config: {
          name: "Filter (high-value orders)",
          groupIdPrefix: "",
          offsetMode: "latest",
          startTimestamp: "",
          endTimestamp: "",
        },
        connectorProperties: {
          connector: "kafka",
          topic: "orders",
          format: "json",
          "properties.bootstrap.servers": "kafka:9092",
          "properties.group.id":
            "flink-reactor-tap-ecommerce-pipeline-high-value-filter-e5f6a7b8",
          "scan.startup.mode": "latest-offset",
        },
      },
      {
        nodeId: "enriched-orders-sink",
        name: "KafkaSink (enriched-orders)",
        componentType: "sink",
        componentName: "KafkaSink",
        schema: {
          order_id: "BIGINT",
          customer_id: "BIGINT",
          product_id: "VARCHAR(255)",
          product_name: "VARCHAR(255)",
          quantity: "INT",
          unit_price: "DECIMAL(10, 2)",
          total_amount: "DECIMAL(12, 2)",
          order_time: "TIMESTAMP(3)",
          status: "VARCHAR(50)",
          region: "VARCHAR(100)",
        },
        connectorType: "kafka",
        observationSql: [
          "CREATE TEMPORARY TABLE `_tap_enriched-orders-sink` (",
          "  `order_id` BIGINT,",
          "  `customer_id` BIGINT,",
          "  `product_id` VARCHAR(255),",
          "  `product_name` VARCHAR(255),",
          "  `quantity` INT,",
          "  `unit_price` DECIMAL(10, 2),",
          "  `total_amount` DECIMAL(12, 2),",
          "  `order_time` TIMESTAMP(3),",
          "  `status` VARCHAR(50),",
          "  `region` VARCHAR(100)",
          ") WITH (",
          "  'connector' = 'kafka',",
          "  'topic' = 'enriched-orders',",
          "  'format' = 'json',",
          "  'properties.bootstrap.servers' = 'kafka:9092',",
          "  'properties.group.id' = 'flink-reactor-tap-ecommerce-pipeline-enriched-orders-sink-c9d0e1f2',",
          "  'scan.startup.mode' = 'latest-offset'",
          ");",
          "",
          "SELECT * FROM `_tap_enriched-orders-sink`;",
        ].join("\n"),
        consumerGroupId:
          "flink-reactor-tap-ecommerce-pipeline-enriched-orders-sink-c9d0e1f2",
        config: {
          name: "KafkaSink (enriched-orders)",
          groupIdPrefix: "",
          offsetMode: "latest",
          startTimestamp: "",
          endTimestamp: "",
        },
        connectorProperties: {
          connector: "kafka",
          topic: "enriched-orders",
          format: "json",
          "properties.bootstrap.servers": "kafka:9092",
          "properties.group.id":
            "flink-reactor-tap-ecommerce-pipeline-enriched-orders-sink-c9d0e1f2",
          "scan.startup.mode": "latest-offset",
        },
      },
      {
        nodeId: "products-source",
        name: "JdbcSource (products)",
        componentType: "source",
        componentName: "JdbcSource",
        schema: {
          product_id: "VARCHAR(255)",
          product_name: "VARCHAR(255)",
          category: "VARCHAR(100)",
          base_price: "DECIMAL(10, 2)",
          region: "VARCHAR(100)",
        },
        connectorType: "jdbc",
        observationSql: [
          "CREATE TEMPORARY TABLE `_tap_products-source` (",
          "  `product_id` VARCHAR(255),",
          "  `product_name` VARCHAR(255),",
          "  `category` VARCHAR(100),",
          "  `base_price` DECIMAL(10, 2),",
          "  `region` VARCHAR(100)",
          ") WITH (",
          "  'connector' = 'jdbc',",
          "  'url' = 'jdbc:postgresql://postgres:5432/catalog',",
          "  'table-name' = 'products'",
          ");",
          "",
          "SELECT * FROM `_tap_products-source`;",
        ].join("\n"),
        consumerGroupId:
          "flink-reactor-tap-ecommerce-pipeline-products-source-d3e4f5a6",
        config: {
          name: "JdbcSource (products)",
          groupIdPrefix: "",
          offsetMode: "latest",
          startTimestamp: "",
          endTimestamp: "",
        },
        connectorProperties: {
          connector: "jdbc",
          url: "jdbc:postgresql://postgres:5432/catalog",
          "table-name": "products",
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mock streaming data generator — produces realistic rows for observation
// ---------------------------------------------------------------------------

const PRODUCT_IDS = ["PROD-001", "PROD-002", "PROD-003", "PROD-004", "PROD-005"];
const PRODUCT_NAMES = ["Wireless Mouse", "USB-C Hub", "Mechanical Keyboard", "Monitor Stand", "Webcam HD"];
const CATEGORIES = ["Electronics", "Peripherals", "Accessories"];
const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];
const REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1"];

let mockRowCounter = 0;

/** Generate a batch of mock streaming rows for the given schema */
export function generateMockStreamingRows(
  schema: Record<string, string>,
  batchSize: number = 3,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  for (let i = 0; i < batchSize; i++) {
    mockRowCounter++;
    const row: Record<string, unknown> = {};

    for (const [name, type] of Object.entries(schema)) {
      row[name] = generateMockValue(name, type, mockRowCounter);
    }

    rows.push(row);
  }

  return rows;
}

function generateMockValue(fieldName: string, fieldType: string, counter: number): unknown {
  // Use field name heuristics for realistic values
  const nameLower = fieldName.toLowerCase();

  if (nameLower.includes("order_id") || nameLower === "id") {
    return 10000 + counter;
  }
  if (nameLower.includes("customer_id")) {
    return 1000 + (counter % 50);
  }
  if (nameLower.includes("product_id")) {
    return PRODUCT_IDS[counter % PRODUCT_IDS.length];
  }
  if (nameLower.includes("product_name")) {
    return PRODUCT_NAMES[counter % PRODUCT_NAMES.length];
  }
  if (nameLower.includes("category")) {
    return CATEGORIES[counter % CATEGORIES.length];
  }
  if (nameLower.includes("status")) {
    return STATUSES[counter % STATUSES.length];
  }
  if (nameLower.includes("region")) {
    return REGIONS[counter % REGIONS.length];
  }
  if (nameLower.includes("quantity")) {
    return 1 + (counter % 10);
  }

  // Fall back to type-based generation
  if (fieldType === "BIGINT") {
    return counter * 100;
  }
  if (fieldType === "INT") {
    return counter % 100;
  }
  if (fieldType.startsWith("DECIMAL")) {
    return Number((Math.random() * 500 + 10).toFixed(2));
  }
  if (fieldType.startsWith("TIMESTAMP")) {
    return new Date(Date.now() - Math.random() * 3600_000).toISOString();
  }
  if (fieldType.startsWith("VARCHAR") || fieldType === "STRING") {
    return `value-${counter}`;
  }
  if (fieldType === "BOOLEAN") {
    return counter % 2 === 0;
  }
  if (fieldType === "DOUBLE" || fieldType === "FLOAT") {
    return Number((Math.random() * 1000).toFixed(3));
  }

  return null;
}
