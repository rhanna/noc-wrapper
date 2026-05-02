export class NocBrowserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NocBrowserError";
  }
}

export class NocHttpError extends NocBrowserError {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
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

export class NocJsonError extends NocBrowserError {
  readonly body: string;

  constructor(message: string, body: string) {
    super(message);
    this.name = "NocJsonError";
    this.body = body;
  }
}

export class NocAuthenticationError extends NocBrowserError {
  readonly loginErrorMessage: string | undefined;

  constructor(message: string, loginErrorMessage?: string) {
    super(message);
    this.name = "NocAuthenticationError";
    this.loginErrorMessage = loginErrorMessage;
  }
}

export class NocRevisionAckRequiredError extends NocBrowserError {
  readonly details: unknown;

  constructor(message = "NOC revision acknowledgement is required", details?: unknown) {
    super(message);
    this.name = "NocRevisionAckRequiredError";
    this.details = details;
  }
}
