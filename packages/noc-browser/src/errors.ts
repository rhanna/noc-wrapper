/**
 * Base error for low-level NOC browser failures.
 */
export class NocBrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NocBrowserError";
  }
}

/**
 * Error thrown when NOC returns a non-success HTTP response.
 */
export class NocHttpError extends NocBrowserError {
  /** HTTP status code returned by NOC. */
  readonly status: number;
  /** HTTP status text returned by NOC. */
  readonly statusText: string;
  /** Final request URL that produced the response. */
  readonly url: string;
  /** Raw response body text. */
  readonly body: string;

  constructor(
    message: string,
    options: { status: number; statusText: string; url: string; body: string },
  ) {
    super(message);
    this.name = "NocHttpError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
    this.body = options.body;
  }
}

/**
 * Error thrown when a NOC response cannot be parsed as the expected JSON shape.
 */
export class NocJsonError extends NocBrowserError {
  /** Raw response body that failed JSON parsing or WebMethod unwrapping. */
  readonly body: string;

  constructor(message: string, body: string) {
    super(message);
    this.name = "NocJsonError";
    this.body = body;
  }
}

/**
 * Error thrown when NOC login fails or an authenticated page returns the login form.
 */
export class NocAuthenticationError extends NocBrowserError {
  /** NOC-reported login error message when one could be parsed. */
  readonly loginErrorMessage: string | undefined;

  constructor(message: string, loginErrorMessage?: string) {
    super(message);
    this.name = "NocAuthenticationError";
    this.loginErrorMessage = loginErrorMessage;
  }
}

/**
 * Error thrown when an operation is blocked by active My Revision acknowledgement.
 */
export class NocRevisionAckRequiredError extends NocBrowserError {
  /** Parsed raw revision acknowledgement details when available. */
  readonly details: unknown;

  constructor(message = "NOC revision acknowledgement is required", details?: unknown) {
    super(message);
    this.name = "NocRevisionAckRequiredError";
    this.details = details;
  }
}
