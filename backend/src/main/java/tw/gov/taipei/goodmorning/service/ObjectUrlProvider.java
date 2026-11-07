package tw.gov.taipei.goodmorning.service;

import java.net.URI;

@FunctionalInterface
public interface ObjectUrlProvider {

    URI readUrl(String objectKey);
}
