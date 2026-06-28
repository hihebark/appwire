const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return args.includes(name);
}

if (hasFlag("--version")) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { version } = require(`${__dirname}/../package.json`) as { version: string };
  console.log(version);
  process.exit(0);
} else {
  const entry = flag("--entry");
  import("../commands/attach.js").then(({ runAttach }) =>
    runAttach({ entry }).catch((err: Error) => {
      console.error(`appwire: ${err.message}`);
      process.exit(1);
    }),
  );
}
