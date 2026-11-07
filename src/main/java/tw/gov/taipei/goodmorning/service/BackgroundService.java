package tw.gov.taipei.goodmorning.service;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tw.gov.taipei.goodmorning.dto.BackgroundResponse;
import tw.gov.taipei.goodmorning.repository.BackgroundRepository;

@Service
public class BackgroundService {

    private final BackgroundRepository backgrounds;
    private final ObjectStorage objectStorage;

    public BackgroundService(BackgroundRepository backgrounds, ObjectStorage objectStorage) {
        this.backgrounds = backgrounds;
        this.objectStorage = objectStorage;
    }

    @Transactional(readOnly = true)
    public List<BackgroundResponse> listBackgrounds(long artworkCount) {
        return backgrounds.findByActiveTrueOrderByUnlockThresholdAscIdAsc().stream()
                .map(background -> new BackgroundResponse(
                        background.getId(),
                        background.getName(),
                        objectStorage.readUrl(background.getImageObjectKey()).toString(),
                        background.getUnlockThreshold(),
                        artworkCount >= background.getUnlockThreshold()))
                .toList();
    }
}
