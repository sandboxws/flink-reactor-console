import { resolve } from "node:path"
import { glob } from "glob"
import Mocha from "mocha"

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 120_000 })
  // Allow focusing a single suite during local iteration (e.g.
  // `MOCHA_GREP="Schema Explorer" pnpm test:e2e`).
  if (process.env.MOCHA_GREP) mocha.grep(process.env.MOCHA_GREP)
  const testsRoot = resolve(__dirname)
  const files = await glob("**/*.test.js", { cwd: testsRoot })
  for (const file of files) {
    mocha.addFile(resolve(testsRoot, file))
  }
  await new Promise<void>((res, rej) => {
    try {
      mocha.run((failures) =>
        failures > 0 ? rej(new Error(`${failures} test(s) failed.`)) : res(),
      )
    } catch (err) {
      rej(err as Error)
    }
  })
}
