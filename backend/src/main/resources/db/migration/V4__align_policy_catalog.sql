ALTER TABLE artworks
    DROP FOREIGN KEY fk_artworks_policy;

ALTER TABLE policies
    DROP CONSTRAINT chk_policies_date_range,
    MODIFY COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    MODIFY COLUMN category VARCHAR(50) NOT NULL,
    MODIFY COLUMN title VARCHAR(255) NOT NULL,
    MODIFY COLUMN slogan VARCHAR(255) NOT NULL,
    MODIFY COLUMN source_url VARCHAR(768) NOT NULL,
    MODIFY COLUMN start_date DATE NULL,
    MODIFY COLUMN end_date DATE NULL DEFAULT NULL,
    ADD UNIQUE KEY uk_policies_source_url (source_url),
    ADD CONSTRAINT chk_policies_date_range
        CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date);

ALTER TABLE artworks
    MODIFY COLUMN policy_id INT UNSIGNED NOT NULL,
    ADD CONSTRAINT fk_artworks_policy
        FOREIGN KEY (policy_id) REFERENCES policies (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT;

UPDATE policies
SET category = '民生費用',
    title = '115年地價稅開徵',
    slogan = '地價稅11/30前繳，安心不忘記！',
    source_url = 'https://tpctax.gov.taipei/News_Content.aspx?n=F59FF484C69D07BF&s=EDE336CA31C04FAF&sms=72544237BBE4C5F6',
    is_active = TRUE,
    start_date = '2026-11-01',
    end_date = '2026-11-30'
WHERE id = 1;

UPDATE policies
SET category = '民生費用',
    title = '115年度300億元中央擴大租金補貼',
    slogan = '租屋補貼12/31截止，記得申請！',
    source_url = 'https://www.nlma.gov.tw/ch/legislation/law%26regunu/7243',
    is_active = TRUE,
    start_date = '2026-01-01',
    end_date = '2026-12-31'
WHERE id = 2;

UPDATE policies
SET category = '民生費用',
    title = '臺北市低收入戶生活補助',
    slogan = '生活扶助有依靠，符合資格來申請！',
    source_url = 'https://dosw.gov.taipei/cp.aspx?n=e6d700bd37e78592&s=AC5701100C4A434B',
    is_active = TRUE,
    start_date = '2026-04-09',
    end_date = NULL
WHERE id = 3;

UPDATE policies
SET category = '民生費用',
    title = '臺北市中低收入戶健保費補助',
    slogan = '健保費有補助，符合資格別錯過！',
    source_url = 'https://dosw.gov.taipei/cp.aspx?n=2FDE53A3B92057AA',
    is_active = TRUE,
    start_date = '2026-11-03',
    end_date = NULL
WHERE id = 4;

UPDATE policies
SET category = '生育',
    title = '臺北市生育補助',
    slogan = '迎接新生命，生育獎勵依胎次申請！',
    source_url = 'https://laws.gov.taipei/Law/LawSearch/LawArticleContentSearch/FL081869',
    is_active = TRUE,
    start_date = '2026-09-03',
    end_date = NULL
WHERE id = 5;

UPDATE policies
SET category = '生育',
    title = '臺北市友善托育補助',
    slogan = '未滿3歲托育有補助，育兒更安心！',
    source_url = 'https://dosw.gov.taipei/cp.aspx?n=46A2CAA8E124546D&s=1ADF41E184075E8A',
    is_active = TRUE,
    start_date = '2026-07-01',
    end_date = NULL
WHERE id = 6;

UPDATE policies
SET category = '生育',
    title = '不孕症試管嬰兒補助3.0',
    slogan = '試管療程有補助，好孕路上有支持！',
    source_url = 'https://www.hpa.gov.tw/Pages/Detail.aspx?nodeid=5002&pid=20300',
    is_active = TRUE,
    start_date = '2026-09-01',
    end_date = NULL
WHERE id = 7;

UPDATE policies
SET category = '老人',
    title = '臺北市敬老卡每月600點補助',
    slogan = '敬老卡每月600點，出門更便利！',
    source_url = 'https://dosw.gov.taipei/News_Content.aspx?n=6CA16D3397A7A302&s=EFF9CE431990FCDB',
    is_active = TRUE,
    start_date = '2026-07-01',
    end_date = NULL
WHERE id = 8;

UPDATE policies
SET category = '老人',
    title = '臺北市中低收入老人生活津貼',
    slogan = '長者生活有津貼，符合資格來申請！',
    source_url = 'https://dosw.gov.taipei/cp.aspx?n=FCF3DAE98DDA289F&s=64180EEDD02DEE2A',
    is_active = TRUE,
    start_date = '2026-10-07',
    end_date = NULL
WHERE id = 9;

UPDATE policies
SET category = '老人',
    title = '臺北市中低收入老人特別照顧津貼',
    slogan = '合格照顧者月補5,000元，暖心相伴！',
    source_url = 'https://dosw.gov.taipei/cp.aspx?n=3C3D1F78D6280694',
    is_active = TRUE,
    start_date = '2025-07-30',
    end_date = NULL
WHERE id = 10;
