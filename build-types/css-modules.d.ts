// Ambient CSS-module types for the standalone library type-emit (tsc -p
// tsconfig.build.json). The Next.js dev/typecheck config gets these from
// next-env.d.ts instead, so this file is excluded from the main tsconfig to
// avoid a duplicate wildcard-module declaration.
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module "*.css";
