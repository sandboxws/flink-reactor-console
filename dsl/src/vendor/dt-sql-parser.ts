// Pre-bundled vendor chunk for dt-sql-parser (see tsup.config.ts).
//
// dt-sql-parser's published dist cannot be loaded by plain Node ESM: it
// is ESM syntax in a package without `"type": "module"`, full of
// extensionless directory imports (`from './parser'`). Only bundlers can
// consume it — so we bundle the one parser the DSL needs into its own
// lazily-imported chunk, published behind the
// `@flink-reactor/dsl/vendor-dt-sql-parser` subpath.

export { FlinkSQL } from "dt-sql-parser"
