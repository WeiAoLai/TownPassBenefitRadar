package tw.gov.taipei.goodmorning.service;

public interface ObjectStorage extends ObjectUrlProvider {

    void put(String objectKey, byte[] content, String contentType);

    byte[] get(String objectKey);

    void delete(String objectKey);
}
