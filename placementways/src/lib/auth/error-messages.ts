/**
 * Maps Supabase Auth errors to messages that are helpful but do not leak
 * whether an account exists.
 */
type AuthErrorLike = { code?: string; status?: number; message?: string };

export function loginErrorMessage(error: AuthErrorLike): string {
  if (error.code === "email_not_confirmed") {
    return "Please confirm your email address first. Check your inbox for the confirmation link.";
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (isNetworkError(error)) {
    return "We couldn't reach the sign-in service. Please check your connection and try again.";
  }
  // Same message for "no such user" and "wrong password".
  return "Incorrect email or password.";
}

export function registerErrorMessage(error: AuthErrorLike): string {
  if (error.code === "weak_password") {
    return "That password is too easy to guess. Try a longer one with letters and numbers.";
  }
  if (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit"
  ) {
    return "Too many sign-up attempts. Please wait a few minutes and try again.";
  }
  if (isNetworkError(error)) {
    return "We couldn't reach the sign-up service. Please check your connection and try again.";
  }
  return "We couldn't create your account. Please try again.";
}

export function passwordUpdateErrorMessage(error: AuthErrorLike): string {
  if (error.code === "same_password") return "Choose a password different from your current one.";
  if (error.code === "weak_password") {
    return "That password is too easy to guess. Try a longer one with letters and numbers.";
  }
  if (error.status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (isNetworkError(error)) return "We couldn't reach the service. Please try again.";
  return "We couldn't update your password. Please request a new reset link and try again.";
}

function isNetworkError(error: AuthErrorLike): boolean {
  return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
}
