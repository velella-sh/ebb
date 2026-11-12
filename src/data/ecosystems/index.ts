// Generated file - do not edit directly. Run npm run build:ecosystems.
import type { RegistryV2, RegistryV2Rule } from "../../registry.js";
import { default as android_rules, data as android_data } from "./android.js";
import { default as ci_images_rules, data as ci_images_data } from "./ci-images.js";
import { default as container_rules, data as container_data } from "./container.js";
import { default as cpp_rules, data as cpp_data } from "./cpp.js";
import { default as dart_rules, data as dart_data } from "./dart.js";
import { default as database_rules, data as database_data } from "./database.js";
import { default as deno_rules, data as deno_data } from "./deno.js";
import { default as dotnet_rules, data as dotnet_data } from "./dotnet.js";
import { default as elixir_rules, data as elixir_data } from "./elixir.js";
import { default as github_actions_rules, data as github_actions_data } from "./github-actions.js";
import { default as go_rules, data as go_data } from "./go.js";
import { default as java_rules, data as java_data } from "./java.js";
import { default as kubernetes_rules, data as kubernetes_data } from "./kubernetes.js";
import { default as nodejs_rules, data as nodejs_data } from "./nodejs.js";
import { default as npm_rules, data as npm_data } from "./npm.js";
import { default as osv_rules, data as osv_data } from "./osv.js";
import { default as php_rules, data as php_data } from "./php.js";
import { default as python_rules, data as python_data } from "./python.js";
import { default as ruby_rules, data as ruby_data } from "./ruby.js";
import { default as rust_rules, data as rust_data } from "./rust.js";
import { default as scala_rules, data as scala_data } from "./scala.js";
import { default as serverless_rules, data as serverless_data } from "./serverless.js";
import { default as shell_rules, data as shell_data } from "./shell.js";
import { default as swift_rules, data as swift_data } from "./swift.js";
import { default as terraform_rules, data as terraform_data } from "./terraform.js";

export interface EcosystemModule {
  rules: readonly RegistryV2Rule[];
  data: RegistryV2;
}

export const ecosystems: Readonly<Record<string, EcosystemModule>> = {
  android: { rules: android_rules, data: android_data },
  "ci-images": { rules: ci_images_rules, data: ci_images_data },
  container: { rules: container_rules, data: container_data },
  cpp: { rules: cpp_rules, data: cpp_data },
  dart: { rules: dart_rules, data: dart_data },
  database: { rules: database_rules, data: database_data },
  deno: { rules: deno_rules, data: deno_data },
  dotnet: { rules: dotnet_rules, data: dotnet_data },
  elixir: { rules: elixir_rules, data: elixir_data },
  "github-actions": { rules: github_actions_rules, data: github_actions_data },
  go: { rules: go_rules, data: go_data },
  java: { rules: java_rules, data: java_data },
  kubernetes: { rules: kubernetes_rules, data: kubernetes_data },
  nodejs: { rules: nodejs_rules, data: nodejs_data },
  npm: { rules: npm_rules, data: npm_data },
  osv: { rules: osv_rules, data: osv_data },
  php: { rules: php_rules, data: php_data },
  python: { rules: python_rules, data: python_data },
  ruby: { rules: ruby_rules, data: ruby_data },
  rust: { rules: rust_rules, data: rust_data },
  scala: { rules: scala_rules, data: scala_data },
  serverless: { rules: serverless_rules, data: serverless_data },
  shell: { rules: shell_rules, data: shell_data },
  swift: { rules: swift_rules, data: swift_data },
  terraform: { rules: terraform_rules, data: terraform_data },
};
