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
