import { Field, Schema } from "@flink-reactor/dsl"

export const OrderSchema = Schema({
  fields: {
    order_id: Field.BIGINT(),
    amount: Field.DECIMAL(10, 2),
  },
})
