package tw.gov.taipei.goodmorning.service;

import java.net.URI;

@FunctionalInterface
public interface ObjectStorage {

    URI readUrl(String objectKey);
}
