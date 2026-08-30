export class IptimeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'IptimeError';
  }
}

export class AuthRequiredError extends IptimeError {
  constructor(message = 'Router authentication is required') {
    super(message, 'AUTH_REQUIRED');
  }
}

export class CaptchaRequiredError extends IptimeError {
  constructor(readonly challenge: unknown) {
    super('Router login requires a CAPTCHA', 'CAPTCHA_REQUIRED', challenge);
  }
}
