import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

const entries: Record<string, string> = {
  auth: 'src/handlers/auth.handler.ts',
  businesses: 'src/handlers/business.handler.ts',
  services: 'src/handlers/service.handler.ts',
};

await Promise.all(
  Object.entries(entries).map(([name, entryPoint]) =>
    esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      outfile: `dist/lambdas/${name}/index.js`,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      minify: false,
      sourcemap: false,
      loader: { '.hbs': 'text' },
    }),
  ),
);

// Zip each Lambda bundle for Terraform deployment.
for (const name of Object.keys(entries)) {
  execSync(`cd dist/lambdas/${name} && zip -j index.zip index.js`, { stdio: 'inherit' });
}

console.log('Build complete — dist/lambdas/');
