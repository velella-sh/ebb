import { EbbError } from "../errors.js";

/** Error thrown when a VERS range, scheme, or constraint version is invalid. */
export class VersError extends EbbError {
  constructor(message: string) {
    super("invalid-version", message);
    this.name = "VersError";
  }
}
