package tw.gov.taipei.goodmorning.security;

public record CurrentUser(Long id, String ssoSubject, String account, String displayName) {
}
