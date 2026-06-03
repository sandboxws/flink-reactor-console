import { Field, Schema } from "@flink-reactor/dsl"

// A schema declared in its own module, imported by `def-xfile-pipeline.tsx` —
// the cross-file column go-to-definition case.
export const OrdersSchema = Schema({
  fields: {
    o_orderkey: Field.BIGINT(),
    o_custkey: Field.BIGINT(),
  },
})
