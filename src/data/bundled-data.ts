/**
 * In-memory index of all bundled ecosystem data.
 * Zero Node dependencies; safe for Browser and Edge runtimes.
 */

import { data as android } from "./ecosystems/android.js";
import { data as ciImages } from "./ecosystems/ci-images.js";
import { data as container } from "./ecosystems/container.js";
import { data as cpp } from "./ecosystems/cpp.js";
import { data as dart } from "./ecosystems/dart.js";
import { data as database } from "./ecosystems/database.js";
import { data as deno } from "./ecosystems/deno.js";
import { data as dotnet } from "./ecosystems/dotnet.js";
import { data as elixir } from "./ecosystems/elixir.js";
import { data as githubActions } from "./ecosystems/github-actions.js";
import { data as go } from "./ecosystems/go.js";
import { data as java } from "./ecosystems/java.js";
import { data as kubernetes } from "./ecosystems/kubernetes.js";
import { data as nodejs } from "./ecosystems/nodejs.js";
import { data as npm } from "./ecosystems/npm.js";
import { data as osv } from "./ecosystems/osv.js";
import { data as php } from "./ecosystems/php.js";
import { data as python } from "./ecosystems/python.js";
import { data as ruby } from "./ecosystems/ruby.js";
import { data as rust } from "./ecosystems/rust.js";
import { data as scala } from "./ecosystems/scala.js";
import { data as serverless } from "./ecosystems/serverless.js";
import { data as shell } from "./ecosystems/shell.js";
import { data as swift } from "./ecosystems/swift.js";
import { data as terraform } from "./ecosystems/terraform.js";

export const BUNDLED_DATA: Record<string, unknown> = {
  android,
  "ci-images": ciImages,
  container,
  cpp,
  dart,
  database,
  deno,
  dotnet,
  elixir,
  "github-actions": githubActions,
  go,
  java,
  kubernetes,
  nodejs,
  npm,
  osv,
  php,
  python,
  ruby,
  rust,
  scala,
  serverless,
  shell,
  swift,
  terraform,
};
